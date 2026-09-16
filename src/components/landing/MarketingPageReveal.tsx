"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export function MarketingPageReveal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={false}
      className="marketing-page-reveal relative z-10"
    >
      {children}
    </motion.div>
  );
}
