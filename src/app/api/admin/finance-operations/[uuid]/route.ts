import { NextResponse, type NextRequest } from "next/server";
import type { FinanceOperationStatus, Prisma } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { resolveEffectivePermission } from "@/lib/admin/access-control";
import { calculateCompanyReferralPayoutCoverage } from "@/lib/company-referrals/company-referrals";
import { calculateCompanyFinancialSnapshot, evaluatePayoutCoverage } from "@/lib/finance/company-finance";
import { notifyAdminsAboutFinanceOperationStatusChange } from "@/lib/finance/finance-operation-notifications";
import { appendFinanceDecisionNote, isReferralPayout } from "@/lib/finance/payout-operations";
import {
  createYooKassaPayout,
  getYooKassaPayout,
  mapYooKassaPayoutStatus,
  type YooKassaPayoutObject,
  type YooKassaPayoutDestination,
} from "@/lib/finance/yookassa-payouts";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const APPROVAL_STATUSES = new Set<FinanceOperationStatus>(["APPROVED", "REJECTED", "PAID", "CANCELED"]);

const operationInclude = {
  company: {
    select: {
      id: true,
      slug: true,
      name: true,
      payoutBankName: true,
      payoutBik: true,
      payoutAccount: true,
      payoutCorrespondentAccount: true,
      payoutCardLast4: true,
    },
  },
  requestedBy: { select: { id: true, uuid: true, email: true, name: true } },
  approvedBy: { select: { id: true, uuid: true, email: true, name: true } },
} satisfies Prisma.FinanceOperationInclude;

type FinanceOperationRow = Prisma.FinanceOperationGetPayload<{ include: typeof operationInclude }>;

type PatchBody = {
  status?: FinanceOperationStatus;
  providerAction?: "SYNC";
  payoutMode?: "MANUAL" | "YOOKASSA";
  destinationType?: "bank_card" | "yoo_money";
  cardNumber?: string;
  yooMoneyWallet?: string;
  manualMethod?: string;
  manualReference?: string;
  manualComment?: string;
  processedAt?: string;
};

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function readDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readDestination(body: PatchBody): YooKassaPayoutDestination | null {
  const destinationType = body.destinationType ?? (body.cardNumber ? "bank_card" : body.yooMoneyWallet ? "yoo_money" : null);
  if (destinationType === "bank_card" && body.cardNumber) {
    return { type: "bank_card", cardNumber: body.cardNumber };
  }
  if (destinationType === "yoo_money" && body.yooMoneyWallet) {
    return { type: "yoo_money", accountNumber: body.yooMoneyWallet };
  }
  return null;
}

