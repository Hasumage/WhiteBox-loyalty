import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/shared";

export default async function MaxMiniAppEntryPage() {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, "ru", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  redirect("/login?surface=max&next=/app");
}
