import { cn } from "@/lib/utils";

export function NearLoyLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("h-9 w-9", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nl-gradient" x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#76D7FF" />
          <stop offset="1" stopColor="#40C4A8" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="24" height="24" rx="8" fill="#0B1220" stroke="url(#nl-gradient)" strokeWidth="1.5" />
      <path d="M10 12H16V20H10V12Z" stroke="#E8F6FF" strokeWidth="1.5" />
      <path d="M16 12H22V20H16V12Z" stroke="#E8F6FF" strokeWidth="1.5" />
      <path d="M16 12V20" stroke="url(#nl-gradient)" strokeWidth="1.5" />
      <path d="M10 16H22" stroke="url(#nl-gradient)" strokeWidth="1.5" />
    </svg>
  );
}
