import type { Metadata } from "next";
import { translate } from "@/lib/i18n/dictionary";
import { PublicHuntPageClient } from "./PublicHuntPageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: translate("ru", "marketing.hunt.metaTitle"),
  description: translate("ru", "marketing.hunt.metaDescription"),
  alternates: { canonical: "/hunt/public" },
  openGraph: {
    title: translate("ru", "marketing.hunt.metaTitle"),
    description: translate("ru", "marketing.hunt.metaDescription"),
    url: "/hunt/public",
    images: [{ url: "/hunt-assets/posts/demo-posts-sheet.webp", width: 1200, height: 630, alt: "Nearloy Hunt posts" }],
  },
};

export default function PublicHuntFeedPage() {
  return <PublicHuntPageClient />;
}
