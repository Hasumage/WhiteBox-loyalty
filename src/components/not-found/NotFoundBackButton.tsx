"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NotFoundBackButton() {
  const router = useRouter();

  return (
    <Button type="button" variant="secondary" size="lg" onClick={() => router.back()} className="rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12]">
      <ArrowLeft className="h-4 w-4" />
      Назад
    </Button>
  );
}
