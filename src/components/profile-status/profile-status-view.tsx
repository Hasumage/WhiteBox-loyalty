import type { ComponentType } from "react";
import {
  Award,
  BadgeCheck,
  BellRing,
  BookOpen,
  Boxes,
  Brain,
  BriefcaseBusiness,
  Brush,
  Cake,
  CalendarDays,
  Camera,
  CircleDollarSign,
  Coffee,
  Compass,
  Crown,
  Diamond,
  Dumbbell,
  Flag,
  Flame,
  Flower2,
  FlaskConical,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  Handshake,
  Heart,
  HeartHandshake,
  HeartPulse,
  Hourglass,
  KeyRound,
  Landmark,
  Lightbulb,
  MapPinned,
  Medal,
  Milestone,
  MoonStar,
  Music,
  Plane,
  QrCode,
  RadioTower,
  Rocket,
  Route,
  ScanLine,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  SmilePlus,
  Sparkle,
  Sparkles,
  Sprout,
  Star,
  Stars,
  Sunrise,
  Tags,
  Target,
  Ticket,
  TicketCheck,
  TimerReset,
  Trophy,
  UsersRound,
  Wallet,
  WalletCards,
  WandSparkles,
  Waves,
  Zap,
} from "lucide-react";
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

export type ProfileStatusIconOption = {
  value: string;
  label: string;
  group: "achievements" | "loyalty" | "city" | "lifestyle" | "energy";
};

export const PROFILE_STATUS_ICON_GROUPS: Record<ProfileStatusIconOption["group"], string> = {
  achievements: "Достижения",
  loyalty: "Лояльность",
  city: "Город и партнёры",
  lifestyle: "Стиль и интересы",
  energy: "Энергия",
};

const PROFILE_STATUS_ICON_GROUP_ORDER: Record<ProfileStatusIconOption["group"], number> = {
  achievements: 0,
  loyalty: 1,
  city: 2,
  lifestyle: 3,
  energy: 4,
};

