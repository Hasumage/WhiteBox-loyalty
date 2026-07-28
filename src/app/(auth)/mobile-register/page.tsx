import { redirect } from "next/navigation";

export default function MobileRegisterPage() {
  redirect("/register?app=capacitor");
}
