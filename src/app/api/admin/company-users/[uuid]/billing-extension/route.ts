import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import {
  CompanyBillingExtensionError,
  DEFAULT_COMPANY_BILLING_EXTENSION_TEMPLATE,
  extendCompanyBillingWithoutPayment,
} from "@/lib/admin/company-billing-extension";

export const runtime = "nodejs";

async function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return (await Promise.resolve(params)).uuid ?? "";
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANIES", "canView");
  if (!access.ok) return access.response;

  return NextResponse.json({
    defaultTemplate: DEFAULT_COMPANY_BILLING_EXTENSION_TEMPLATE,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
    return NextResponse.json({ message: "Only admins can extend company billing without payment." }, { status: 403 });
  }

  const access = await requireAdminScope(session, "COMPANIES", "canApprove");
  if (!access.ok) return access.response;

  const body = (await request.json().catch(() => ({}))) as {
    months?: unknown;
    days?: unknown;
    comment?: unknown;
    notificationText?: unknown;
    notifyTelegram?: unknown;
  };

  try {
    const result = await extendCompanyBillingWithoutPayment({
      ownerUserUuid: await readUuid(context.params),
      actor: access.actor,
      months: numberOrUndefined(body.months),
      days: numberOrUndefined(body.days),
      comment: typeof body.comment === "string" ? body.comment : undefined,
      notificationText: typeof body.notificationText === "string" ? body.notificationText : undefined,
      notifyTelegram: body.notifyTelegram !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CompanyBillingExtensionError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Failed to extend company billing." }, { status: 500 });
  }
}
