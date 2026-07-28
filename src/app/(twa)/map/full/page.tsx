"use client";

import { Suspense } from "react";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { MapPageContent } from "../page";

export default function FullMapPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[70] h-[100dvh] overflow-hidden bg-black">
          <TwaLoadingScreen title="Открываем карту" subtitle="Подгружаем партнёров и карту рядом." />
        </div>
      }
    >
      <MapPageContent full />
    </Suspense>
  );
}
