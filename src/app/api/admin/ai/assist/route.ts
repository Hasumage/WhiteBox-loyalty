import { NextResponse, type NextRequest } from "next/server";
import { isAuthResponse, requireAdminSession } from "@/lib/admin/require-admin-session";
import { assistAdminAi, sanitizeAdminAiMessages } from "@/lib/admin-ai/admin-ai-service";
import { loadAdminAiActor } from "@/lib/admin-ai/permissions";

export const runtime = "nodejs";

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as T;
}

function sanitizeImageDataUrl(value: unknown) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") return null;
  if (value.length > 750_000) return null;
  if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const actor = await loadAdminAiActor(session.userId);
  if (!actor) return NextResponse.json({ message: "Admin actor not found." }, { status: 404 });

  return NextResponse.json({
    actor: {
      role: actor.role,
      permissions: actor.permissions,
    },
    popularQueries: [],
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const actor = await loadAdminAiActor(session.userId);
  if (!actor) return NextResponse.json({ message: "Admin actor not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { message?: unknown; messages?: unknown; imageDataUrl?: unknown };
  const message = typeof body.message === "string" ? body.message : "";
  const history = sanitizeAdminAiMessages(body.messages);
  const imageDataUrl = sanitizeImageDataUrl(body.imageDataUrl);
  if (imageDataUrl === null) {
    return NextResponse.json({ message: "Изображение должно быть PNG, JPG или WebP и не тяжелее лимита." }, { status: 400 });
  }

  try {
    const result = await assistAdminAi({ actor, message, history, imageDataUrl });
    return NextResponse.json(jsonSafe(result));
  } catch (error) {
    console.error("[admin-ai] assist failed", error);
    const details = process.env.NODE_ENV !== "production" && error instanceof Error ? ` (${error.message})` : "";
    return NextResponse.json({ message: `Не удалось получить ответ AI. Попробуйте ещё раз.${details}` }, { status: 500 });
  }
}
