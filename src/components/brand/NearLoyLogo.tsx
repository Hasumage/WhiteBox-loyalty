import { cn } from "@/lib/utils";

export function NearLoyLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden
      className={cn("h-9 w-9 shrink-0 overflow-visible", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="nearloy-logo-shadow" x="-6%" y="-6%" width="112%" height="112%">
          <feDropShadow dx="5" dy="6" stdDeviation="1.2" floodColor="#6f8080" floodOpacity="0.38" />
        </filter>
      </defs>
      <rect x="14" y="14" width="484" height="484" rx="104" fill="#000000" stroke="#67E8F9" strokeOpacity="0.55" strokeWidth="12" />
      <g
        fill="none"
        stroke="#ecfeff"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#nearloy-logo-shadow)"
      >
        <path d="M104 186V104H186" strokeWidth="24" />
        <path d="M326 104H408V186" strokeWidth="24" />
        <path d="M408 326V408H326" strokeWidth="24" />
        <path d="M186 408H104V326" strokeWidth="24" />
        <path d="M256 66L310 196L446 256L310 316L256 446L202 316L66 256L202 196Z" strokeWidth="46" />
      </g>
    </svg>
  );
}
