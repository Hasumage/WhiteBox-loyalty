import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailMessageTargetType } from "@prisma/client";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { EmailProvider } from "./email-provider";
import { ResendEmailProvider } from "./providers/resend-email.provider";
import { PrismaService } from "../prisma/prisma.service";

export type SendEmailInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  targetType?: EmailMessageTargetType;
  sentByUserId?: number | null;
  targetUserId?: number | null;
  targetCompanyId?: number | null;
};

type ResolvedEmailTransport = {
  provider: string;
  from: string;
  transporter: Transporter;
};

type SmtpOptionsWithNetworkTuning = SMTPTransport.Options & {
  family?: 4 | 6;
  dnsTimeout?: number;
};

type EmailLocale = "ru" | "en";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporters = new Map<string, Transporter>();
  private readonly httpProviders: EmailProvider[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.httpProviders = [new ResendEmailProvider(this.config)];
  }

  private getFromAddress() {
    return this.config.get<string>("MAIL_FROM") ?? "NearLoy <no-reply@nearloy.local>";
  }

  private isTruthyConfig(key: string) {
    const value = this.config.get<string>(key);
    if (value === undefined || value === null) return false;
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
  }

  private isProductionLikeRuntime() {
    const nodeEnv = String(this.config.get<string>("NODE_ENV") ?? process.env.NODE_ENV ?? "").toLowerCase();
    const railwayEnv = String(this.config.get<string>("RAILWAY_ENVIRONMENT") ?? process.env.RAILWAY_ENVIRONMENT ?? "").toLowerCase();
    return nodeEnv === "production" || railwayEnv === "production";
  }

  private isDeployedRuntime() {
    return Boolean(
      this.config.get<string>("RAILWAY_ENVIRONMENT") ||
        this.config.get<string>("RAILWAY_SERVICE_ID") ||
        this.config.get<string>("VERCEL") ||
        process.env.RAILWAY_ENVIRONMENT ||
        process.env.RAILWAY_SERVICE_ID ||
        process.env.VERCEL,
    );
  }

  private isDevOutboxEnabled() {
    const explicit = this.config.get<string>("EMAIL_DEV_OUTBOX_ENABLED");
    if (explicit !== undefined && explicit !== null) {
      return this.isTruthyConfig("EMAIL_DEV_OUTBOX_ENABLED");
    }
    return !this.isProductionLikeRuntime() && !this.isDeployedRuntime();
  }

  private getRecipientDomain(email: string) {
    return email.trim().toLowerCase().split("@").pop() ?? "";
  }

  private getRequestedProviderNames() {
    const raw = this.config.get<string>("EMAIL_PROVIDER")?.trim().toLowerCase() || "auto";
    const names = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (names.length === 0 || names.includes("auto")) {
      return ["resend", "smtp"];
    }
    return names;
  }

  private resolveHttpProviders(providerNames: string[]) {
    return this.httpProviders.filter((provider) => providerNames.includes(provider.name) && provider.isConfigured());
  }

  private isSmtpRequested(providerNames: string[]) {
    return providerNames.includes("smtp");
  }

  private getSmtpConfig(prefix: string) {
    const scoped = (key: string) => this.config.get<string>(`${prefix}_${key}`);
    const host = scoped("HOST");
    if (!host) return null;

    const port = Number(scoped("PORT") ?? 587);
    const secureRaw = String(scoped("SECURE") ?? "false").toLowerCase();
    const user = scoped("USER");
    const pass = scoped("PASS");

    return {
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: secureRaw === "true" || secureRaw === "1",
      auth: user && pass ? { user, pass } : undefined,
      from: scoped("FROM") ?? this.getFromAddress(),
    };
  }

  private getDefaultSmtpConfig() {
    const host = this.config.get<string>("SMTP_HOST");
    if (!host) return null;

    const port = Number(this.config.get("SMTP_PORT") ?? 587);
    const secureRaw = String(this.config.get("SMTP_SECURE") ?? "false").toLowerCase();
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");

    return {
      host,
      port: Number.isFinite(port) ? port : 587,
      secure: secureRaw === "true" || secureRaw === "1",
      auth: user && pass ? { user, pass } : undefined,
      from: this.getFromAddress(),
    };
  }

  private getSmtpTimeoutMs(key: string, fallback: number) {
    const raw = Number(this.config.get(key) ?? fallback);
    return Number.isFinite(raw) ? Math.max(1_000, Math.floor(raw)) : fallback;
  }

  private resolveTransports(toEmail: string): ResolvedEmailTransport[] {
    const domain = this.getRecipientDomain(toEmail);
    const russianDomains = new Set([
      "yandex.ru",
      "ya.ru",
      "mail.ru",
      "bk.ru",
      "inbox.ru",
      "list.ru",
      "internet.ru",
      "rambler.ru",
      "lenta.ru",
      "vk.com",
    ]);
    const googleDomains = new Set(["gmail.com", "googlemail.com"]);

    const providerOrder =
      russianDomains.has(domain)
        ? ["YANDEX_SMTP", "GOOGLE_SMTP", "SMTP"]
        : googleDomains.has(domain)
          ? ["GOOGLE_SMTP", "YANDEX_SMTP", "SMTP"]
          : ["GOOGLE_SMTP", "YANDEX_SMTP", "SMTP"];
    const transports: ResolvedEmailTransport[] = [];

    for (const provider of providerOrder) {
      const config = provider === "SMTP" ? this.getDefaultSmtpConfig() : this.getSmtpConfig(provider);
      if (!config) continue;

      const cacheKey = `${provider}:${config.host}:${config.port}:${config.secure ? "secure" : "plain"}`;
      let transporter = this.transporters.get(cacheKey);
      if (!transporter) {
        const options: SmtpOptionsWithNetworkTuning = {
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.auth,
          family: 4,
          connectionTimeout: this.getSmtpTimeoutMs("SMTP_CONNECTION_TIMEOUT_MS", 12_000),
          greetingTimeout: this.getSmtpTimeoutMs("SMTP_GREETING_TIMEOUT_MS", 12_000),
          socketTimeout: this.getSmtpTimeoutMs("SMTP_SOCKET_TIMEOUT_MS", 20_000),
          dnsTimeout: this.getSmtpTimeoutMs("SMTP_DNS_TIMEOUT_MS", 8_000),
          tls: { servername: config.host },
        };
        transporter = nodemailer.createTransport(options);
        this.transporters.set(cacheKey, transporter);
        this.logger.log(`SMTP email transport enabled: ${provider} (${config.host}:${config.port}).`);
      }

      transports.push({
        provider: provider.toLowerCase().replace("_smtp", ""),
        from: config.from,
        transporter,
      });
    }

    return transports;
  }

  async sendEmail(input: SendEmailInput) {
    const providerNames = this.getRequestedProviderNames();
    const httpProviders = this.resolveHttpProviders(providerNames);
    const transports = this.isSmtpRequested(providerNames) ? this.resolveTransports(input.toEmail) : [];
    const primaryProvider = httpProviders[0]?.name ?? transports[0]?.provider ?? "dev-outbox";
    const message = await this.prisma.emailMessage.create({
      data: {
        targetType: input.targetType ?? EmailMessageTargetType.DIRECT,
        toEmail: input.toEmail.trim().toLowerCase(),
        toName: input.toName?.trim() || null,
        subject: input.subject,
        bodyText: input.text,
        bodyHtml: input.html ?? null,
        sentByUserId: input.sentByUserId ?? null,
        targetUserId: input.targetUserId ?? null,
        targetCompanyId: input.targetCompanyId ?? null,
        provider: primaryProvider,
      },
    });

    if (httpProviders.length === 0 && transports.length === 0) {
      if (!this.isDevOutboxEnabled()) {
        const errorText = `Email delivery is not configured: no requested provider is available (${providerNames.join(", ")}).`;
        this.logger.error(`${errorText} Message ${message.uuid} -> ${message.toEmail}`);
        await this.prisma.emailMessage.update({
          where: { id: message.id },
          data: { status: "FAILED", error: errorText },
        });
        throw new ServiceUnavailableException(errorText);
      }
      if (process.env.NODE_ENV !== "test") {
        this.logger.log(`Email dev-outbox saved: ${message.uuid} -> ${message.toEmail}`);
      }
      return this.prisma.emailMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    const failures: string[] = [];
    let lastError: unknown = null;
    for (const provider of httpProviders) {
      try {
        const result = await provider.send({
          from: this.getFromAddress(),
          toEmail: input.toEmail,
          toName: input.toName,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });
        return this.prisma.emailMessage.update({
          where: { id: message.id },
          data: { status: "SENT", sentAt: new Date(), provider: result.provider },
        });
      } catch (error) {
        lastError = error;
        const errorText = error instanceof Error ? error.message : String(error);
        failures.push(`${provider.name}: ${errorText}`);
        this.logger.warn(`Email provider failed (${provider.name}) for ${message.uuid}: ${errorText}`);
      }
    }

    for (const transport of transports) {
      try {
        const result = await transport.transporter.sendMail({
          from: transport.from,
          to: input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail,
          subject: input.subject,
          text: input.text,
          html: input.html ?? undefined,
        });
        this.assertAcceptedBySmtp(result);
        return this.prisma.emailMessage.update({
          where: { id: message.id },
          data: { status: "SENT", sentAt: new Date(), provider: transport.provider },
        });
      } catch (error) {
        lastError = error;
        const errorText = error instanceof Error ? error.message : String(error);
        failures.push(`${transport.provider}: ${errorText}`);
        this.logger.warn(`Email transport failed (${transport.provider}) for ${message.uuid}: ${errorText}`);
      }
    }

    const errorText = failures.join(" | ") || "Email send failed.";
    this.logger.error(`Email send failed: ${message.uuid}. ${errorText}`);
    await this.prisma.emailMessage.update({
      where: { id: message.id },
      data: { status: "FAILED", error: errorText.slice(0, 2000) },
    });
    throw (lastError instanceof Error ? lastError : new Error(errorText));
  }

  private assertAcceptedBySmtp(result: unknown) {
    const info = result as { accepted?: unknown; rejected?: unknown };
    const rejected = Array.isArray(info.rejected) ? info.rejected.filter(Boolean) : [];
    if (rejected.length > 0) {
      throw new Error(`SMTP rejected recipient(s): ${rejected.join(", ")}`);
    }

    if (Object.prototype.hasOwnProperty.call(info, "accepted")) {
      const accepted = Array.isArray(info.accepted) ? info.accepted.filter(Boolean) : [];
      if (accepted.length === 0) {
        throw new Error("SMTP did not accept any recipients.");
      }
    }
  }

  async sendRegistrationCode(input: {
    toEmail: string;
    toName: string;
    code: string;
    expiresAt: Date;
    locale?: EmailLocale | string | null;
  }) {
    const minutes = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 60_000));
    const locale: EmailLocale = input.locale === "en" ? "en" : "ru";
    const subject = locale === "ru" ? "NearLoy: код подтверждения email" : "NearLoy: email confirmation code";
    const text =
      locale === "ru"
        ? [
            `Здравствуйте, ${input.toName}.`,
            "",
            `Код для завершения регистрации в NearLoy: ${input.code}`,
            `Код действует около ${minutes} мин.`,
            "Если вы не запрашивали это письмо, просто проигнорируйте его.",
          ].join("\n")
        : [
            `Hello, ${input.toName}!`,
            "",
            `Your NearLoy registration code: ${input.code}`,
            `It is valid for about ${minutes} minutes.`,
            "If you did not request this email, simply ignore it.",
          ].join("\n");
    const greeting =
      locale === "ru"
        ? `Здравствуйте, ${this.escapeHtml(input.toName)}.`
        : `Hello, ${this.escapeHtml(input.toName)}.`;
    const instruction =
      locale === "ru"
        ? "Введите этот код, чтобы завершить создание аккаунта NearLoy:"
        : "Use this code to finish creating your NearLoy account:";
    const footer =
      locale === "ru"
        ? `Код действует около ${minutes} мин. Если вы не запрашивали письмо, его можно проигнорировать.`
        : `The code is valid for about ${minutes} minutes. If you did not request this, you can ignore this email.`;
    const html = this.wrapHtml(`
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6">${greeting}</p>
      <p style="margin:0 0 20px;color:#cbd5e1;font-size:16px;line-height:1.6">${instruction}</p>
      <div style="letter-spacing:10px;font-size:38px;font-weight:800;color:#ffffff;background:#0b1220;border:1px solid rgba(103,232,249,.35);border-radius:18px;padding:22px 26px;text-align:center">${input.code}</div>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:14px;line-height:1.6">${footer}</p>
    `);
    return this.sendEmail({
      toEmail: input.toEmail,
      toName: input.toName,
      subject,
      text,
      html,
      targetType: EmailMessageTargetType.DIRECT,
    });
  }

  async sendPasswordResetCode(input: {
    toEmail: string;
    toName: string;
    code: string;
    expiresAt: Date;
    locale?: EmailLocale | string | null;
  }) {
    const minutes = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 60_000));
    const locale: EmailLocale = input.locale === "en" ? "en" : "ru";
    const subject =
      locale === "ru" ? "NearLoy: код восстановления пароля" : "NearLoy: password reset code";
    const text =
      locale === "ru"
        ? [
            `Здравствуйте, ${input.toName}.`,
            "",
            `Код для смены пароля NearLoy: ${input.code}`,
            `Код действует около ${minutes} мин.`,
            "Если вы не запрашивали смену пароля, просто проигнорируйте письмо.",
          ].join("\n")
        : [
            `Hello, ${input.toName}.`,
            "",
            `Your NearLoy password reset code: ${input.code}`,
            `It is valid for about ${minutes} minutes.`,
            "If you did not request a password reset, simply ignore this email.",
          ].join("\n");
    const greeting =
      locale === "ru"
        ? `Здравствуйте, ${this.escapeHtml(input.toName)}.`
        : `Hello, ${this.escapeHtml(input.toName)}.`;
    const instruction =
      locale === "ru"
        ? "Введите этот код, чтобы задать новый пароль NearLoy:"
        : "Use this code to set a new NearLoy password:";
    const footer =
      locale === "ru"
        ? `Код действует около ${minutes} мин. Если вы не запрашивали смену пароля, письмо можно проигнорировать.`
        : `The code is valid for about ${minutes} minutes. If you did not request this, you can ignore this email.`;
    const html = this.wrapHtml(`
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6">${greeting}</p>
      <p style="margin:0 0 20px;color:#cbd5e1;font-size:16px;line-height:1.6">${instruction}</p>
      <div style="letter-spacing:10px;font-size:38px;font-weight:800;color:#ffffff;background:#0b1220;border:1px solid rgba(103,232,249,.35);border-radius:18px;padding:22px 26px;text-align:center">${input.code}</div>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:14px;line-height:1.6">${footer}</p>
    `);
    return this.sendEmail({
      toEmail: input.toEmail,
      toName: input.toName,
      subject,
      text,
      html,
      targetType: EmailMessageTargetType.DIRECT,
    });
  }

  async sendAdminMessage(input: {
    toEmail: string;
    toName?: string | null;
    subject: string;
    message: string;
    sentByUserId: number;
    targetType: EmailMessageTargetType;
    targetUserId?: number | null;
    targetCompanyId?: number | null;
  }) {
    const safeMessage = this.escapeHtml(input.message).replace(/\n/g, "<br />");
    return this.sendEmail({
      toEmail: input.toEmail,
      toName: input.toName,
      subject: input.subject,
      text: input.message,
      html: this.wrapHtml(`<p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.7">${safeMessage}</p>`),
      targetType: input.targetType,
      sentByUserId: input.sentByUserId,
      targetUserId: input.targetUserId,
      targetCompanyId: input.targetCompanyId,
    });
  }

  async sendEmailChangeConfirmation(input: {
    toEmail: string;
    toName: string;
    confirmUrl: string;
    expiresAt: Date;
    sentByUserId: number;
    targetUserId: number;
  }) {
    const subject = "NearLoy: confirm account email change";
    const text = [
      `Hello, ${input.toName}.`,
      "",
      "A NearLoy administrator started an email recovery flow for your account.",
      `Confirm the new email here: ${input.confirmUrl}`,
      `The link expires at ${input.expiresAt.toISOString()}.`,
    ].join("\n");
    return this.sendEmail({
      toEmail: input.toEmail,
      toName: input.toName,
      subject,
      text,
      html: this.wrapHtml(`
        <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6">A NearLoy administrator started a secure email recovery flow for your account.</p>
        <a href="${this.escapeHtml(input.confirmUrl)}" style="display:inline-block;background:#ffffff;color:#020617;text-decoration:none;border-radius:16px;padding:14px 20px;font-weight:800">Confirm new email</a>
        <p style="margin:18px 0 0;color:#94a3b8;font-size:14px;line-height:1.6">If the button does not open, copy this link: ${this.escapeHtml(input.confirmUrl)}</p>
      `),
      targetType: EmailMessageTargetType.USER,
      sentByUserId: input.sentByUserId,
      targetUserId: input.targetUserId,
    });
  }

  private wrapHtml(content: string) {
    return `<!doctype html><html><body style="margin:0;background:#020617;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#fff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><div style="max-width:560px;background:linear-gradient(145deg,#08111f,#0f172a);border:1px solid rgba(103,232,249,.22);border-radius:28px;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.45)"><div style="font-size:22px;font-weight:800;margin-bottom:24px">NearLoy</div>${content}</div></td></tr></table></body></html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
