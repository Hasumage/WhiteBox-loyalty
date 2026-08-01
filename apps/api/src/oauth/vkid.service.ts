import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole, type Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { AuthService, type LoginContext } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";

type VkIdTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  user_id?: string | number;
  email?: string;
};

type VkIdUserInfoResponse = {
  user?: {
    user_id?: string | number;
    id?: string | number;
    email?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
  };
  user_id?: string | number;
  id?: string | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
};

type VkIdProfile = {
  providerAccountId: string;
  email: string | null;
  name: string;
};

const PROVIDER = "vkid";
const STATE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;
const USER_TERMS_VERSION = "2026-07-12";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function codeChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function safeNext(value: string | undefined | null) {
  const next = value?.trim();
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/app";
  const path = next.split(/[?#]/, 1)[0] || "/";
  const blocked = new Set(["/", "/login", "/register", "/forgot-password", "/mobile-login", "/mobile-register"]);
  return blocked.has(path) ? "/app" : next;
}

function decodeJwtPayload(token: string | undefined) {
  if (!token) return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

@Injectable()
export class VkIdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  isEnabled() {
    return Boolean(this.clientId());
  }

  trustedRedirectUrl() {
    return this.config.get<string>("VKID_REDIRECT_URI")?.trim() || `${this.publicWebUrl()}/backend-api/oauth/vkid/callback`;
  }

  async status(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        passwordHash: true,
        oauthAccounts: {
          where: { provider: PROVIDER },
          select: { id: true },
          take: 1,
        },
      },
    });
    const linked = Boolean(user?.oauthAccounts.length);
    const canUnlink = Boolean(linked && user?.passwordHash && user.email && !this.isSyntheticVkEmail(user.email));
    return {
      provider: PROVIDER,
      linked,
      canUnlink,
      unlinkBlockedReason: linked && !canUnlink ? this.unlinkBlockedReason(user) : null,
    };
  }

  async unlink(userId: number) {
    const status = await this.status(userId);
    if (!status.linked) return status;
    if (!status.canUnlink) {
      throw new BadRequestException(status.unlinkBlockedReason ?? "VK ID cannot be unlinked from this account.");
    }
    await this.prisma.oAuthAccount.deleteMany({
      where: { userId, provider: PROVIDER },
    });
    return { provider: PROVIDER, linked: false, canUnlink: false, unlinkBlockedReason: null };
  }

  async createAuthorizationRedirect(input: { next?: string | null; ctx?: LoginContext; linkUserId?: number | null }) {
    const clientId = this.clientId();
    if (!clientId) {
      throw new InternalServerErrorException("VK ID is not configured. Set VKID_CLIENT_ID.");
    }

    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    await this.prisma.oAuthState.create({
      data: {
        provider: PROVIDER,
        stateHash: sha256(state),
        codeVerifier: verifier,
        redirectAfter: safeNext(input.next),
        linkUserId: input.linkUserId ?? null,
        ipAddress: input.ctx?.ipAddress ?? null,
        userAgent: input.ctx?.userAgent ?? null,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });

    const url = new URL(this.config.get<string>("VKID_AUTHORIZATION_URL") || "https://id.vk.com/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", this.trustedRedirectUrl());
    url.searchParams.set("scope", this.config.get<string>("VKID_SCOPE") || "email");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async handleCallback(input: { code?: string | null; state?: string | null; deviceId?: string | null; ctx?: LoginContext }) {
    const code = input.code?.trim();
    const state = input.state?.trim();
    if (!code || !state) throw new BadRequestException("VK ID callback is missing code or state.");

    const storedState = await this.prisma.oAuthState.findUnique({ where: { stateHash: sha256(state) } });
    if (!storedState || storedState.provider !== PROVIDER || storedState.consumedAt || storedState.expiresAt <= new Date()) {
      throw new UnauthorizedException("VK ID state is invalid or expired.");
    }

    await this.prisma.oAuthState.update({
      where: { id: storedState.id },
      data: { consumedAt: new Date() },
    });

    const token = await this.exchangeCode(code, storedState.codeVerifier, input.deviceId);
    const profile = await this.resolveProfile(token);
    if (storedState.linkUserId) {
      await this.linkProfileToUser(storedState.linkUserId, profile, token);
      const redirectUrl = new URL(storedState.redirectAfter ?? "/settings/account", this.publicWebUrl());
      redirectUrl.searchParams.set("vkid", "linked");
      return redirectUrl.toString();
    }

    const user = await this.findOrCreateUser(profile, token);
    await this.auth.recordLoginEvent(user.id, {
      ...input.ctx,
      deviceLabel: input.ctx?.deviceLabel ?? "VK ID",
    });

    const ticket = randomBytes(32).toString("base64url");
    await this.prisma.oAuthLoginTicket.create({
      data: {
        provider: PROVIDER,
        ticketHash: sha256(ticket),
        userId: user.id,
        redirectAfter: storedState.redirectAfter,
        expiresAt: new Date(Date.now() + TICKET_TTL_MS),
      },
    });

    const completeUrl = new URL("/oauth/vkid/complete", this.publicWebUrl());
    completeUrl.searchParams.set("ticket", ticket);
    return completeUrl.toString();
  }

  async consumeTicket(ticket: string) {
    const rawTicket = ticket.trim();
    if (!rawTicket) throw new BadRequestException("VK ID ticket is required.");
    const row = await this.prisma.oAuthLoginTicket.findUnique({
      where: { ticketHash: sha256(rawTicket) },
      include: { user: true },
    });
    if (!row || row.provider !== PROVIDER || row.consumedAt || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("VK ID ticket is invalid or expired.");
    }
    if (row.user.accountStatus === "BLOCKED") {
      throw new UnauthorizedException("Account is blocked.");
    }
    await this.prisma.oAuthLoginTicket.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    return {
      ...(await this.auth.issueTokens(row.user)),
      redirectAfter: row.redirectAfter,
    };
  }

  private async exchangeCode(code: string, codeVerifier: string, deviceId?: string | null) {
    const clientId = this.clientId();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.trustedRedirectUrl(),
    });
    const clientSecret = this.config.get<string>("VKID_CLIENT_SECRET")?.trim();
    if (clientSecret) body.set("client_secret", clientSecret);
    if (deviceId?.trim()) body.set("device_id", deviceId.trim());

    const response = await fetch(this.config.get<string>("VKID_TOKEN_URL") || "https://id.vk.com/oauth2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as VkIdTokenResponse & { error?: string; error_description?: string };
    if (!response.ok || !payload.access_token) {
      throw new BadGatewayException(payload.error_description || payload.error || "VK ID token exchange failed.");
    }
    return payload;
  }

  private async resolveProfile(token: VkIdTokenResponse): Promise<VkIdProfile> {
    const jwt = decodeJwtPayload(token.id_token);
    let userInfo: VkIdUserInfoResponse | null = null;
    if (token.access_token) {
      const body = new URLSearchParams({
        access_token: token.access_token,
        client_id: this.clientId(),
      });
      const response = await fetch(this.config.get<string>("VKID_USERINFO_URL") || "https://id.vk.com/oauth2/user_info", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (response.ok) {
        userInfo = (await response.json().catch(() => null)) as VkIdUserInfoResponse | null;
      }
    }
    const user = userInfo?.user ?? userInfo ?? {};
    const providerAccountId = pickString(user.user_id, user.id, token.user_id, jwt?.sub);
    if (!providerAccountId) throw new BadGatewayException("VK ID profile has no user id.");
    const email = pickString(user.email, userInfo?.email, token.email, jwt?.email);
    const name =
      pickString(user.name) ||
      [pickString(user.first_name), pickString(user.last_name)].filter(Boolean).join(" ").trim() ||
      (email ? email.split("@")[0] : `VK ID ${providerAccountId}`);
    return { providerAccountId, email, name };
  }

  private async findOrCreateUser(profile: VkIdProfile, token: VkIdTokenResponse) {
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: profile.providerAccountId } },
        include: { user: true },
      });
      if (linked?.user) {
        await this.updateOAuthAccount(tx, linked.userId, profile.providerAccountId, token);
        return linked.user;
      }

      const existing = profile.email
        ? await tx.user.findUnique({ where: { email: profile.email.toLowerCase() } })
        : null;
      const user = existing ?? await tx.user.create({
        data: {
          name: profile.name,
          email: profile.email?.toLowerCase() ?? `vkid+${profile.providerAccountId}@oauth.nearloy.local`,
          role: UserRole.CLIENT,
          passwordHash: null,
          emailVerifiedAt: profile.email ? new Date() : null,
          termsAcceptedAt: new Date(),
          termsVersion: USER_TERMS_VERSION,
        },
      });
      await this.updateOAuthAccount(tx, user.id, profile.providerAccountId, token);
      return user;
    });
  }

  private async linkProfileToUser(userId: number, profile: VkIdProfile, token: VkIdTokenResponse) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, accountStatus: true } });
      if (!user || user.accountStatus === "BLOCKED") {
        throw new UnauthorizedException("Account is not available for VK ID linking.");
      }
      const linked = await tx.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: profile.providerAccountId } },
        select: { userId: true },
      });
      if (linked && linked.userId !== userId) {
        throw new ConflictException("This VK ID is already linked to another NearLoy account.");
      }
      await this.updateOAuthAccount(tx, userId, profile.providerAccountId, token);
    });
  }

  private isSyntheticVkEmail(email: string | null | undefined) {
    const normalized = email?.trim().toLowerCase() ?? "";
    return normalized.startsWith("vkid+") && normalized.endsWith("@oauth.nearloy.local");
  }

  private unlinkBlockedReason(user: { email: string | null; passwordHash: string | null } | null) {
    if (!user?.passwordHash) return "Сначала задайте пароль через «Забыли пароль» или смену пароля.";
    if (!user.email || this.isSyntheticVkEmail(user.email)) return "Сначала добавьте обычный email для входа.";
    return "VK ID нельзя отвязать от этого аккаунта.";
  }

  private async updateOAuthAccount(
    tx: Prisma.TransactionClient,
    userId: number,
    providerAccountId: string,
    token: VkIdTokenResponse,
  ) {
    await tx.oAuthAccount.upsert({
      where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId } },
      create: {
        provider: PROVIDER,
        providerAccountId,
        userId,
        accessToken: token.access_token ?? null,
        refreshToken: token.refresh_token ?? null,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scope: token.scope ?? null,
      },
      update: {
        userId,
        accessToken: token.access_token ?? null,
        refreshToken: token.refresh_token ?? null,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scope: token.scope ?? null,
      },
    });
  }

  private clientId() {
    return this.config.get<string>("VKID_CLIENT_ID")?.trim() || "";
  }

  private publicWebUrl() {
    return (
      this.config.get<string>("PUBLIC_APP_URL")?.trim() ||
      this.config.get<string>("NEXT_PUBLIC_APP_URL")?.trim() ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
  }
}
