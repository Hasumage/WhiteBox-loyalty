"use client";

import { Suspense } from "react";
import { MapPageContent } from "../page";

export default function FullMapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] px-3 pb-4 pt-4">
          <div className="h-[calc(100dvh-32px)] rounded-[2rem] border border-white/10 bg-muted/20" />
        </div>
      }
    >
      <MapPageContent full />
    </Suspense>
  );
}
