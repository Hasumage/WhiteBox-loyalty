import { createHash, randomInt, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const CUSTOMER_LOOKUP_CODE_TTL_MS = 15 * 60 * 1000;
const CUSTOMER_LOOKUP_PHRASES = new Set([
  "/code",
  "/kod",
  "code",
  "give code",
  "show code",
  "my code",
  "код",
  "кодик",
  "дай код",
  "дать код",
  "пришли код",
  "отправь код",
  "покажи код",
  "мой код",
  "нужен код",
  "сгенерируй код",
  "qr код",
  "qr-code",
]);

function normalizeLookupText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[?!.,:;()[\]{}"'`]+/g, " ")
    .replace(/\s+/g, " ");
}

function customerLookupHash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function isTelegramLookupCodeRequest(text: string | undefined) {
  if (!text) return false;
  const normalized = normalizeLookupText(text);
  if (CUSTOMER_LOOKUP_PHRASES.has(normalized)) return true;

  return (
    /^(дай|дать|пришли|отправь|покажи|сгенерируй|нужен|нужен мой|можно|можно мой)\s+(qr\s+)?код(ик)?(\s+пожалуйста)?$/.test(normalized) ||
    /^(give|show|send|generate)\s+(my\s+)?(qr\s+)?code(\s+please)?$/.test(normalized)
  );
}

export async function createTelegramCustomerLookupCode(userId: number) {
  const now = new Date();
  const activeRows = await prisma.$queryRaw<Array<{ code: string | null; expiresAt: Date }>>`
    SELECT "code", "expiresAt"
    FROM "CustomerLookupCode"
    WHERE "userId" = ${userId}
      AND "usedAt" IS NULL
      AND "expiresAt" > ${now}
      AND "code" IS NOT NULL
    ORDER BY "expiresAt" DESC
    LIMIT 1
  `;
  const activeCode = activeRows[0] ?? null;
  if (activeCode?.code) {
    return { code: activeCode.code, expiresAt: activeCode.expiresAt };
  }

  const expiresAt = new Date(now.getTime() + CUSTOMER_LOOKUP_CODE_TTL_MS);

  await prisma.customerLookupCode.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomInt(0, 100_000).toString().padStart(5, "0");
    try {
      await prisma.$executeRaw`
        INSERT INTO "CustomerLookupCode" ("id", "userId", "code", "codeHash", "expiresAt", "createdAt")
        VALUES (${randomUUID()}, ${userId}, ${code}, ${customerLookupHash(code)}, ${expiresAt}, ${now})
      `;
      return { code, expiresAt };
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code !== "P2002" && !isUniqueViolation(error)) throw error;
    }
  }

  throw new Error("CUSTOMER_LOOKUP_CODE_GENERATION_FAILED");
}

function isUniqueViolation(error: unknown) {
  const prismaError = error as { code?: string };
  const message = error instanceof Error ? error.message : String(error);
  return prismaError.code === "P2002" || message.includes("CustomerLookupCode_codeHash_key");
}
