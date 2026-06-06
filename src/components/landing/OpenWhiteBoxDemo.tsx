import Image from "next/image";
import { BadgeCheck, Gift, QrCode, Sparkles, TicketCheck, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ModuleCard = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const modules: ModuleCard[] = [
  {
    icon: QrCode,
    title: "QR у кассы",
    text: "Клиент показывает код, кассир быстро находит профиль.",
  },
  {
    icon: Gift,
    title: "Бонусы",
    text: "Начисления, списания и уведомления остаются в истории.",
  },
  {
    icon: TicketCheck,
    title: "Подписки",
    text: "Услуги, лимиты и погашение собраны в понятном формате.",
  },
  {
    icon: Trophy,
    title: "Статусы",
    text: "Уровни и редкие статусы поддерживают вовлечённость.",
  },
];

export function OpenWhiteBoxDemo() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-cyan-100/14 bg-[radial-gradient(circle_at_50%_0%,rgba(165,243,252,0.14),transparent_36%),rgba(255,255,255,0.035)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px]" />

      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10">
        <Image
          src="/landing/user-hero-wallet.png"
          alt="WhiteBox QR wallet with loyalty cards and partner benefits"
          width={1586}
          height={992}
          className="aspect-[16/10] w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#02050a] to-transparent" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-black/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80 backdrop-blur">
          <Sparkles className="h-4 w-4" />
          Единый кошелёк клиента
        </div>
      </div>

      <div className="relative grid gap-3 p-4 sm:grid-cols-2">
        {modules.map((item) => (
          <div
            key={item.title}
            className="rounded-3xl border border-white/10 bg-black/24 p-4 transition hover:border-cyan-100/28 hover:bg-cyan-100/[0.07]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-100/8 text-cyan-100">
              <item.icon className="h-5 w-5" />
            </span>
            <p className="mt-4 font-semibold">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-white/56">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="relative mx-4 mb-4 flex items-center gap-3 rounded-3xl border border-emerald-100/16 bg-emerald-100/[0.07] p-4 text-sm text-emerald-50/80">
        <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-100" />
        Клиенту достаточно одного интерфейса, чтобы видеть пользу от партнёров.
      </div>
    </div>
  );
}
