import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

export type MaxMiniAppUser = {
  id?: number | string;
  user_id?: number | string;
  first_name?: string;
  last_name?: string;
  name?: string;
  username?: string;
  locale?: string;
};

export type VerifiedMaxMiniAppData = {
  authDate: Date;
  user: MaxMiniAppUser;
};

function safeCompareHex(actualHex: string, expectedHex: string) {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function pickUserId(user: MaxMiniAppUser) {
  const id = user.id ?? user.user_id;
  return id === undefined || id === null ? "" : String(id).trim();
}

export function verifyMaxMiniAppInitData(
  initData: string,
  botToken: string | undefined,
  options: { maxAgeSeconds?: number; now?: Date } = {},
): VerifiedMaxMiniAppData {
  if (!botToken) {
    throw new UnauthorizedException("MAX linked client sign-in is not configured.");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? params.get("signature");
  if (!hash) {
    throw new UnauthorizedException("MAX linked client sign-in hash is missing.");
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  if (pairs.length === 0) {
    throw new BadRequestException("MAX linked client sign-in data is empty.");
  }

  const dataCheckString = pairs.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeCompareHex(hash, expectedHash)) {
    throw new UnauthorizedException("MAX linked client sign-in signature is invalid.");
  }

  const authDateRaw = params.get("auth_date") ?? params.get("authDate");
  const authDateSeconds = Number(authDateRaw);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new UnauthorizedException("MAX linked client sign-in date is invalid.");
  }

  const nowMs = (options.now ?? new Date()).getTime();
  const authDateMs = authDateSeconds * 1000;
  const maxAgeMs = (options.maxAgeSeconds ?? 24 * 60 * 60) * 1000;
  if (authDateMs > nowMs + 5 * 60 * 1000 || nowMs - authDateMs > maxAgeMs) {
    throw new UnauthorizedException("MAX linked client sign-in data is expired.");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new UnauthorizedException("MAX linked client user payload is missing.");
  }

  let user: MaxMiniAppUser;
  try {
    user = JSON.parse(userRaw) as MaxMiniAppUser;
  } catch {
    throw new BadRequestException("MAX linked client user payload is invalid.");
  }

  if (!pickUserId(user)) {
    throw new UnauthorizedException("MAX linked client user id is missing.");
  }

  return {
    authDate: new Date(authDateMs),
    user,
  };
}

export function maxMiniAppUserId(user: MaxMiniAppUser) {
  return pickUserId(user);
}
