import { redirect } from "next/navigation";

export default function MobileMapPage() {
  redirect("/map/full?app=capacitor");
}
