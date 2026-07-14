import {
  InternalIcon,
  INTERNAL_ICON_GROUPS,
  INTERNAL_ICON_OPTIONS,
  type InternalIconOption,
} from "@/components/icons/internal-icon-collection";
import { cn } from "@/lib/utils";

export type ProfileStatusRarityView = "RARE" | "EPIC" | "LEGENDARY";

export const PROFILE_STATUS_RARITY_META: Record<ProfileStatusRarityView, {
  label: string;
  shortLabel: string;
  ring: string;
  text: string;
  glow: string;
  surface: string;
}> = {
  RARE: {
    label: "Редкий",
    shortLabel: "Редкий",
    ring: "border-sky-300/35",
    text: "text-sky-100",
    glow: "shadow-[0_0_28px_rgba(56,189,248,0.18)]",
    surface: "bg-sky-400/10",
  },
  EPIC: {
    label: "Эпический",
    shortLabel: "Эпик",
    ring: "border-violet-300/40",
    text: "text-violet-100",
    glow: "shadow-[0_0_30px_rgba(168,85,247,0.20)]",
    surface: "bg-violet-400/12",
  },
  LEGENDARY: {
    label: "Легендарный",
    shortLabel: "Легенда",
    ring: "border-orange-300/45",
    text: "text-orange-100",
    glow: "shadow-[0_0_34px_rgba(251,146,60,0.22)]",
    surface: "bg-orange-400/12",
  },
};

export type ProfileStatusIconOption = InternalIconOption;

export const PROFILE_STATUS_ICON_GROUPS = INTERNAL_ICON_GROUPS;
export const PROFILE_STATUS_ICON_OPTIONS: ProfileStatusIconOption[] = INTERNAL_ICON_OPTIONS;

export function ProfileStatusIcon({ icon, className }: { icon?: string | null; className?: string }) {
  return <InternalIcon icon={icon} fallback="Sparkles" className={className} />;
}

export function profileStatusRarityClass(rarity: ProfileStatusRarityView) {
  return PROFILE_STATUS_RARITY_META[rarity] ?? PROFILE_STATUS_RARITY_META.RARE;
}

export function ProfileStatusBadge({
  rarity,
  icon,
  title,
  className,
}: {
  rarity: ProfileStatusRarityView;
  icon?: string | null;
  title: string;
  className?: string;
}) {
  const meta = profileStatusRarityClass(rarity);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        meta.ring,
        meta.surface,
        meta.text,
        meta.glow,
        className,
      )}
    >
      <ProfileStatusIcon icon={icon} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </span>
  );
}
