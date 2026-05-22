import { randomUUID } from "node:crypto";
import type { CompanyEmploymentType, IdentityVerificationMode } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessageQueued } from "@/lib/telegram/telegram-queue";
import { escapeTelegramHtml } from "@/lib/telegram/telegram-service";
import { encryptPassportData, type EncryptedPassportData, type ManualPassportData } from "./passport-data";
import type { StoredPassportUpload } from "./passport-storage";

const MAX_TEXT = 500;

type ApplicationPayload = {
  employmentType: CompanyEmploymentType;
  identityVerificationMode: IdentityVerificationMode;
  contactName: string;
  contactEmail: string;
  password: string;
  contactTelegram?: string;
  companyName: string;
  businessCategory: string;
  legalFirstName: string;
  legalMiddleName?: string;
  legalLastName: string;
  birthDate: Date;
  age: number;
  legalFullName: string;
  legalInn: string;
  legalOgrnip?: string;
  legalRegistrationRegion?: string;
  payoutBankName?: string;
  payoutBik?: string;
  payoutAccount?: string;
  payoutCorrespondentAccount?: string;
  payoutCardLast4?: string;
  passportData?: ManualPassportData;
  encryptedPassportData?: EncryptedPassportData;
  verificationDeferralReason?: string;
  passportPhotoProvided: boolean;
  consentAccepted: boolean;
};

export function normalizeText(value: unknown, max = MAX_TEXT) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function onlyDigits(value: unknown, max = 32) {
  return normalizeText(value, max * 3).replace(/\D/g, "").slice(0, max);
}

function parseBirthDate(value: unknown) {
  const raw = normalizeText(value, 20);
  const date = raw ? new Date(`${raw}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid birth date.");
  }
  return date;
}

function ageFromBirthDate(birthDate: Date, now = new Date()) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

export function parseCompanyApplicationPayload(input: Record<string, unknown>): ApplicationPayload {
  const employmentType = normalizeText(input.employmentType) as CompanyEmploymentType;
  if (employmentType !== "SELF_EMPLOYED" && employmentType !== "INDIVIDUAL_ENTREPRENEUR") {
    throw new Error("Choose employment type.");
  }
  const identityVerificationMode = normalizeText(input.identityVerificationMode) as IdentityVerificationMode || "FULL";
  if (identityVerificationMode !== "FULL" && identityVerificationMode !== "DEFERRED") {
    throw new Error("Choose identity verification mode.");
  }

  const legalInn = onlyDigits(input.legalInn, 12);
  if (employmentType === "SELF_EMPLOYED" && legalInn.length !== 12) {
    throw new Error("Self-employed applicant INN must contain 12 digits.");
  }
  if (employmentType === "INDIVIDUAL_ENTREPRENEUR" && ![10, 12].includes(legalInn.length)) {
    throw new Error("IP applicant INN must contain 10 or 12 digits.");
  }

  const contactName = normalizeText(input.contactName, 120);
  const contactEmail = normalizeText(input.contactEmail, 160).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";
  const passwordConfirm = typeof input.passwordConfirm === "string" ? input.passwordConfirm : "";
  const companyName = normalizeText(input.companyName, 160);
  const businessCategory = normalizeText(input.businessCategory, 120);
  const legalFirstName = normalizeText(input.legalFirstName, 80);
  const legalMiddleName = normalizeText(input.legalMiddleName, 80);
  const legalLastName = normalizeText(input.legalLastName, 80);
  const legalFullName = [legalLastName, legalFirstName, legalMiddleName].filter(Boolean).join(" ");
  const birthDate = parseBirthDate(input.birthDate);
  const age = ageFromBirthDate(birthDate);
  const passportPhotoProvided = input.passportPhotoProvided === true;
  const verificationDeferralReason = normalizeText(input.verificationDeferralReason, 1200);

  if (!contactName || !contactEmail || !companyName || !businessCategory || !legalFirstName || !legalLastName) {
    throw new Error("Fill in required fields.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error("Password must be between 8 and 72 characters.");
  }
  if (password !== passwordConfirm) {
    throw new Error("Passwords do not match.");
  }
  if (age < 16) {
    throw new Error("Company access is available only for applicants aged 16 or older.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Enter a valid email.");
  }
  if (input.consentAccepted !== true) {
    throw new Error("Consent is required.");
  }
  let passportData: ManualPassportData | undefined;
  let encryptedPassportData: EncryptedPassportData | undefined;
  if (identityVerificationMode === "FULL") {
    const series = onlyDigits(input.passportSeries, 4);
    const number = onlyDigits(input.passportNumber, 6);
    const issuedBy = normalizeText(input.passportIssuedBy, 240);
    const issuedAt = normalizeText(input.passportIssuedAt, 20);
    const departmentCode = onlyDigits(input.passportDepartmentCode, 6);
    if (series.length !== 4 || number.length !== 6 || !issuedBy || !issuedAt) {
      throw new Error("Fill in passport data or choose deferred verification.");
    }
    if (!passportPhotoProvided) {
      throw new Error("Passport photo is required for full verification.");
    }
    passportData = { series, number, issuedBy, issuedAt, departmentCode: departmentCode || undefined };
    encryptedPassportData = encryptPassportData(passportData);
  } else if (verificationDeferralReason.length < 40) {
    throw new Error("Tell us about your business and why you want to postpone passport verification.");
  }

  return {
    employmentType,
    identityVerificationMode,
    contactName,
    contactEmail,
    password,
    contactTelegram: normalizeText(input.contactTelegram, 80) || undefined,
    companyName,
    businessCategory,
    legalFirstName,
    legalMiddleName: legalMiddleName || undefined,
    legalLastName,
    birthDate,
    age,
    legalFullName,
    legalInn,
    legalOgrnip: undefined,
    legalRegistrationRegion: undefined,
    payoutBankName: undefined,
    payoutBik: undefined,
    payoutAccount: undefined,
    payoutCorrespondentAccount: undefined,
    payoutCardLast4: undefined,
    passportData,
    encryptedPassportData,
    verificationDeferralReason: verificationDeferralReason || undefined,
    passportPhotoProvided,
    consentAccepted: true,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `company-${randomUUID().slice(0, 8)}`;
}

async function uniqueCompanySlug(name: string) {
  const base = slugify(name);
  let candidate = base;
  let index = 2;
  while (await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base.slice(0, 54)}-${index}`;
    index += 1;
  }
  return candidate;
}

