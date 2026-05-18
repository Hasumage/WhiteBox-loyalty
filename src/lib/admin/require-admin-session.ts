import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export type AdminSession = {
  userId: number;
  email?: string;
  role: "ADMIN" | "SUPER_ADMIN" | "MANAGER" | "SUPPORT";
};

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT"]);

type BackendUser = {
  id?: string | number;
  legacyId?: number;
  email?: string;
  role?: string;
};

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  return base.replace(/\/$/, "");
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return request.cookies.get("wb_access_token")?.value ?? null;
}

async function verifyWithBackend(token: string): Promise<AdminSession | null> {
  try {
    const response = await fetch(`${apiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const user = (await response.json().catch(() => null)) as BackendUser | null;
    const role = typeof user?.role === "string" ? user.role : "";
    if (!ADMIN_ROLES.has(role)) return null;

    const userId = Number(user?.legacyId ?? user?.id ?? 0);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    return {
      userId,
      email: typeof user?.email === "string" ? user.email : undefined,
      role: role as AdminSession["role"],
    };
  } catch {
    return null;
  }
}

export async function requireAdminSession(request: NextRequest): Promise<AdminSession | NextResponse> {
  const token = readBearerToken(request);
  const secret = process.env.JWT_SECRET;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!secret) {
    const backendSession = await verifyWithBackend(token);
    if (backendSession) return backendSession;
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const userId = Number(payload.sub ?? 0);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, accountStatus: true },
    });
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (user.accountStatus === "BLOCKED") {
      return NextResponse.json({ message: "Account blocked" }, { status: 423 });
    }
    const role = user.role;

    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return {
      userId: user.id,
      email: user.email,
      role: role as AdminSession["role"],
    };
  } catch {
    const backendSession = await verifyWithBackend(token);
    if (backendSession) return backendSession;
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}

export function isAuthResponse(value: AdminSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
