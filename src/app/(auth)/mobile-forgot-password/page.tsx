import { redirect } from "next/navigation";

export default function MobileForgotPasswordPage() {
  redirect("/forgot-password?app=capacitor");
}
