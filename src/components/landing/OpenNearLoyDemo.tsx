import Image from "next/image";
import { BadgeCheck, Sparkles } from "lucide-react";

export function OpenNearLoyDemo() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-cyan-100/14 bg-[radial-gradient(circle_at_50%_0%,rgba(165,243,252,0.16),transparent_38%),rgba(255,255,255,0.035)] p-3 shadow-[0_0_90px_rgba(103,232,249,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.032)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.024)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-300/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-blue-500/12 blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-black/35">
        <Image
          src="/landing/user-hero-wallet.png"
          alt="NearLoy QR wallet with loyalty cards and partner benefits"
          width={1586}
          height={992}
          className="aspect-[16/10] w-full object-cover opacity-95"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_45%,transparent_32%,rgba(2,5,10,0.2)_62%,rgba(2,5,10,0.62)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#02050a] via-[#02050a]/62 to-transparent" />

        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-black/38 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80 backdrop-blur">
          <Sparkles className="h-4 w-4" />
          Единый центр лояльности
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl border border-emerald-100/14 bg-black/52 px-4 py-3 text-sm text-emerald-50/80 backdrop-blur-xl sm:px-5 sm:py-4">
          <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-100" />
          Клиент видит бонусы, тарифы и действия без лишних карт и приложений.
        </div>
      </div>
    </div>
  );
}
