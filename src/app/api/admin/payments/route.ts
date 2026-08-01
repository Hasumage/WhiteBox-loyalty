import { NextResponse, type NextRequest } from "next/server";
import { PaymentStatus, type Prisma } from "@prisma/client";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { getPaymentReceiptUrl } from "@/lib/finance/payment-receipts";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const paymentCheckoutTtlMs = 15 * 60 * 1000;
const paymentStatuses = new Set<string>(Object.values(PaymentStatus));

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

async function requirePaymentsAccess(session: Awaited<ReturnType<typeof requireAdminSession>>) {
  if (isAuthResponse(session)) return session;
  const financeAccess = await requireAdminScope(session, "FINANCE", "canView");
  if (financeAccess.ok) return null;
  const companiesAccess = await requireAdminScope(session, "COMPANIES", "canView");
  return companiesAccess.ok ? null : financeAccess.response;
}

async function expireStalePayments() {
  await prisma.payment.updateMany({
    where: {
      status: { in: [PaymentStatus.PENDING, PaymentStatus.WAITING_FOR_CAPTURE] },
      createdAt: { lt: new Date(Date.now() - paymentCheckoutTtlMs) },
    },
    data: {
      status: PaymentStatus.EXPIRED,
      canceledAt: new Date(),
      cancelReason: "Payment checkout expired after 15 minutes.",
    },
  });
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const accessResponse = await requirePaymentsAccess(session);
  if (accessResponse) return accessResponse;

  await expireStalePayments();

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query")?.trim();
  const status = searchParams.get("status")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;
  const where: Prisma.PaymentWhereInput = {
    ...(status && paymentStatuses.has(status) ? { status: status as PaymentStatus } : {}),
    ...(query
      ? {
          OR: [
            { uuid: { contains: query, mode: "insensitive" } },
            { providerPaymentId: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { user: { name: { contains: query, mode: "insensitive" } } },
            { company: { name: { contains: query, mode: "insensitive" } } },
            { subscription: { name: { contains: query, mode: "insensitive" } } },
            { subscriptionBundle: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total, statusRows] = await Promise.all([
    prisma.payment.findMany({
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
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
  ]);
  const summary = statusRows.reduce(
    (acc, row) => {
      acc.byStatus[row.status] = row._count;
      if (row.status === PaymentStatus.SUCCEEDED) {
        acc.succeededAmount += Number(row._sum.amount ?? 0);
      }
      return acc;
    },
    { byStatus: {} as Record<string, number>, succeededAmount: 0 },
  );

  return NextResponse.json({
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
      receiptUrl: getPaymentReceiptUrl(item),
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
      expired: summary.byStatus[PaymentStatus.EXPIRED] ?? 0,
    },
  });
}
