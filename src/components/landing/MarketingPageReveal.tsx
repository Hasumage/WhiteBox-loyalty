"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

export function MarketingPageReveal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="marketing-page-reveal relative z-10"
    >
      {children}
    </motion.div>
  );
}
