import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import {
  requireAdminSession,
  isAuthResponse,
} from "@/lib/admin/require-admin-session";
import { requireAdminScope } from "@/lib/admin/require-admin-scope";
import { prisma } from "@/lib/prisma";
import {
  parseAbilityEdit,
  AbilityValidationError,
} from "@/lib/hunt/ability-config";

export const runtime = "nodejs";
type Context = { params: Promise<{ uuid: string }> };
async function readSlots(speciesId: string) {
  const rows = await prisma.huntSpeciesAbility.findMany({
    where: { speciesId },
    orderBy: { slot: "asc" },
    include: {
      ability: {
        include: { revisions: { orderBy: { revision: "desc" }, take: 20 } },
      },
    },
  });
  return rows.map(({ slot, ability }) => ({
    ...ability,
    slot,
    history: ability.revisions,
    revisions: undefined,
  }));
}
export async function GET(request: NextRequest, context: Context) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canView");
  if (!access.ok) return access.response;
  const { uuid } = await context.params;
  if (
    !(await prisma.huntCreatureSpecies.findUnique({
      where: { id: uuid },
      select: { id: true },
    }))
  )
    return NextResponse.json(
      { message: "Персонаж не найден" },
      { status: 404 },
    );
  return NextResponse.json(await readSlots(uuid), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PUT(request: NextRequest, context: Context) {
  const session = await requireAdminSession(request);
  if (isAuthResponse(session)) return session;
  const access = await requireAdminScope(session, "HUNT", "canEdit");
  if (!access.ok) return access.response;
  try {
    const raw = await request.text();
    if (raw.length > 96000)
      throw new AbilityValidationError("Слишком большой запрос");
    const body: unknown = JSON.parse(raw);
    if (!Array.isArray(body) || body.length !== 3)
      throw new AbilityValidationError("Нужно ровно три способности");
    const rows = body.map(parseAbilityEdit);
    if (
      new Set(rows.map((a) => a.slot)).size !== 3 ||
      new Set(rows.map((a) => a.id)).size !== 3
    )
      throw new AbilityValidationError(
        "Слоты и способности не должны повторяться",
      );
    const { uuid } = await context.params;
    await prisma.$transaction(async (tx) => {
      const owned = await tx.huntSpeciesAbility.findMany({
        where: { speciesId: uuid },
        include: { ability: true },
      });
      if (
        owned.length !== 3 ||
        rows.some(
          (a) =>
            !owned.some(
              (o) => o.abilityId === a.id && o.ability.slug === a.slug,
            ),
        )
      )
        throw new AbilityValidationError(
          "Неверный набор способностей персонажа",
        );
      for (const a of rows) {
        const snapshot = {
          nameRu: a.nameRu,
          nameEn: a.nameEn,
          descriptionRu: a.descriptionRu,
          descriptionEn: a.descriptionEn,
          icon: a.icon,
          isActive: a.isActive,
          schemaVersion: a.schemaVersion,
          config: a.config as unknown as Prisma.InputJsonValue,
        };
        const result = await tx.huntAbility.updateMany({
          where: { id: a.id, revision: a.revision },
          data: { ...snapshot, revision: { increment: 1 } },
        });
        if (result.count !== 1) throw new Error("REVISION_CONFLICT");
        await tx.huntAbilityRevision.create({
          data: {
            abilityId: a.id,
            revision: a.revision + 1,
            actorUserId: access.actor.id,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
      }
      await tx.huntSpeciesAbility.deleteMany({ where: { speciesId: uuid } });
      await tx.huntSpeciesAbility.createMany({
        data: rows.map((a) => ({
          speciesId: uuid,
          abilityId: a.id,
          slot: a.slot,
        })),
      });
      await tx.auditEvent.create({
        data: {
          workspace: "MANAGER",
          category: "SYSTEM",
          level: "INFO",
          action: "Hunt abilities updated",
          actorUserId: access.actor.id,
          actorLabel: access.actor.email,
          details: `Species ${uuid}: ${rows.map((a) => `${a.slug}@${a.revision + 1}`).join(", ")}`,
          tags: ["#HUNT", "#ABILITIES"],
        },
      });
    });
    return NextResponse.json(await readSlots(uuid));
  } catch (error) {
    if (error instanceof Error && error.message === "REVISION_CONFLICT")
      return NextResponse.json(
        {
          message: "Настройки уже изменены. Обновите данные перед сохранением.",
        },
        { status: 409 },
      );
    if (error instanceof AbilityValidationError || error instanceof SyntaxError)
      return NextResponse.json(
        {
          message:
            error instanceof SyntaxError ? "Некорректный JSON" : error.message,
        },
        { status: 400 },
      );
    console.error("Hunt ability update failed", error);
    return NextResponse.json(
      { message: "Не удалось сохранить способности" },
      { status: 500 },
    );
  }
}
