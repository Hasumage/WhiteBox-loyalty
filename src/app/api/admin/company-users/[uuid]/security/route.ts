import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;

  const access = await requireAdminScope(session, "COMPANIES", "canView");
  if (!access.ok) return access.response;

  const { uuid } = await params;
  const owner = await prisma.user.findUnique({
    where: { uuid },
    select: {
      id: true,
      uuid: true,
      name: true,
      email: true,
      accountStatus: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      managedCompany: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
    },
  });

  if (!owner?.managedCompany) {
    return NextResponse.json({ message: "Company account was not found" }, { status: 404 });
  }

  const members = await prisma.companyMember.findMany({
    where: { companyId: owner.managedCompany.id },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
    select: {
      uuid: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          uuid: true,
          name: true,
          email: true,
          role: true,
          accountStatus: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const ownerAsMember = members.some((member) => member.user.uuid === owner.uuid)
    ? []
    : [
        {
          uuid: owner.uuid,
          role: "OWNER" as const,
          isActive: owner.accountStatus === "ACTIVE",
          createdAt: owner.createdAt,
          updatedAt: owner.updatedAt,
          user: {
            uuid: owner.uuid,
            name: owner.name,
            email: owner.email,
            role: "COMPANY" as const,
            accountStatus: owner.accountStatus,
            emailVerifiedAt: owner.emailVerifiedAt,
            createdAt: owner.createdAt,
            updatedAt: owner.updatedAt,
          },
        },
      ];
  const allMembers = [...ownerAsMember, ...members];

  return NextResponse.json({
    company: {
      owner: {
        uuid: owner.uuid,
        name: owner.name,
        email: owner.email,
        accountStatus: owner.accountStatus,
        emailVerifiedAt: owner.emailVerifiedAt,
      },
      profile: owner.managedCompany,
    },
    summary: {
      totalMembers: allMembers.length,
      activeMembers: allMembers.filter((member) => member.isActive && member.user.accountStatus === "ACTIVE").length,
      inactiveMembers: allMembers.filter((member) => !member.isActive).length,
      blockedMembers: allMembers.filter((member) => member.user.accountStatus === "BLOCKED").length,
      verifiedEmails: allMembers.filter((member) => Boolean(member.user.emailVerifiedAt)).length,
      owners: allMembers.filter((member) => member.role === "OWNER").length,
      managers: allMembers.filter((member) => member.role === "MANAGER").length,
      cashiers: allMembers.filter((member) => member.role === "CASHIER").length,
    },
    members: allMembers,
  });
}
