import { NextResponse, type NextRequest } from "next/server";
import { notifyAdminsAboutCompanyPayout } from "@/lib/finance/company-payout-notifications";

export const runtime = "nodejs";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}/company/finance/payouts`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: await request.text(),
    });
  } catch {
    return NextResponse.json({ message: "Company finance service is unavailable." }, { status: 502 });
  }

  const payload = (await response.json().catch(() => ({}))) as { uuid?: string } & Record<string, unknown>;
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  if (payload.uuid) {
    // A persisted payout must remain successful even if Telegram temporarily fails.
    await notifyAdminsAboutCompanyPayout(payload.uuid).catch(() => undefined);
  }

  return NextResponse.json(payload, { status: response.status });
}