export async function createCompanyVerificationApplication(params: {
  payload: ApplicationPayload;
  passportUpload?: StoredPassportUpload;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
  if (!category) throw new Error("Company category catalog is empty.");

  const existingUser = await prisma.user.findUnique({ where: { email: params.payload.contactEmail }, select: { id: true } });
  if (existingUser) {
    throw new Error("A WhiteBox account with this email already exists. Sign in first or use another email.");
  }

  const slug = await uniqueCompanySlug(params.payload.companyName);
  const passwordHash = await bcrypt.hash(params.payload.password, 12);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: params.payload.contactName,
        email: params.payload.contactEmail,
        role: "COMPANY",
        passwordHash,
      },
    });

    const company = await tx.company.create({
      data: {
        slug,
        name: params.payload.companyName,
        description: `Pending verification: ${params.payload.businessCategory}`,
        categoryId: category.id,
        isActive: false,
        ownerUserId: user.id,
        employmentType: params.payload.employmentType,
        identityVerificationMode: params.payload.identityVerificationMode,
        identityVerificationCompleted: params.payload.identityVerificationMode === "FULL",
        verificationStatus: "SUBMITTED",
        legalFirstName: params.payload.legalFirstName,
        legalMiddleName: params.payload.legalMiddleName ?? null,
        legalLastName: params.payload.legalLastName,
        birthDate: params.payload.birthDate,
        legalFullName: params.payload.legalFullName,
        legalInn: params.payload.legalInn,
        legalOgrnip: params.payload.legalOgrnip ?? null,
        legalRegistrationRegion: params.payload.legalRegistrationRegion ?? null,
        payoutBankName: params.payload.payoutBankName ?? null,
        payoutBik: params.payload.payoutBik ?? null,
        payoutAccount: params.payload.payoutAccount ?? null,
        payoutCorrespondentAccount: params.payload.payoutCorrespondentAccount ?? null,
        payoutCardLast4: params.payload.payoutCardLast4 ?? null,
        passportVerificationStatus: "SUBMITTED",
        passportLast4: null,
        passportDataDeletedAt: null,
        verificationSubmittedAt: new Date(),
      },
    });

    await tx.userCompany.create({
      data: {
        userId: user.id,
        companyId: company.id,
      },
    });

    const application = await tx.companyVerificationApplication.create({
      data: {
        companyId: company.id,
        employmentType: params.payload.employmentType,
        identityVerificationMode: params.payload.identityVerificationMode,
        contactName: params.payload.contactName,
        contactEmail: params.payload.contactEmail,
        contactTelegram: params.payload.contactTelegram ?? null,
        companyName: params.payload.companyName,
        businessCategory: params.payload.businessCategory,
        legalFirstName: params.payload.legalFirstName,
        legalMiddleName: params.payload.legalMiddleName ?? null,
        legalLastName: params.payload.legalLastName,
        birthDate: params.payload.birthDate,
        legalFullName: params.payload.legalFullName,
        legalInn: params.payload.legalInn,
        legalOgrnip: params.payload.legalOgrnip ?? null,
        legalRegistrationRegion: params.payload.legalRegistrationRegion ?? null,
        payoutBankName: params.payload.payoutBankName ?? null,
        payoutBik: params.payload.payoutBik ?? null,
        payoutAccount: params.payload.payoutAccount ?? null,
        payoutCorrespondentAccount: params.payload.payoutCorrespondentAccount ?? null,
        payoutCardLast4: params.payload.payoutCardLast4 ?? null,
        passportEncryptedPayload: params.payload.encryptedPassportData?.payload ?? null,
        passportEncryptionIv: params.payload.encryptedPassportData?.iv ?? null,
        passportEncryptionTag: params.payload.encryptedPassportData?.tag ?? null,
        passportLast4: params.payload.passportData?.number.slice(-4) ?? null,
        verificationDeferralReason: params.payload.verificationDeferralReason ?? null,
        passportDataDeletedAt: null,
        consentAcceptedAt: new Date(),
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });

    if (params.passportUpload) {
      await tx.passportVerificationFile.create({
        data: {
          applicationId: application.id,
          storageKey: params.passportUpload.storageKey,
          originalName: params.passportUpload.originalName ?? null,
          mimeType: params.passportUpload.mimeType,
          size: params.passportUpload.size,
          sha256: params.passportUpload.sha256,
          encryptionIv: params.passportUpload.encryptionIv,
          encryptionTag: params.passportUpload.encryptionTag,
        },
      });
    }

    return { user, company, application };
  });
}

