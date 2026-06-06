import { NextResponse, type NextRequest } from "next/server";
import type { CompanyVerificationStatus } from "@prisma/client";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { deletePassportFilesForApplication } from "@/lib/company-onboarding/passport-storage";
import { addUtcDays } from "@/lib/finance/company-billing";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const REVIEW_STATUSES = new Set<CompanyVerificationStatus>(["SUBMITTED", "REVIEWING", "APPROVED", "REJECTED"]);
const TERMINAL_STATUSES = new Set<CompanyVerificationStatus>(["APPROVED", "REJECTED"]);
const FINAL_DECISION_ERROR = "FINAL_VERIFICATION_DECISION_RECORDED";

function readUuid(params: { uuid?: string } | Promise<{ uuid?: string }>) {
  return Promise.resolve(params).then((resolved) => resolved.uuid ?? "");
}

async function getApplication(uuid: string) {
  return prisma.companyVerificationApplication.findUnique({
    where: { uuid },
    include: {
      company: {
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
          verificationStatus: true,
          passportVerificationStatus: true,
          identityVerificationMode: true,
          identityVerificationCompleted: true,
          verificationSubmittedAt: true,
          verificationReviewedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      passportFiles: {
        where: { status: "ACTIVE" },
        select: {
          uuid: true,
          originalName: true,
          mimeType: true,
          size: true,
          sha256: true,
          uploadedAt: true,
          status: true,
        },
      },
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canView");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const application = await getApplication(uuid);
  if (!application) {
    return NextResponse.json({ message: "Company verification application not found" }, { status: 404 });
  }

  return NextResponse.json(application);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { uuid?: string } | Promise<{ uuid?: string }> },
) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "COMPANY_VERIFICATIONS", "canEdit");
  if (!access.ok) return access.response;

  const uuid = await readUuid(context.params);
  const body = (await request.json().catch(() => ({}))) as { status?: CompanyVerificationStatus };
  const status = body.status;

  if (!status || !REVIEW_STATUSES.has(status)) {
    return NextResponse.json({ message: "Choose a valid review status" }, { status: 400 });
  }

  let existing: {
    id: number;
    companyId: number | null;
    identityVerificationMode: string;
    status: CompanyVerificationStatus;
  };

  try {
    existing = await prisma.$transaction(async (tx) => {
      const current = await tx.companyVerificationApplication.findUnique({
        where: { uuid },
        select: { id: true, companyId: true, identityVerificationMode: true, status: true },
      });
      if (!current) {
        throw new Error("COMPANY_VERIFICATION_NOT_FOUND");
      }
      if (TERMINAL_STATUSES.has(current.status)) {
        throw new Error(FINAL_DECISION_ERROR);
      }

      await tx.companyVerificationApplication.update({
        where: { uuid },
        data: { status },
      });

      if (current.companyId) {
        const reviewedAt = new Date();
        await tx.company.update({
          where: { id: current.companyId },
          data: {
            verificationStatus: status,
            passportVerificationStatus: status === "APPROVED" ? "APPROVED" : status,
            identityVerificationCompleted: status === "APPROVED" && current.identityVerificationMode === "FULL",
            isActive: status === "APPROVED",
            verificationReviewedAt: status === "APPROVED" || status === "REJECTED" ? reviewedAt : undefined,
            passportDataDeletedAt: status === "APPROVED" || status === "REJECTED" ? reviewedAt : undefined,
          },
        });
        if (status === "APPROVED") {
          await tx.companyBillingAccount.upsert({
            where: { companyId: current.companyId },
            create: {
              companyId: current.companyId,
              status: "TRIAL",
              trialStartedAt: reviewedAt,
              trialEndsAt: addUtcDays(reviewedAt, 30),
              currentPeriodStartsAt: reviewedAt,
              currentPeriodEndsAt: addUtcDays(reviewedAt, 30),
            },
            update: {},
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          workspace: "MANAGER",
          level: status === "APPROVED" || status === "REJECTED" ? "WARN" : "INFO",
          category: "USER",
          action: "Company verification status changed",
          actorUserId: session.userId,
          actorLabel: session.email ?? `admin:${session.userId}`,
          targetUuid: uuid,
          targetLabel: `Company verification ${uuid}`,
          details: `Status changed to ${status}`,
          tags: ["#USER", "#VERIFICATION"],
        },
      });
      if (status === "APPROVED" || status === "REJECTED") {
        await tx.adminTask.updateMany({
          where: {
            sourceKey: `verification:${uuid}`,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          data: {
            status: "RESOLVED",
            resolvedById: session.userId,
            resolvedAt: new Date(),
          },
        });
      }

      return current;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_VERIFICATION_NOT_FOUND") {
      return NextResponse.json({ message: "Company verification application not found" }, { status: 404 });
    }
    if (
      (error instanceof Error && error.message === FINAL_DECISION_ERROR) ||
      (typeof error === "object" && error !== null && "code" in error && error.code === "P2034")
    ) {
      return NextResponse.json(
        { message: "A final verification decision has already been recorded and cannot be changed." },
        { status: 409 },
      );
    }
    throw error;
  }

  if (TERMINAL_STATUSES.has(status)) {
    await deletePassportFilesForApplication(existing.id);
    await prisma.companyVerificationApplication.update({
      where: { uuid },
      data: { passportDataDeletedAt: new Date() },
    });
  }

  const application = await getApplication(uuid);
  return NextResponse.json(application);
}
