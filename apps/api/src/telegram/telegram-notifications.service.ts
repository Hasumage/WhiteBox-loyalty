import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationDeliveryStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type TelegramUserRecipient = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  telegramId: bigint | null;
};

type SendOptions = {
  source: string;
  sourceId?: string | number | null;
  priority?: number;
};

@Injectable()
export class TelegramNotificationsService {
  private readonly logger = new Logger(TelegramNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async notifyPointsAwarded(userId: number, companyName: string, points: number, balance?: number | null) {
    if (points <= 0) return;
    const balanceLine = typeof balance === "number" ? `\nБаланс: <b>${balance}</b>` : "";
    await this.sendToUser(
      userId,
      `✨ Вам начислили <b>${points}</b> балл${this.pointsSuffix(points)} в ${this.escape(companyName)}.${balanceLine}`,
      { source: "loyalty-points-awarded", sourceId: `${userId}:${companyName}`, priority: 5 },
    );
  }

  async notifyPointsSpent(userId: number, companyName: string, points: number, balance?: number | null) {
    if (points <= 0) return;
    const balanceLine = typeof balance === "number" ? `\nОсталось: <b>${balance}</b>` : "";
    await this.sendToUser(
      userId,
      `💳 Списано <b>${points}</b> балл${this.pointsSuffix(points)} в ${this.escape(companyName)}.${balanceLine}`,
      { source: "loyalty-points-spent", sourceId: `${userId}:${companyName}`, priority: 5 },
    );
  }

  async notifyPasswordChanged(userId: number) {
    await this.sendToUser(
      userId,
      "🔐 Пароль NearLoy изменён. Если это были не вы — сразу восстановите доступ и напишите поддержке.",
      { source: "password-changed", sourceId: userId, priority: 30 },
    );
  }

  async notifyPrCompanyAssigned(prUserId: number, companyName: string, percent?: number | null) {
    const percentLine = Number.isFinite(Number(percent)) ? `\nPR-доля: <b>${Number(percent).toFixed(2)}%</b>` : "";
    await this.sendToUser(
      prUserId,
      `🤝 К вам привязана новая компания: <b>${this.escape(companyName)}</b>.${percentLine}`,
      { source: "pr-company-assigned", sourceId: `${prUserId}:${companyName}`, priority: 20 },
    );
  }

  async notifyPrCompanyUnassigned(prUserId: number, companyName: string) {
    await this.sendToUser(
      prUserId,
      `↩️ Компания <b>${this.escape(companyName)}</b> больше не привязана к вам.`,
      { source: "pr-company-unassigned", sourceId: `${prUserId}:${companyName}`, priority: 20 },
    );
  }

  async notifyUsers(userIds: number[], text: string, options: SendOptions) {
    const uniqueIds = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
    await Promise.all(uniqueIds.map((userId) => this.sendToUser(userId, text, options)));
  }

  private async sendToUser(userId: number, text: string, options: SendOptions) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, telegramId: true },
    });
    if (!recipient?.telegramId) return;
    await this.sendToRecipient(recipient, text, options);
  }

  private async sendToRecipient(recipient: TelegramUserRecipient, text: string, options: SendOptions) {
    const chatId = recipient.telegramId?.toString();
    if (!chatId) return;
    const botToken = this.botToken();
    if (!botToken) {
      await this.queue(recipient, text, options, "Telegram bot token is not configured.");
      return;
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram ${response.status}: ${body.slice(0, 240)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Telegram delivery failed.";
      this.logger.warn(`Queued Telegram notification for ${recipient.email}: ${message}`);
      await this.queue(recipient, text, options, message);
    }
  }

  private async queue(recipient: TelegramUserRecipient, text: string, options: SendOptions, error: string) {
    await this.prisma.telegramMessageQueue.create({
      data: {
        recipientChatId: recipient.telegramId?.toString() ?? "",
        recipientRole: recipient.role,
        recipientLabel: `${recipient.name} · ${recipient.email}`,
        text,
        parseMode: "HTML",
        status: NotificationDeliveryStatus.PENDING,
        source: options.source,
        sourceId: options.sourceId === undefined || options.sourceId === null ? null : String(options.sourceId),
        priority: options.priority ?? 0,
        lastError: error.slice(0, 500),
      },
    });
  }

  private botToken() {
    const isProduction = this.config.get("NODE_ENV") === "production";
    const primary = isProduction ? "TELEGRAM_BOT_TOKEN" : "TELEGRAM_DEV_BOT_TOKEN";
    const secondary = isProduction ? "TELEGRAM_DEV_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN";
    return this.config.get<string>(primary) ?? this.config.get<string>(secondary) ?? process.env[primary] ?? process.env[secondary] ?? null;
  }

  private pointsSuffix(points: number) {
    const absolute = Math.abs(points);
    const last = absolute % 10;
    const lastTwo = absolute % 100;
    if (last === 1 && lastTwo !== 11) return "";
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "а";
    return "ов";
  }

  private escape(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