export const PROFILE_STATUS_ICON_OPTIONS: ProfileStatusIconOption[] = ([
  { value: "Award", label: "Награда", group: "achievements" },
  { value: "BadgeCheck", label: "Проверено", group: "achievements" },
  { value: "Crown", label: "Корона", group: "achievements" },
  { value: "Diamond", label: "Алмаз", group: "achievements" },
  { value: "Gem", label: "Кристалл", group: "achievements" },
  { value: "Medal", label: "Медаль", group: "achievements" },
  { value: "ShieldCheck", label: "Щит", group: "achievements" },
  { value: "Star", label: "Звезда", group: "achievements" },
  { value: "Stars", label: "Созвездие", group: "achievements" },
  { value: "Trophy", label: "Кубок", group: "achievements" },
  { value: "BellRing", label: "Сигнал", group: "loyalty" },
  { value: "CircleDollarSign", label: "Монета", group: "loyalty" },
  { value: "Gift", label: "Подарок", group: "loyalty" },
  { value: "QrCode", label: "QR", group: "loyalty" },
  { value: "ScanLine", label: "Скан", group: "loyalty" },
  { value: "Tags", label: "Категории", group: "loyalty" },
  { value: "Ticket", label: "Билет", group: "loyalty" },
  { value: "TicketCheck", label: "Абонемент", group: "loyalty" },
  { value: "Wallet", label: "Кошелёк", group: "loyalty" },
  { value: "WalletCards", label: "Карты", group: "loyalty" },
  { value: "Boxes", label: "Набор", group: "city" },
  { value: "BriefcaseBusiness", label: "Бизнес", group: "city" },
  { value: "Compass", label: "Компас", group: "city" },
  { value: "Flag", label: "Флаг", group: "city" },
  { value: "Handshake", label: "Партнёры", group: "city" },
  { value: "Landmark", label: "Площадь", group: "city" },
  { value: "MapPinned", label: "Метка", group: "city" },
  { value: "Milestone", label: "Маршрут", group: "city" },
  { value: "Plane", label: "Путешествие", group: "city" },
  { value: "Route", label: "Путь", group: "city" },
  { value: "BookOpen", label: "Книга", group: "lifestyle" },
  { value: "Brain", label: "Ум", group: "lifestyle" },
  { value: "Brush", label: "Творчество", group: "lifestyle" },
  { value: "Cake", label: "Праздник", group: "lifestyle" },
  { value: "Camera", label: "Кадр", group: "lifestyle" },
  { value: "Coffee", label: "Кофе", group: "lifestyle" },
  { value: "Dumbbell", label: "Фитнес", group: "lifestyle" },
  { value: "FlaskConical", label: "Эксперимент", group: "lifestyle" },
  { value: "Flower2", label: "Красота", group: "lifestyle" },
  { value: "Gamepad2", label: "Игра", group: "lifestyle" },
  { value: "GraduationCap", label: "Обучение", group: "lifestyle" },
  { value: "Heart", label: "Сердце", group: "lifestyle" },
  { value: "HeartHandshake", label: "Доверие", group: "lifestyle" },
  { value: "HeartPulse", label: "Здоровье", group: "lifestyle" },
  { value: "Music", label: "Музыка", group: "lifestyle" },
  { value: "ShoppingBag", label: "Покупки", group: "lifestyle" },
  { value: "UsersRound", label: "Люди", group: "lifestyle" },
  { value: "CalendarDays", label: "Календарь", group: "energy" },
  { value: "Flame", label: "Огонь", group: "energy" },
  { value: "Hourglass", label: "Время", group: "energy" },
  { value: "KeyRound", label: "Ключ", group: "energy" },
  { value: "Lightbulb", label: "Идея", group: "energy" },
  { value: "MoonStar", label: "Ночь", group: "energy" },
  { value: "RadioTower", label: "Башня", group: "energy" },
  { value: "Rocket", label: "Ракета", group: "energy" },
  { value: "ScrollText", label: "История", group: "energy" },
  { value: "SmilePlus", label: "Настроение", group: "energy" },
  { value: "Sparkle", label: "Искра", group: "energy" },
  { value: "Sparkles", label: "Сияние", group: "energy" },
  { value: "Sprout", label: "Рост", group: "energy" },
  { value: "Sunrise", label: "Рассвет", group: "energy" },
  { value: "Target", label: "Цель", group: "energy" },
  { value: "TimerReset", label: "Таймер", group: "energy" },
  { value: "WandSparkles", label: "Магия", group: "energy" },
  { value: "Waves", label: "Волна", group: "energy" },
  { value: "Zap", label: "Молния", group: "energy" },
] satisfies ProfileStatusIconOption[]).sort((left, right) => {
  const groupDelta = PROFILE_STATUS_ICON_GROUP_ORDER[left.group] - PROFILE_STATUS_ICON_GROUP_ORDER[right.group];
  if (groupDelta !== 0) return groupDelta;
  return left.label.localeCompare(right.label, "ru");
});

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Award,
  BadgeCheck,
  BellRing,
  BookOpen,
  Boxes,
  Brain,
  BriefcaseBusiness,
  Brush,
  Cake,
  CalendarDays,
  Camera,
  CircleDollarSign,
  Coffee,
  Compass,
  Crown,
  Diamond,
  Dumbbell,
  Flag,
  Flame,
  Flower2,
  FlaskConical,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  Handshake,
  Heart,
  HeartHandshake,
  HeartPulse,
  Hourglass,
  KeyRound,
  Landmark,
  Lightbulb,
  MapPinned,
  Medal,
  Milestone,
  MoonStar,
  Music,
  Plane,
  QrCode,
  RadioTower,
  Rocket,
  Route,
  ScanLine,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  SmilePlus,
  Sparkle,
  Sparkles,
  Sprout,
  Star,
  Stars,
  Sunrise,
  Tags,
  Target,
  Ticket,
  TicketCheck,
  TimerReset,
  Trophy,
  UsersRound,
  Wallet,
  WalletCards,
  WandSparkles,
  Waves,
  Zap,
};

export function ProfileStatusIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = icon ? ICONS[icon] ?? Sparkles : Sparkles;
  return <Icon className={className} />;
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
