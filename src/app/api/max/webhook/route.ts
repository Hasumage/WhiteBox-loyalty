import { NextResponse, type NextRequest } from "next/server";
import { handleMaxUpdate, type MaxUpdate } from "@/lib/max/max-bot";

export const runtime = "nodejs";

function isSecretValid(request: NextRequest) {
  const expected = process.env.MAX_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  return request.headers.get("x-max-bot-api-secret") === expected;
}

export async function POST(request: NextRequest) {
  if (!isSecretValid(request)) {
    return NextResponse.json({ ok: false, message: "invalid_secret" }, { status: 401 });
  }

  let update: MaxUpdate;
  try {
    update = (await request.json()) as MaxUpdate;
  } catch {
    return NextResponse.json({ ok: false, message: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await handleMaxUpdate(update);
    return NextResponse.json(result);
  } catch (error) {
    console.error("MAX webhook failed.", error);
    return NextResponse.json({ ok: false, message: "max_message_processing_failed" });
  }
}
