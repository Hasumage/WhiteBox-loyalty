import { NextResponse } from "next/server";

function apiTarget() {
  const configured =
    process.env.API_PROXY_TARGET ||
    process.env.RAILWAY_SERVICE_WHITEBOX_API_URL ||
    "https://whitebox-api-production.up.railway.app/api";
  const withProtocol =
    configured.startsWith("http://") || configured.startsWith("https://")
      ? configured
      : `https://${configured}`;
  const target = new URL(withProtocol);
  if (target.pathname === "/") target.pathname = "/api";
  return target.toString().replace(/\/$/, "");
}

export async function GET() {
  try {
    const response = await fetch(`${apiTarget()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return NextResponse.json({ status: "error", upstreamStatus: response.status }, { status: 503 });
    }
    return NextResponse.json({ status: "ok", proxy: "web-to-api" });
  } catch {
    return NextResponse.json({ status: "error", proxy: "web-to-api" }, { status: 503 });
  }
}
