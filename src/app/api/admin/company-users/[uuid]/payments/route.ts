import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { getPaymentReceiptUrl } from "@/lib/finance/payment-receipts";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const paymentCheckoutTtlMs = 15 * 60 * 1000;
const paidPaymentStatuses = new Set(["SUCCEEDED"]);
const paidOperationStatuses = new Set(["PAID"]);
const pendingOperationStatuses = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED"]);

function moneyToNumber(value: unknown) {
  return Number(value ?? 0);
}

function sumMoney<T>(items: T[], amount: (item: T) => unknown) {
  return items.reduce((total, item) => total + moneyToNumber(amount(item)), 0);
}

function moneyToString(value: number) {
  return value.toFixed(2);
}

async function expireStaleCompanyPayments(companyId: number, ownerUserId: number) {
  await prisma.payment.updateMany({
    where: {
      OR: [
        { companyId },
        { userId: ownerUserId, purpose: "COMPANY_NEARLOY_SUBSCRIPTION" },
      ],
      status: { in: ["PENDING", "WAITING_FOR_CAPTURE"] },
      createdAt: { lt: new Date(Date.now() - paymentCheckoutTtlMs) },
    },
    data: {
      status: "EXPIRED",
      canceledAt: new Date(),
      cancelReason: "Payment checkout expired after 15 minutes.",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const { uuid } = await params;

  const companiesAccess = await requireAdminScope(session, "COMPANIES", "canView");
  if (!companiesAccess.ok) return companiesAccess.response;

  const owner = await prisma.user.findUnique({
    where: { uuid },
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      managedCompany: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          operatesOnline: true,
        },
      },
    },
  });

  if (!owner || !owner.managedCompany) {
    return NextResponse.json({ message: "Company account was not found" }, { status: 404 });
  }

  const companyId = owner.managedCompany.id;
  await expireStaleCompanyPayments(companyId, owner.id);

  const [incomingPayments, outgoingOperations] = await Promise.all([
    prisma.payment.findMany({
      where: {
        OR: [
          { companyId },
          { userId: owner.id, purpose: "COMPANY_NEARLOY_SUBSCRIPTION" },
          { subscription: { companyId } },
          { subscriptionBundle: { participants: { some: { companyId } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        user: { select: { uuid: true, name: true, email: true } },
        company: { select: { slug: true, name: true } },
        subscription: { select: { uuid: true, name: true } },
        subscriptionBundle: { select: { uuid: true, name: true } },
      },
    }),
    prisma.financeOperation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        company: { select: { id: true, slug: true, name: true } },
        requestedBy: { select: { id: true, uuid: true, email: true, name: true } },
        approvedBy: { select: { id: true, uuid: true, email: true, name: true } },
      },
    }),
  ]);

  const paidIncoming = incomingPayments.filter((payment) => paidPaymentStatuses.has(payment.status));
  const paidOutgoing = outgoingOperations.filter((operation) => paidOperationStatuses.has(operation.status));
  const pendingOutgoing = outgoingOperations.filter((operation) => pendingOperationStatuses.has(operation.status));
  const incomingSucceededAmount = sumMoney(paidIncoming, (payment) => payment.amount);
  const outgoingPaidAmount = sumMoney(paidOutgoing, (operation) => operation.amount);
  const outgoingPendingAmount = sumMoney(pendingOutgoing, (operation) => operation.amount);

  return NextResponse.json({
    company: {
      owner: {
        uuid: owner.uuid,
        name: owner.name,
        email: owner.email,
      },
      profile: owner.managedCompany,
    },
    summary: {
      incomingSucceededAmount: moneyToString(incomingSucceededAmount),
      outgoingPaidAmount: moneyToString(outgoingPaidAmount),
      outgoingPendingAmount: moneyToString(outgoingPendingAmount),
      netAmount: moneyToString(incomingSucceededAmount - outgoingPaidAmount),
      incomingCount: incomingPayments.length,
      outgoingCount: outgoingOperations.length,
    },
    incomingPayments: incomingPayments.map((payment) => ({
      uuid: payment.uuid,
      provider: payment.provider,
      purpose: payment.purpose,
      status: payment.status,
      amount: payment.amount.toString(),
      currency: payment.currency,
      description: payment.description,
      providerPaymentId: payment.providerPaymentId,
      providerStatus: payment.providerStatus,
      confirmationUrl: payment.confirmationUrl,
      receiptUrl: getPaymentReceiptUrl(payment),
      paidAt: payment.paidAt?.toISOString() ?? null,
      canceledAt: payment.canceledAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      user: payment.user,
      company: payment.company,
      plan: payment.subscription
        ? { type: "subscription" as const, uuid: payment.subscription.uuid, name: payment.subscription.name }
        : payment.subscriptionBundle
          ? { type: "bundle" as const, uuid: payment.subscriptionBundle.uuid, name: payment.subscriptionBundle.name }
          : null,
    })),
    outgoingOperations: outgoingOperations.map((operation) => ({
      id: operation.id,
      uuid: operation.uuid,
      type: operation.type,
      status: operation.status,
      amount: operation.amount.toString(),
      currency: operation.currency,
      title: operation.title,
      details: operation.details,
      requestedAt: operation.requestedAt?.toISOString() ?? null,
      approvedAt: operation.approvedAt?.toISOString() ?? null,
      processedAt: operation.processedAt?.toISOString() ?? null,
      createdAt: operation.createdAt.toISOString(),
      updatedAt: operation.updatedAt.toISOString(),
      company: operation.company,
      requestedBy: operation.requestedBy,
      approvedBy: operation.approvedBy,
    })),
  });
}
