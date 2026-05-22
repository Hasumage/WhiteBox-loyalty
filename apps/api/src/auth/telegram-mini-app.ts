import { createHmac, timingSafeEqual } from "crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";

export type TelegramMiniAppUser = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type VerifiedTelegramMiniAppData = {
  authDate: Date;
  user: TelegramMiniAppUser;
};

function safeCompareHex(actualHex: string, expectedHex: string) {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyTelegramMiniAppInitData(
  initData: string,
  botToken: string | undefined,
  options: { maxAgeSeconds?: number; now?: Date } = {},
): VerifiedTelegramMiniAppData {
  if (!botToken) {
    throw new UnauthorizedException("Telegram Mini App auth is not configured.");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new UnauthorizedException("Telegram Mini App auth hash is missing.");
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  if (pairs.length === 0) {
    throw new BadRequestException("Telegram Mini App initData is empty.");
  }

  const dataCheckString = pairs.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeCompareHex(hash, expectedHash)) {
    throw new UnauthorizedException("Telegram Mini App auth signature is invalid.");
  }

  const authDateRaw = params.get("auth_date");
  const authDateSeconds = Number(authDateRaw);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new UnauthorizedException("Telegram Mini App auth date is invalid.");
  }

  const nowMs = (options.now ?? new Date()).getTime();
  const authDateMs = authDateSeconds * 1000;
  const maxAgeMs = (options.maxAgeSeconds ?? 24 * 60 * 60) * 1000;
  if (authDateMs > nowMs + 5 * 60 * 1000 || nowMs - authDateMs > maxAgeMs) {
    throw new UnauthorizedException("Telegram Mini App auth data is expired.");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new UnauthorizedException("Telegram Mini App user payload is missing.");
  }

  let user: TelegramMiniAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramMiniAppUser;
  } catch {
    throw new BadRequestException("Telegram Mini App user payload is invalid.");
  }

  if (user.id === undefined || user.id === null || `${user.id}`.trim() === "") {
    throw new UnauthorizedException("Telegram Mini App user id is missing.");
  }

  return {
    authDate: new Date(authDateMs),
    user,
  };
}
