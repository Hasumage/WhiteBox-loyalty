import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { VkIdService } from "./vkid.service";

describe("VkIdService", () => {
  let service: VkIdService;
  let prisma: {
    oAuthState: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    oAuthLoginTicket: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    oAuthAccount: { deleteMany: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    oAuthAccount: { findUnique: jest.Mock; upsert: jest.Mock };
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let config: { get: jest.Mock };
  let auth: { recordLoginEvent: jest.Mock; issueTokens: jest.Mock };

  beforeEach(() => {
    tx = {
      oAuthAccount: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: "oauth-1" }),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    prisma = {
      oAuthState: {
        create: jest.fn().mockResolvedValue({ id: "state-1" }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: "state-1" }),
      },
      oAuthLoginTicket: {
        create: jest.fn().mockResolvedValue({ id: "ticket-1" }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: "ticket-1" }),
      },
      oAuthAccount: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          VKID_CLIENT_ID: "vk-client-id",
          VKID_CLIENT_SECRET: "vk-secret",
          VKID_REDIRECT_URI: "https://nearloy.ru/backend-api/oauth/vkid/callback",
          PUBLIC_APP_URL: "https://nearloy.ru",
        };
        return values[key];
      }),
    };
    auth = {
      recordLoginEvent: jest.fn().mockResolvedValue(undefined),
      issueTokens: jest.fn().mockResolvedValue({ accessToken: "jwt", refreshToken: "refresh" }),
    };
    service = new VkIdService(prisma as never, config as unknown as ConfigService, auth as unknown as AuthService);
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a VK ID authorization redirect with PKCE state and safe next path", async () => {
    const redirect = await service.createAuthorizationRedirect({
      next: "https://evil.test/steal",
      linkUserId: 42,
      ctx: { ipAddress: "1.2.3.4", userAgent: "UA" },
    });

    const url = new URL(redirect);
    expect(url.origin + url.pathname).toBe("https://id.vk.com/authorize");
    expect(url.searchParams.get("client_id")).toBe("vk-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://nearloy.ru/backend-api/oauth/vkid/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(prisma.oAuthState.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "vkid",
        redirectAfter: "/app",
        linkUserId: 42,
        ipAddress: "1.2.3.4",
        userAgent: "UA",
        codeVerifier: expect.any(String),
        stateHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it("registers a passwordless client from VK ID and marks VK email as verified", async () => {
    const startUrl = await service.createAuthorizationRedirect({ next: "/settings/account" });
    const state = new URL(startUrl).searchParams.get("state")!;
    const codeVerifier = prisma.oAuthState.create.mock.calls[0][0].data.codeVerifier;
    prisma.oAuthState.findUnique.mockResolvedValue({
      id: "state-1",
      provider: "vkid",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      codeVerifier,
      redirectAfter: "/settings/account",
      linkUserId: null,
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: "vk-access", refresh_token: "vk-refresh", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: {
            user_id: 308859679,
            email: "maxim@example.com",
            first_name: "Maxim",
            last_name: "Pastukhov",
          },
        }),
      });
    tx.oAuthAccount.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({
      id: 77,
      email: "maxim@example.com",
      name: "Maxim Pastukhov",
      role: UserRole.CLIENT,
    });

    const completeUrl = await service.handleCallback({
      code: "vk-code",
      state,
      ctx: { ipAddress: "127.0.0.1" },
    });

    expect(completeUrl).toMatch(/^https:\/\/nearloy\.ru\/oauth\/vkid\/complete\?ticket=/);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "maxim@example.com",
        name: "Maxim Pastukhov",
        role: UserRole.CLIENT,
        passwordHash: null,
        emailVerifiedAt: expect.any(Date),
        termsAcceptedAt: expect.any(Date),
      }),
    });
    expect(tx.oAuthAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ provider: "vkid", providerAccountId: "308859679", userId: 77 }),
    }));
    expect(auth.recordLoginEvent).toHaveBeenCalledWith(77, expect.objectContaining({ deviceLabel: "VK ID" }));
    expect(prisma.oAuthLoginTicket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "vkid",
        userId: 77,
        redirectAfter: "/settings/account",
        ticketHash: expect.any(String),
      }),
    });
  });

  it("returns native app callback for VK ID login started from Capacitor", async () => {
    const startUrl = await service.createAuthorizationRedirect({ next: "/app?app=capacitor" });
    const state = new URL(startUrl).searchParams.get("state")!;
    const codeVerifier = prisma.oAuthState.create.mock.calls[0][0].data.codeVerifier;
    prisma.oAuthState.findUnique.mockResolvedValue({
      id: "state-mobile",
      provider: "vkid",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      codeVerifier,
      redirectAfter: "/app?app=capacitor",
      linkUserId: null,
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: "vk-access", refresh_token: "vk-refresh", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ user: { user_id: 308859679, email: "maxim@example.com" } }),
      });
    tx.oAuthAccount.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue({ id: 77, email: "maxim@example.com", name: "Maxim", role: UserRole.CLIENT });
    tx.oAuthAccount.upsert.mockResolvedValue({});

    const completeUrl = await service.handleCallback({ code: "vk-code", state });

    expect(completeUrl).toMatch(/^nearloy:\/\/oauth\/vkid\/complete\?ticket=/);
    expect(completeUrl).toContain("app=capacitor");
    expect(prisma.oAuthLoginTicket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        redirectAfter: "/app?app=capacitor",
      }),
    });
  });

  it("links VK ID to the current user and blocks links already owned by another account", async () => {
    const startUrl = await service.createAuthorizationRedirect({ next: "/settings/account", linkUserId: 5 });
    const state = new URL(startUrl).searchParams.get("state")!;
    const codeVerifier = prisma.oAuthState.create.mock.calls[0][0].data.codeVerifier;
    prisma.oAuthState.findUnique.mockResolvedValue({
      id: "state-1",
      provider: "vkid",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      codeVerifier,
      redirectAfter: "/settings/account",
      linkUserId: 5,
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ access_token: "vk-access" }) })
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ user: { user_id: "vk-1" } }) });
    tx.user.findUnique.mockResolvedValue({ id: 5, accountStatus: "ACTIVE" });
    tx.oAuthAccount.findUnique.mockResolvedValue({ userId: 8 });

    await expect(service.handleCallback({ code: "vk-code", state })).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows unlink only when account has a regular email and password", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      email: "client@example.com",
      passwordHash: "hash",
      oauthAccounts: [{ id: "oauth-1" }],
    });

    await expect(service.unlink(9)).resolves.toEqual({
      provider: "vkid",
      linked: false,
      canUnlink: false,
      unlinkBlockedReason: null,
    });
    expect(prisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({ where: { userId: 9, provider: "vkid" } });

    prisma.user.findUnique.mockResolvedValueOnce({
      email: "vkid+123@oauth.nearloy.local",
      passwordHash: null,
      oauthAccounts: [{ id: "oauth-2" }],
    });

    await expect(service.unlink(10)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("consumes a one-time VK ID ticket and issues NearLoy tokens", async () => {
    prisma.oAuthLoginTicket.findUnique.mockResolvedValue({
      id: "ticket-1",
      provider: "vkid",
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redirectAfter: "/app",
      user: { id: 11, accountStatus: "ACTIVE" },
    });

    const result = await service.consumeTicket("raw-ticket");

    expect(result).toEqual({ accessToken: "jwt", refreshToken: "refresh", redirectAfter: "/app" });
    expect(prisma.oAuthLoginTicket.update).toHaveBeenCalledWith({
      where: { id: "ticket-1" },
      data: { consumedAt: expect.any(Date) },
    });
    expect(auth.issueTokens).toHaveBeenCalledWith({ id: 11, accountStatus: "ACTIVE" });
  });

  it("rejects missing or expired callback state and tickets", async () => {
    await expect(service.handleCallback({ code: "", state: "state" })).rejects.toBeInstanceOf(BadRequestException);
    prisma.oAuthLoginTicket.findUnique.mockResolvedValue(null);
    await expect(service.consumeTicket("bad-ticket")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
