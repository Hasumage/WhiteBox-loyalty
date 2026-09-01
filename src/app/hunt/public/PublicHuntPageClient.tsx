"use client";

import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingPageReveal } from "@/components/landing/MarketingPageReveal";
import { PublicHuntFeedClient } from "./PublicHuntFeedClient";

export function PublicHuntPageClient() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(103,232,249,0.14),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(132,204,22,0.10),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="hunt" />
      <MarketingPageReveal>
        <div className="relative z-10 pt-8">
          <PublicHuntFeedClient />
        </div>

        <MarketingFooter />
      </MarketingPageReveal>
    </main>
  );
}
