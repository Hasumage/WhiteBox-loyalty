import { NextResponse, type NextRequest } from "next/server";
import type { LandingLeadStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { updateLandingLeadStatus } from "@/lib/leads/landing-leads";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STATUSES = new Set<LandingLeadStatus>(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"]);

type Params = { params: Promise<{ uuid: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const supportAccess = await requireAdminScope(session, "SUPPORT", "canView");
  if (!supportAccess.ok) {
    const prAccess = await requireAdminScope(session, "PR", "canView");
    if (!prAccess.ok) return supportAccess.response;
  }

  const { uuid } = await params;
  const lead = await prisma.landingLead.findUnique({
    where: { uuid },
    include: { deliveries: { orderBy: { createdAt: "desc" } } },
  });

  if (!lead) return NextResponse.json({ message: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const supportAccess = await requireAdminScope(session, "SUPPORT", "canEdit");
  if (!supportAccess.ok) {
    const prAccess = await requireAdminScope(session, "PR", "canEdit");
    if (!prAccess.ok) return supportAccess.response;
  }

  const { uuid } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: LandingLeadStatus; notes?: string };

  if (!body.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  const lead = await updateLandingLeadStatus({
    leadUuid: uuid,
    status: body.status,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 4000) : undefined,
  });

  return NextResponse.json(lead);
}
