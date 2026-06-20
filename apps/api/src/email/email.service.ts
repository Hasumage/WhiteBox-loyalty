import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailMessageTargetType } from "@prisma/client";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporters = new Map<string, Transporter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getFromAddress() {
    return this.config.get<string>("MAIL_FROM") ?? "NearLoy <no-reply@nearloy.local>";
  }

  private getRecipientDomain(email: string) {
    return email.trim().toLowerCase().split("@").pop() ?? "";
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

  private resolveTransport(toEmail: string) {
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
        ? ["YANDEX_SMTP", "SMTP"]
        : googleDomains.has(domain)
          ? ["GOOGLE_SMTP", "SMTP"]
          : ["GOOGLE_SMTP", "YANDEX_SMTP", "SMTP"];

    for (const provider of providerOrder) {
      const config = provider === "SMTP" ? this.getDefaultSmtpConfig() : this.getSmtpConfig(provider);
      if (!config) continue;

      const cacheKey = `${provider}:${config.host}:${config.port}:${config.secure ? "secure" : "plain"}`;
      let transporter = this.transporters.get(cacheKey);
      if (!transporter) {
        transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.auth,
        });
        this.transporters.set(cacheKey, transporter);
        this.logger.log(`SMTP email transport enabled: ${provider} (${config.host}:${config.port}).`);
      }

      return {
        provider: provider.toLowerCase().replace("_smtp", ""),
        from: config.from,
        transporter,
      };
    }

    return null;
  }

  async sendEmail(input: SendEmailInput) {
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
        provider: this.resolveTransport(input.toEmail)?.provider ?? "dev-outbox",
      },
    });

    const transport = this.resolveTransport(input.toEmail);
    if (!transport) {
      if (process.env.NODE_ENV !== "test") {
        this.logger.log(`Email dev-outbox saved: ${message.uuid} -> ${message.toEmail}`);
      }
      return this.prisma.emailMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    try {
      await transport.transporter.sendMail({
        from: transport.from,
        to: input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail,
        subject: input.subject,
        text: input.text,
        html: input.html ?? undefined,
      });
      return this.prisma.emailMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email send failed: ${message.uuid}`, error as Error);
      await this.prisma.emailMessage.update({
        where: { id: message.id },
        data: { status: "FAILED", error: errorText.slice(0, 2000) },
      });
      throw error;
    }
  }

  async sendRegistrationCode(input: {
    toEmail: string;
    toName: string;
    code: string;
    expiresAt: Date;
  }) {
    const minutes = Math.max(1, Math.round((input.expiresAt.getTime() - Date.now()) / 60_000));
    const subject = "NearLoy: email confirmation code";
    const text = [
      `Hello, ${input.toName}!`,
      "",
      `Your NearLoy registration code: ${input.code}`,
      `It is valid for about ${minutes} minutes.`,
      "If you did not request this email, simply ignore it.",
    ].join("\n");
    const html = this.wrapHtml(`
      <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.6">Hello, ${this.escapeHtml(input.toName)}.</p>
      <p style="margin:0 0 20px;color:#cbd5e1;font-size:16px;line-height:1.6">Use this code to finish creating your NearLoy account:</p>
      <div style="letter-spacing:10px;font-size:38px;font-weight:800;color:#ffffff;background:#0b1220;border:1px solid rgba(103,232,249,.35);border-radius:18px;padding:22px 26px;text-align:center">${input.code}</div>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:14px;line-height:1.6">The code is valid for about ${minutes} minutes. If you did not request this, you can ignore this email.</p>
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
