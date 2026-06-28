import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CompanyMemberRole, PaymentPurpose, PaymentStatus, Prisma, SubscriptionBundleStatus, SubscriptionStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { PrismaService } from "../prisma/prisma.service";
import { RegisteredService } from "../registered/registered.service";
import { assertSubscriptionsEnabled } from "../common/subscriptions-feature";
import { YooKassaPaymentObject, YooKassaService } from "./yookassa.service";

function money(value: Prisma.Decimal | number | string) {
  return Number(value).toFixed(2);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapProviderStatus(status: string | undefined): PaymentStatus {
  if (status === "succeeded") return PaymentStatus.SUCCEEDED;
  if (status === "waiting_for_capture") return PaymentStatus.WAITING_FOR_CAPTURE;
  if (status === "canceled") return PaymentStatus.CANCELED;
  if (status === "pending") return PaymentStatus.PENDING;
  return PaymentStatus.FAILED;
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "без ограничения срока";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(value);
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaService,
    private readonly registeredService: RegisteredService,
  ) {}

  private appReturnUrl(paymentUuid: string) {
    const configured = process.env.YOOKASSA_RETURN_URL || process.env.TELEGRAM_WEB_APP_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000";
    const normalized = configured.trim().replace(/\/+$/, "");
    let base = normalized;

    try {
      const url = new URL(normalized);
      base = url.origin;
    } catch {
      base = normalized.replace(/\/payment\/success(?:\/.*)?$/i, "");
    }

    return `${base}/payment/success?payment=${encodeURIComponent(paymentUuid)}`;
  }

  private companyBillingReturnUrl(paymentUuid: string) {
    const configured = process.env.YOOKASSA_COMPANY_RETURN_URL || process.env.FRONTEND_ORIGIN || process.env.TELEGRAM_WEB_APP_URL || "http://localhost:3000";
    const normalized = configured.trim().replace(/\/+$/, "");
    let base = normalized;

    try {
      const url = new URL(normalized);
      base = url.origin;
    } catch {
      base = normalized
        .replace(/\/company\/billing(?:\/.*)?$/i, "")
        .replace(/\/payment\/success(?:\/.*)?$/i, "");
    }

    return `${base}/company/billing?payment=${encodeURIComponent(paymentUuid)}`;
  }

  async createCompanyBillingCheckout(userId: number) {
    if (!this.yookassa.isConfigured()) {
      throw new BadRequestException("YooKassa is not configured. Payment checkout is unavailable.");
    }

    const member = await this.prisma.companyMember.findFirst({
      where: {
        userId,
        isActive: true,
        role: { in: [CompanyMemberRole.OWNER, CompanyMemberRole.MANAGER] },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });
    if (!member) throw new NotFoundException("Company account not found.");

    const invoice = await this.prisma.companyBillingInvoice.findFirst({
      where: { companyId: member.companyId, status: "OPEN", amountDue: { gt: 0 } },
      orderBy: { periodStartsAt: "desc" },
    });
    if (!invoice) {
      const latestInvoice = await this.prisma.companyBillingInvoice.findFirst({
        where: { companyId: member.companyId },
        orderBy: { periodStartsAt: "desc" },
      });
      if (latestInvoice?.status === "PAID" || latestInvoice?.status === "WAIVED") {
        throw new BadRequestException("Текущая подписка NearLoy уже оплачена.");
      }
      throw new BadRequestException("Сейчас нет счёта на оплату подписки NearLoy.");
    }

    const invoicePayments = await this.prisma.payment.findMany({
      where: {
        companyId: member.companyId,
        purpose: PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.WAITING_FOR_CAPTURE, PaymentStatus.SUCCEEDED] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const existingPayment = invoicePayments.find((payment) => {
      const metadata = payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
        ? payment.metadata as Record<string, unknown>
        : {};
      return metadata.invoiceUuid === invoice.uuid;
    });

    if (existingPayment?.status === PaymentStatus.SUCCEEDED) {
      throw new BadRequestException("Текущая подписка NearLoy уже оплачена.");
    }
    if (existingPayment && existingPayment.confirmationUrl) {
      return this.serializePayment(existingPayment);
    }

    return this.createProviderPayment({
      user: member.user,
      purpose: PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION,
      amount: invoice.amountDue,
      description: `NearLoy company subscription: ${member.company.name}`,
      companyId: member.companyId,
      metadata: {
        companyId: String(member.companyId),
        invoiceUuid: invoice.uuid,
        planType: "company-nearloy-subscription",
      },
      returnUrlKind: "company",
    });
  }

  async createUserSubscriptionCheckout(userId: number, planUuid: string) {
    assertSubscriptionsEnabled();
    if (!this.yookassa.isConfigured()) {
      throw new BadRequestException("YooKassa is not configured. Payment checkout is unavailable.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
    if (!user) throw new NotFoundException("User not found.");

    const subscription = await this.prisma.subscription.findUnique({
      where: { uuid: planUuid },
      include: {
        company: { select: { id: true, isActive: true, name: true } },
        entitlements: { where: { isActive: true }, select: { id: true } },
      },
    });

    if (subscription && subscription.isActive && (!subscription.company || subscription.company.isActive)) {
      if (subscription.entitlements.length === 0) throw new BadRequestException("Subscription has no active services.");
      await this.assertNoActiveOrdinarySubscription(userId, subscription.id);
      return this.createProviderPayment({
        user,
        purpose: PaymentPurpose.USER_SUBSCRIPTION,
        amount: subscription.price,
        description: `NearLoy subscription: ${subscription.name}`,
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        metadata: { planUuid: subscription.uuid, planType: "subscription" },
      });
    }

    const bundle = await this.prisma.subscriptionBundle.findUnique({
      where: { uuid: planUuid },
      include: {
        participants: {
          include: { company: { select: { id: true, isActive: true } } },
        },
      },
    });
    if (
      !bundle ||
      !bundle.isActive ||
      bundle.status !== SubscriptionBundleStatus.ACTIVE ||
      bundle.participants.length < 2 ||
      bundle.participants.some((participant) => !participant.company.isActive)
    ) {
      throw new NotFoundException("Active subscription not found.");
    }
    await this.assertNoActiveBundleSubscription(userId, bundle.id);
    return this.createProviderPayment({
      user,
      purpose: PaymentPurpose.USER_SUBSCRIPTION_BUNDLE,
      amount: bundle.price,
      description: `NearLoy paired subscription: ${bundle.name}`,
      subscriptionBundleId: bundle.id,
      companyId: bundle.proposedByCompanyId ?? bundle.participants[0]?.companyId ?? null,
      metadata: { planUuid: bundle.uuid, planType: "bundle" },
    });
  }

  private async assertNoActiveOrdinarySubscription(userId: number, subscriptionId: number) {
    const existing = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("Subscription is already active.");
  }

  private async assertNoActiveBundleSubscription(userId: number, bundleId: number) {
    const existing = await this.prisma.userSubscriptionBundle.findFirst({
      where: {
        userId,
        bundleId,
        status: SubscriptionStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("Subscription is already active.");
  }

  private async createProviderPayment(input: {
    user: { id: number; email: string; name: string };
    purpose: PaymentPurpose;
    amount: Prisma.Decimal | number | string;
    description: string;
    subscriptionId?: number;
    subscriptionBundleId?: number;
    companyId?: number | null;
    metadata: Record<string, string>;
    returnUrlKind?: "user" | "company";
  }) {
    const idempotenceKey = randomUUID();
    const created = await this.prisma.payment.create({
      data: {
        userId: input.user.id,
        companyId: input.companyId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        subscriptionBundleId: input.subscriptionBundleId ?? null,
        purpose: input.purpose,
        amount: new Prisma.Decimal(input.amount),
        currency: "RUB",
        description: input.description,
        idempotenceKey,
        status: PaymentStatus.PENDING,
        metadata: toJson(input.metadata),
      },
    });

    const returnUrl = input.returnUrlKind === "company"
      ? this.companyBillingReturnUrl(created.uuid)
      : this.appReturnUrl(created.uuid);
    const { payment } = await this.yookassa.createPayment({
      amount: money(input.amount),
      currency: "RUB",
      description: input.description,
      customerEmail: input.user.email,
      idempotenceKey,
      returnUrl,
      metadata: {
        nearloyPaymentUuid: created.uuid,
        nearloyUserId: String(input.user.id),
        ...input.metadata,
      },
    });

    const next = await this.prisma.payment.update({
      where: { id: created.id },
      data: {
        providerPaymentId: payment.id,
        providerStatus: payment.status,
        status: mapProviderStatus(payment.status),
        confirmationUrl: payment.confirmation?.confirmation_url ?? null,
        returnUrl,
        providerPayload: toJson(payment),
      },
    });

    return this.serializePayment(next);
  }

  async handleYooKassaWebhook(body: unknown) {
    const object = this.extractPaymentObject(body);
    if (!object?.id) return { ok: true, ignored: true };
    const verified = await this.yookassa.getPayment(object.id);
    await this.syncProviderPayment(verified);
    return { ok: true };
  }

  async syncProviderPayment(providerPaymentIdOrObject: string | YooKassaPaymentObject) {
    const providerPayment = typeof providerPaymentIdOrObject === "string"
      ? await this.yookassa.getPayment(providerPaymentIdOrObject)
      : providerPaymentIdOrObject;
    if (!providerPayment.id) throw new BadRequestException("YooKassa payment id is missing.");

    const payment = await this.prisma.payment.findUnique({ where: { providerPaymentId: providerPayment.id } });
    if (!payment) return null;

    const status = mapProviderStatus(providerPayment.status);
    const amountValue = Number(providerPayment.amount?.value ?? payment.amount);
    if (Number.isFinite(amountValue) && Math.abs(amountValue - Number(payment.amount)) > 0.01) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerStatus: providerPayment.status,
          providerPayload: toJson(providerPayment),
          cancelReason: "Provider amount does not match local payment amount.",
        },
      });
      throw new BadRequestException("Provider payment amount mismatch.");
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        providerStatus: providerPayment.status,
        providerPayload: toJson(providerPayment),
        paidAt: status === PaymentStatus.SUCCEEDED ? new Date() : payment.paidAt,
        canceledAt: status === PaymentStatus.CANCELED ? new Date() : payment.canceledAt,
        cancelReason: providerPayment.cancellation_details?.reason ?? payment.cancelReason,
      },
    });

    if (status === PaymentStatus.SUCCEEDED) {
      if (updated.purpose === PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION) {
        await this.activatePaidCompanyBilling(updated.id);
      } else {
        await this.activatePaidSubscription(updated.id);
      }
    }
    return updated;
  }

  private async activatePaidCompanyBilling(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) return null;
    if (payment.purpose !== PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION) return payment;
    if (!payment.companyId) return payment;

    const metadata = payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? payment.metadata as Record<string, unknown>
      : {};
    const invoiceUuid = typeof metadata.invoiceUuid === "string" ? metadata.invoiceUuid : null;

    return this.prisma.$transaction(async (tx) => {
      const invoice = invoiceUuid
        ? await tx.companyBillingInvoice.findFirst({ where: { uuid: invoiceUuid, companyId: payment.companyId! } })
        : await tx.companyBillingInvoice.findFirst({
          where: { companyId: payment.companyId!, status: "OPEN" },
          orderBy: { periodStartsAt: "desc" },
        });

      if (!invoice || invoice.status === "PAID" || invoice.status === "WAIVED") return payment;

      await tx.companyBillingInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAmount: payment.amount,
          paidAt: payment.paidAt ?? new Date(),
        },
      });

      await tx.companyBillingAccount.upsert({
        where: { companyId: invoice.companyId },
        create: {
          companyId: invoice.companyId,
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodStartsAt: invoice.periodStartsAt,
          currentPeriodEndsAt: invoice.periodEndsAt,
        },
        update: {
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodStartsAt: invoice.periodStartsAt,
          currentPeriodEndsAt: invoice.periodEndsAt,
        },
      });

      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async activatePaidSubscription(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: { select: { uuid: true } },
        subscriptionBundle: { select: { uuid: true } },
      },
    });
    if (!payment || payment.status !== PaymentStatus.SUCCEEDED) return null;
    if (payment.userSubscriptionId || payment.userSubscriptionBundleId) return payment;

    const planUuid = payment.subscription?.uuid ?? payment.subscriptionBundle?.uuid;
    if (!planUuid) throw new NotFoundException("Paid subscription target not found.");

    const activated = await this.registeredService.activateSubscription(payment.userId, planUuid);
    if (payment.purpose === PaymentPurpose.USER_SUBSCRIPTION_BUNDLE) {
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { userSubscriptionBundleId: activated.id },
      });
      await this.notifyUserAboutSuccessfulPayment(updated.id).catch(() => undefined);
      return updated;
    }
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { userSubscriptionId: activated.id },
    });
    await this.notifyUserAboutSuccessfulPayment(updated.id).catch(() => undefined);
    return updated;
  }

  private async notifyUserAboutSuccessfulPayment(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: { select: { telegramId: true, name: true } },
        subscription: { select: { name: true } },
        subscriptionBundle: { select: { name: true } },
        userSubscription: { select: { expiresAt: true } },
        userSubscriptionBundle: { select: { expiresAt: true } },
      },
    });
    if (!payment?.user.telegramId) return;

    const planName = payment.subscription?.name ?? payment.subscriptionBundle?.name ?? "подписка NearLoy";
    const expiresAt = payment.userSubscription?.expiresAt ?? payment.userSubscriptionBundle?.expiresAt ?? null;
    const text = [
      "Спасибо за покупку!",
      "",
      `Подписка «${planName}» успешно подключена.`,
      `Действует до: ${formatDateTime(expiresAt)}.`,
      "",
      "Откройте NearLoy и покажите QR-код партнёру, когда захотите воспользоваться услугой.",
    ].join("\n");

    await this.sendTelegramMessageOrQueue({
      chatId: payment.user.telegramId.toString(),
      text,
      recipientLabel: payment.user.name,
      source: "payment-success",
      sourceId: payment.uuid,
    });
  }

  private async sendTelegramMessageOrQueue(params: {
    chatId: string;
    text: string;
    recipientLabel: string;
    source: string;
    sourceId: string;
  }) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      const proxyUrl = process.env.TELEGRAM_PROXY_URL;
      const response = await undiciFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          chat_id: params.chatId,
          text: params.text,
          disable_web_page_preview: true,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.telegramMessageQueue.create({
        data: {
          recipientChatId: params.chatId,
          recipientLabel: params.recipientLabel,
          text: params.text,
          status: "FAILED",
          attempts: 1,
          lastError: message.length > 1800 ? `${message.slice(0, 1800)}...` : message,
          nextRetryAt: new Date(Date.now() + 60_000),
          source: params.source,
          sourceId: params.sourceId,
          priority: 1,
        },
      });
    }
  }

  private findUserPayment(userId: number, uuid: string) {
    return this.prisma.payment.findFirst({
      where: { userId, uuid },
      include: {
        subscription: { select: { uuid: true, name: true, renewalValue: true, renewalUnit: true } },
        subscriptionBundle: { select: { uuid: true, name: true, renewalValue: true, renewalUnit: true } },
        userSubscription: { select: { id: true, status: true, activatedAt: true, expiresAt: true } },
        userSubscriptionBundle: { select: { id: true, status: true, activatedAt: true, expiresAt: true } },
      },
    });
  }

  async getUserPayment(userId: number, uuid: string) {
    let payment = await this.findUserPayment(userId, uuid);
    if (!payment) throw new NotFoundException("Payment not found.");
    if (payment.providerPaymentId && payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.CANCELED) {
      await this.syncProviderPayment(payment.providerPaymentId);
      payment = await this.findUserPayment(userId, uuid);
      if (!payment) throw new NotFoundException("Payment not found.");
    }
    if (payment.status === PaymentStatus.SUCCEEDED && !payment.userSubscriptionId && !payment.userSubscriptionBundleId) {
      await this.activatePaidSubscription(payment.id);
      payment = await this.findUserPayment(userId, uuid);
      if (!payment) throw new NotFoundException("Payment not found.");
    }
    return this.serializePayment(payment);
  }

  private async findCompanyBillingPayment(userId: number, uuid: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: {
        userId,
        isActive: true,
        role: { in: [CompanyMemberRole.OWNER, CompanyMemberRole.MANAGER] },
      },
      select: { companyId: true },
    });
    if (!member) throw new NotFoundException("Company account not found.");

    const payment = await this.prisma.payment.findFirst({
      where: {
        uuid,
        companyId: member.companyId,
        purpose: PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION,
      },
    });
    if (!payment) throw new NotFoundException("Payment not found.");
    return payment;
  }

  async getCompanyBillingPayment(userId: number, uuid: string) {
    let payment = await this.findCompanyBillingPayment(userId, uuid);

    if (payment.providerPaymentId && payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.CANCELED) {
      await this.syncProviderPayment(payment.providerPaymentId);
      payment = await this.findCompanyBillingPayment(userId, uuid);
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      await this.activatePaidCompanyBilling(payment.id);
      payment = await this.findCompanyBillingPayment(userId, uuid);
    }

    return this.serializePayment(payment);
  }

  async listAdminPayments(options: { query?: string; status?: PaymentStatus; page?: number; limit?: number }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(options.limit) || 20));
    const skip = (page - 1) * limit;
    const query = options.query?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(query
        ? {
            OR: [
              { uuid: { contains: query, mode: "insensitive" } },
              { providerPaymentId: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { user: { email: { contains: query, mode: "insensitive" } } },
              { user: { name: { contains: query, mode: "insensitive" } } },
              { subscription: { name: { contains: query, mode: "insensitive" } } },
              { subscriptionBundle: { name: { contains: query, mode: "insensitive" } } },
              { company: { name: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total, summaryRows] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          user: { select: { uuid: true, name: true, email: true } },
          company: { select: { slug: true, name: true } },
          subscription: { select: { uuid: true, name: true } },
          subscriptionBundle: { select: { uuid: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
    ]);

    const summary = summaryRows.reduce(
      (acc, row) => {
        acc.byStatus[row.status] = row._count;
        if (row.status === PaymentStatus.SUCCEEDED) acc.succeededAmount += Number(row._sum.amount ?? 0);
        return acc;
      },
      { byStatus: {} as Record<string, number>, succeededAmount: 0 },
    );

    return {
      items: items.map((item) => ({
        uuid: item.uuid,
        provider: item.provider,
        purpose: item.purpose,
        status: item.status,
        amount: money(item.amount),
        currency: item.currency,
        description: item.description,
        providerPaymentId: item.providerPaymentId,
        providerStatus: item.providerStatus,
        confirmationUrl: item.confirmationUrl,
        paidAt: item.paidAt,
        canceledAt: item.canceledAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        user: item.user,
        company: item.company,
        plan: item.subscription
          ? { type: "subscription", uuid: item.subscription.uuid, name: item.subscription.name }
          : item.subscriptionBundle
            ? { type: "bundle", uuid: item.subscriptionBundle.uuid, name: item.subscriptionBundle.name }
            : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: {
        succeededAmount: summary.succeededAmount.toFixed(2),
        pending: summary.byStatus[PaymentStatus.PENDING] ?? 0,
        waitingForCapture: summary.byStatus[PaymentStatus.WAITING_FOR_CAPTURE] ?? 0,
        succeeded: summary.byStatus[PaymentStatus.SUCCEEDED] ?? 0,
        canceled: summary.byStatus[PaymentStatus.CANCELED] ?? 0,
        failed: summary.byStatus[PaymentStatus.FAILED] ?? 0,
        refunded: summary.byStatus[PaymentStatus.REFUNDED] ?? 0,
      },
    };
  }

  private extractPaymentObject(body: unknown): YooKassaPaymentObject | null {
    if (!body || typeof body !== "object") return null;
    const candidate = body as { object?: unknown };
    return candidate.object && typeof candidate.object === "object" ? (candidate.object as YooKassaPaymentObject) : null;
  }

  private serializePayment(payment: {
    uuid: string;
    status: PaymentStatus;
    amount: Prisma.Decimal | number | string;
    currency: string;
    confirmationUrl: string | null;
    providerPaymentId: string | null;
    providerStatus: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    subscription?: { uuid: string; name: string; renewalValue: number; renewalUnit: string } | null;
    subscriptionBundle?: { uuid: string; name: string; renewalValue: number; renewalUnit: string } | null;
    userSubscription?: { id: number; status: SubscriptionStatus; activatedAt: Date; expiresAt: Date | null } | null;
    userSubscriptionBundle?: { id: number; status: SubscriptionStatus; activatedAt: Date; expiresAt: Date | null } | null;
  }) {
    const plan = payment.subscription
      ? { type: "subscription", ...payment.subscription }
      : payment.subscriptionBundle
        ? { type: "bundle", ...payment.subscriptionBundle }
        : null;
    const activatedSubscription = payment.userSubscription ?? payment.userSubscriptionBundle ?? null;
    return {
      uuid: payment.uuid,
      status: payment.status,
      amount: money(payment.amount),
      currency: payment.currency,
      confirmationUrl: payment.confirmationUrl,
      providerPaymentId: payment.providerPaymentId,
      providerStatus: payment.providerStatus,
      paidAt: payment.paidAt,
      plan,
      activatedSubscription,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}

