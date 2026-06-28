"use client";

import { Suspense } from "react";
import { MapPageContent } from "../page";

export default function FullMapPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[70] flex h-[100dvh] items-center justify-center overflow-hidden bg-black">
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-4 text-sm text-white/70 shadow-[0_24px_60px_rgba(0,0,0,0.48)]">
            Loading map...
          </div>
        </div>
      }
    >
      <MapPageContent full />
    </Suspense>
  );
}
