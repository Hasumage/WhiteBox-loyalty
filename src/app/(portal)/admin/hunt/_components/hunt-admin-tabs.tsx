"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/hunt", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/hunt/characters", label: "Персонажи", icon: Sparkles },
  { href: "/admin/hunt/players", label: "Игроки", icon: Users },
  { href: "/admin/hunt/tournament", label: "Турнир", icon: Trophy },
];

export function HuntAdminTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/admin/hunt" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-white/[0.07] hover:text-foreground",
              active ? "bg-cyan-300/14 text-cyan-50 shadow-[0_0_18px_rgba(103,232,249,0.10)]" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