function appendProviderNote(
  details: string | null,
  note: {
    status: FinanceOperationStatus;
    actorEmail: string;
    decidedAt: Date;
    providerPayoutId?: string | null;
    providerStatus?: string | null;
    destinationLabel?: string | null;
    comment?: string | null;
  },
) {
  const lines = [
    `[YooKassa payout ${note.decidedAt.toISOString()}]`,
    `Status: ${note.status}`,
    `Actor: ${note.actorEmail}`,
  ];
  if (note.providerPayoutId) lines.push(`Provider payout: ${note.providerPayoutId}`);
  if (note.providerStatus) lines.push(`Provider status: ${note.providerStatus}`);
  if (note.destinationLabel) lines.push(`Destination: ${note.destinationLabel}`);
  if (note.comment) lines.push(`Comment: ${note.comment}`);
  return [details?.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
}

function cleanProviderPayload(payout: YooKassaPayoutObject): Prisma.InputJsonValue {
  const raw = payout as YooKassaPayoutObject & {
    succeeded_at?: string;
    test?: boolean;
  };
  return JSON.parse(
    JSON.stringify({
      id: raw.id,
      status: raw.status,
      amount: raw.amount ?? null,
      payout_destination: raw.payout_destination ?? null,
      description: raw.description ?? null,
      created_at: raw.created_at ?? null,
      succeeded_at: raw.succeeded_at ?? null,
      canceled_at: raw.canceled_at ?? null,
      cancellation_details: raw.cancellation_details ?? null,
      metadata: raw.metadata ?? null,
      test: raw.test ?? null,
    }),
  ) as Prisma.InputJsonValue;
}

async function assertPayoutCoverage(
  tx: Prisma.TransactionClient,
  current: Prisma.FinanceOperationGetPayload<Record<string, never>>,
  nextStatus: FinanceOperationStatus,
  now: Date,
) {
  if (
    current.companyId &&
    current.type === "PAYOUT_REQUEST" &&
    (nextStatus === "APPROVED" || nextStatus === "PAID")
  ) {
    const [subscriptions, companyPayouts] = await Promise.all([
      tx.userSubscription.findMany({
        where: {
          status: { in: ["ACTIVE", "EXPIRED"] },
          subscription: { companyId: current.companyId },
        },
        select: {
          status: true,
          activatedAt: true,
          expiresAt: true,
          subscription: { select: { companyId: true, name: true, price: true } },
        },
      }),
      tx.financeOperation.findMany({
        where: {
          companyId: current.companyId,
          type: "PAYOUT_REQUEST",
          status: { in: ["PENDING_APPROVAL", "APPROVED", "PAID"] },
        },
        select: { companyId: true, type: true, status: true, amount: true },
      }),
    ]);
    const snapshot = calculateCompanyFinancialSnapshot(
      current.companyId,
      subscriptions.map((subscription) => ({
        companyId: subscription.subscription.companyId!,
        name: subscription.subscription.name,
        price: subscription.subscription.price,
        status: subscription.status,
        activatedAt: subscription.activatedAt,
        expiresAt: subscription.expiresAt,
      })),
      companyPayouts,
      now,
    );
    const coverage = evaluatePayoutCoverage(snapshot, current);
    if (!coverage.requestCovered) {
      throw new Error(`INSUFFICIENT_COMPANY_BALANCE:${coverage.availableBeforeThisRequest.toFixed(2)}`);
    }
  }

  if (isReferralPayout(current) && (nextStatus === "APPROVED" || nextStatus === "PAID")) {
    const coverage = await calculateCompanyReferralPayoutCoverage(current.requestedById!, current, tx);
    if (!coverage.requestCovered) {
      throw new Error(`INSUFFICIENT_REFERRAL_BALANCE:${coverage.availableBeforeThisRequest.toFixed(2)}`);
    }
  }

  if (
    current.type === "PAYOUT_REQUEST" &&
    !current.companyId &&
    !isReferralPayout(current) &&
    (nextStatus === "APPROVED" || nextStatus === "PAID")
  ) {
    throw new Error("UNLINKED_PAYOUT_REQUEST");
  }
}

async function writeAuditAndResolveTask(
  tx: Prisma.TransactionClient,
  input: {
    actorId: number;
    actorEmail: string;
    operation: Pick<FinanceOperationRow, "uuid" | "title" | "amount" | "currency">;
    status: FinanceOperationStatus;
    now: Date;
    manualReference?: string | null;
    providerPayoutId?: string | null;
  },
) {
  await tx.auditEvent.create({
    data: {
      workspace: "MANAGER",
      level: "INFO",
      category: "BILLING",
      action: "Finance operation status changed",
      actorUserId: input.actorId,
      actorLabel: input.actorEmail,
      targetUuid: input.operation.uuid,
      targetLabel: input.operation.title,
      details: `Status changed to ${input.status}. Amount: ${input.operation.amount.toString()} ${input.operation.currency}${
        input.manualReference ? `. Manual reference: ${input.manualReference}` : ""
      }${input.providerPayoutId ? `. YooKassa payout: ${input.providerPayoutId}` : ""}`,
      tags: ["#BILLING", "#FINANCE", "#STATUS_CHANGE"],
    },
  });

  if (input.status === "PAID" || input.status === "CANCELED" || input.status === "REJECTED") {
    await tx.adminTask.updateMany({
      where: {
        sourceKey: `finance:${input.operation.uuid}`,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      data: {
        status: "RESOLVED",
        resolvedById: input.actorId,
        resolvedAt: input.now,
      },
    });
  }
}

type FinanceOperationSideEffect = Parameters<typeof writeAuditAndResolveTask>[1];

async function safelyWriteAuditAndResolveTask(input: FinanceOperationSideEffect) {
  try {
    await prisma.$transaction(async (tx) => {
      await writeAuditAndResolveTask(tx, input);
    });
  } catch (error) {
    console.warn("[admin.finance] Finance operation side effects failed", {
      operationUuid: input.operation.uuid,
      status: input.status,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  await notifyAdminsAboutFinanceOperationStatusChange({
    operation: input.operation,
    status: input.status,
    actorEmail: input.actorEmail,
    manualReference: input.manualReference,
    providerPayoutId: input.providerPayoutId,
  }).catch((error) => {
    console.warn("[admin.finance] Telegram finance status notification failed", {
      operationUuid: input.operation.uuid,
      status: input.status,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

function providerErrorResponse(message: string) {
  if (message === "YOOKASSA_PAYOUT_NOT_CONFIGURED") {
    return NextResponse.json(
      { message: "YooKassa payouts are not configured. Add payout gateway id and secret key in env." },
      { status: 503 },
    );
  }
  if (message === "YOOKASSA_PAYOUT_RAW_CARD_DISABLED") {
    return NextResponse.json(
      { message: "Raw bank card payouts are disabled. Enable YOOKASSA_PAYOUT_ALLOW_RAW_CARD=true only for the test gateway." },
      { status: 400 },
    );
  }
  if (message === "YOOKASSA_PAYOUT_CARD_INVALID") {
    return NextResponse.json({ message: "Enter a valid test bank card number for YooKassa payout." }, { status: 400 });
  }
  if (message === "YOOKASSA_PAYOUT_YOOMONEY_INVALID") {
    return NextResponse.json({ message: "Enter a valid YooMoney wallet number." }, { status: 400 });
  }
  if (message.startsWith("YOOKASSA_PAYOUT_FAILED:")) {
    return NextResponse.json({ message: message.replace("YOOKASSA_PAYOUT_FAILED:", "") }, { status: 502 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      email: true,
      permissions: {
        where: { scope: "FINANCE" },
        select: { scope: true, canView: true, canEdit: true, canApprove: true },
      },
    },
  });
  const financePermission = resolveEffectivePermission(actor?.role ?? "CLIENT", actor?.permissions[0] ?? null, "FINANCE");
  if (!actor || !financePermission.canApprove) {
    return NextResponse.json({ message: "Finance approval is not allowed" }, { status: 403 });
  }

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const now = new Date();

  try {
    if (body.providerAction === "SYNC") {
      const current = await prisma.financeOperation.findUnique({ where: { uuid } });
      if (!current) throw new Error("FINANCE_OPERATION_NOT_FOUND");
      if (!current.providerPayoutId) {
        return NextResponse.json({ message: "This operation has no YooKassa payout to sync." }, { status: 409 });
      }

      const payout = await getYooKassaPayout(current.providerPayoutId);
      const nextStatus = mapYooKassaPayoutStatus(payout.status);
      const item = await prisma.financeOperation.update({
        where: { uuid },
        data: {
          status: nextStatus,
          providerPayoutStatus: payout.status,
          providerPayload: cleanProviderPayload(payout),
          payoutProviderSyncedAt: now,
          processedAt: nextStatus === "PAID" || nextStatus === "CANCELED" ? now : undefined,
          details: appendProviderNote(current.details ?? null, {
            status: nextStatus,
            actorEmail: actor.email,
            decidedAt: now,
            providerPayoutId: payout.id,
            providerStatus: payout.status,
            comment: "Provider status synced from YooKassa.",
          }),
        },
        include: operationInclude,
      });
      await safelyWriteAuditAndResolveTask({
        actorId: actor.id,
        actorEmail: actor.email,
        operation: item,
        status: nextStatus,
        now,
        providerPayoutId: payout.id,
      });

      return NextResponse.json(item);
    }

    if (!body.status || !APPROVAL_STATUSES.has(body.status)) {
      return NextResponse.json({ message: "Choose valid finance status" }, { status: 400 });
    }

    const nextStatus = body.status;
    const manualMethod = cleanText(body.manualMethod, 80);
    const manualReference = cleanText(body.manualReference, 120);
    const manualComment = cleanText(body.manualComment, 1000);
    const manualProcessedAt = readDate(body.processedAt);
    const payoutMode = body.payoutMode ?? "MANUAL";

    if (nextStatus === "PAID" && payoutMode !== "YOOKASSA" && !manualReference && !manualComment) {
      return NextResponse.json(
        { message: "Manual payout closure requires payment reference or comment." },
        { status: 400 },
      );
    }

    if (nextStatus === "PAID" && payoutMode === "YOOKASSA") {
      const destination = readDestination(body);
      if (!destination) {
        return NextResponse.json(
          { message: "Choose YooKassa payout destination and enter test card or YooMoney wallet." },
          { status: 400 },
        );
      }

      const current = await prisma.$transaction(async (tx) => {
        const operation = await tx.financeOperation.findUnique({ where: { uuid } });
        if (!operation) throw new Error("FINANCE_OPERATION_NOT_FOUND");
        if (operation.status !== "APPROVED") throw new Error("YOOKASSA_PAYOUT_REQUIRES_APPROVED");
        if (operation.providerPayoutId) throw new Error("YOOKASSA_PAYOUT_ALREADY_CREATED");
        await assertPayoutCoverage(tx, operation, "PAID", now);
        const idempotenceKey = operation.providerIdempotenceKey ?? `finance-payout:${operation.uuid}`;
        if (!operation.providerIdempotenceKey) {
          await tx.financeOperation.update({
            where: { uuid: operation.uuid },
            data: { providerIdempotenceKey: idempotenceKey },
          });
        }
        return { ...operation, providerIdempotenceKey: idempotenceKey };
      });

      const result = await createYooKassaPayout({
        amount: current.amount.toString(),
        currency: current.currency,
        description: `${current.title} (${current.uuid})`,
        idempotenceKey: current.providerIdempotenceKey,
        destination,
        metadata: {
          financeOperationUuid: current.uuid,
          target: current.companyId ? "company" : isReferralPayout(current) ? "pr_agent" : "unlinked",
        },
      });
      const providerStatus = result.payout.status;
      const providerNextStatus = mapYooKassaPayoutStatus(providerStatus);

      const item = await prisma.financeOperation.update({
        where: { uuid },
        data: {
          status: providerNextStatus,
          approvedById: actor.id,
          approvedAt: current.approvedAt ?? now,
          processedAt: providerNextStatus === "PAID" || providerNextStatus === "CANCELED" ? now : undefined,
          payoutProvider: "YOOKASSA",
          providerPayoutId: result.payout.id,
          providerPayoutStatus: providerStatus,
          providerIdempotenceKey: result.idempotenceKey,
          providerPayload: cleanProviderPayload(result.payout),
          payoutDestinationType: result.destinationType,
          payoutDestinationLabel: result.destinationLabel,
          payoutProviderRequestedAt: now,
          payoutProviderSyncedAt: now,
          details: appendProviderNote(current.details ?? null, {
            status: providerNextStatus,
            actorEmail: actor.email,
            decidedAt: now,
            providerPayoutId: result.payout.id,
            providerStatus,
            destinationLabel: result.destinationLabel,
            comment:
              providerNextStatus === "PAID"
                ? "YooKassa payout succeeded."
                : "YooKassa payout created. Waiting for provider final status.",
          }),
        },
        include: operationInclude,
      });
      await safelyWriteAuditAndResolveTask({
        actorId: actor.id,
        actorEmail: actor.email,
        operation: item,
        status: providerNextStatus,
        now,
        providerPayoutId: result.payout.id,
      });

      return NextResponse.json(item);
    }

    const item = await prisma.$transaction(async (tx) => {
      const current = await tx.financeOperation.findUnique({ where: { uuid } });
      if (!current) throw new Error("FINANCE_OPERATION_NOT_FOUND");
      await assertPayoutCoverage(tx, current, nextStatus, now);
      return tx.financeOperation.update({
        where: { uuid },
        data: {
          status: nextStatus,
          approvedById: nextStatus === "APPROVED" || nextStatus === "PAID" ? actor.id : undefined,
          approvedAt: nextStatus === "APPROVED" || (nextStatus === "PAID" && !current.approvedAt) ? now : undefined,
          processedAt: nextStatus === "PAID" ? manualProcessedAt ?? now : undefined,
          details: appendFinanceDecisionNote(current.details ?? null, {
            status: nextStatus,
            actorEmail: actor.email,
            decidedAt: now,
            manualMethod,
            manualReference,
            manualComment,
          }),
        },
        include: operationInclude,
      });
    });
    await safelyWriteAuditAndResolveTask({
      actorId: actor.id,
      actorEmail: actor.email,
      operation: item,
      status: nextStatus,
      now,
      manualReference,
    });

    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const providerResponse = providerErrorResponse(message);
    if (providerResponse) return providerResponse;
    if (message === "FINANCE_OPERATION_NOT_FOUND") {
      return NextResponse.json({ message: "Finance operation not found" }, { status: 404 });
    }
    if (message === "YOOKASSA_PAYOUT_REQUIRES_APPROVED") {
      return NextResponse.json({ message: "Approve the payout before sending it to YooKassa." }, { status: 409 });
    }
    if (message === "YOOKASSA_PAYOUT_ALREADY_CREATED") {
      return NextResponse.json({ message: "YooKassa payout already exists. Sync provider status instead." }, { status: 409 });
    }
    if (message.startsWith("INSUFFICIENT_COMPANY_BALANCE:")) {
      const available = message.split(":")[1];
      return NextResponse.json(
        { message: `Company payout is not covered by earned balance. Available before this request: ${available} RUB.` },
        { status: 409 },
      );
    }
    if (message.startsWith("INSUFFICIENT_REFERRAL_BALANCE:")) {
      const available = message.split(":")[1];
      return NextResponse.json(
        { message: `PR payout is not covered by earned referral balance. Available before this request: ${available} RUB.` },
        { status: 409 },
      );
    }
    if (message === "UNLINKED_PAYOUT_REQUEST") {
      return NextResponse.json(
        { message: "Unlinked payout requests cannot be approved. Create payouts from a company balance or PR agent cabinet." },
        { status: 409 },
      );
    }
    console.error("[admin.finance] Failed to update finance operation", {
      uuid,
      message,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
