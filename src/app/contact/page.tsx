import type { Metadata } from "next";
import { translate } from "@/lib/i18n/dictionary";
import { ContactPageClient } from "./ContactPageClient";

export const metadata: Metadata = {
  title: translate("ru", "marketing.contact.metaTitle"),
  description: translate("ru", "marketing.contact.metaDescription"),
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