function applicationAdminUrl(uuid: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || process.env.NEXT_PUBLIC_FRONTEND_URL;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
    return `${origin.replace(/\/$/, "")}/admin/companies?verification=${uuid}`;
  } catch {
    return null;
  }
}

export async function notifyAdminsAboutCompanyApplication(applicationUuid: string) {
  const application = await prisma.companyVerificationApplication.findUnique({ where: { uuid: applicationUuid } });
  if (!application) throw new Error("Application not found.");

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN", "MANAGER"] }, telegramId: { not: null } },
    select: { telegramId: true, email: true, name: true },
  });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || admins.length === 0) return { sent: 0, admins: admins.length };

  const url = applicationAdminUrl(application.uuid);
  const employmentTypeLabel =
    application.employmentType === "SELF_EMPLOYED" ? "самозанятый" : "индивидуальный предприниматель";
  const verificationModeLabel =
    application.identityVerificationMode === "FULL" ? "полная проверка" : "тестовый доступ без паспорта";
  const text = [
    "\u{1F3E2} <b>Новая заявка на верификацию компании WhiteBox</b>",
    `<code>${escapeTelegramHtml(application.uuid)}</code>`,
    "",
    `<b>Компания:</b> ${escapeTelegramHtml(application.companyName)}`,
    `<b>Тип:</b> ${employmentTypeLabel}`,
    `<b>Проверка:</b> ${verificationModeLabel}`,
    `<b>Контакт:</b> ${escapeTelegramHtml(application.contactName)} · ${escapeTelegramHtml(application.contactEmail)}`,
    `<b>ИНН:</b> ${escapeTelegramHtml(application.legalInn)}`,
    application.legalOgrnip ? `<b>ОГРНИП:</b> ${escapeTelegramHtml(application.legalOgrnip)}` : null,
    "",
    "Фото паспорта и чувствительные данные не отправляются в Telegram. Проверка доступна только в админке.",
    url ? `\n<a href="${escapeTelegramHtml(url)}">Открыть проверку в админке</a>` : null,
  ].filter(Boolean).join("\n");

  let sent = 0;
  for (const admin of admins) {
    if (!admin.telegramId) continue;
    try {
      const delivery = await sendTelegramMessageQueued({
        botToken,
        chatId: admin.telegramId.toString(),
        text,
        parseMode: "HTML",
        proxyUrl: process.env.TELEGRAM_PROXY_URL,
        recipientRole: "admin",
        recipientLabel: admin.name || admin.email || "admin",
        source: "company-verification",
        sourceId: application.uuid,
        priority: 20,
        throwOnFailure: false,
      });
      if (delivery.ok) sent += 1;
    } catch {
      // Keep application submission successful even if one admin notification fails.
    }
  }

  if (sent > 0) {
    await prisma.companyVerificationApplication.update({
      where: { uuid: application.uuid },
      data: { adminNotifiedAt: new Date() },
    });
  }

  return { sent, admins: admins.length };
}
