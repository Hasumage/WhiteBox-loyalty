import { redirect } from "next/navigation";

export default function MaxMiniAppEntryPage() {
  redirect("/login?surface=max&next=/app");
}
