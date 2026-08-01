"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LayoutDashboard, LogIn } from "lucide-react";
import { authenticatedDestination, getAccessToken, getStoredUser, type StoredUser } from "@/lib/api/auth-client";
import { cn } from "@/lib/utils";

type MarketingAccountButtonProps = {
  locale: "ru" | "en";
  className?: string;
  signedOutClassName?: string;
  signedInClassName?: string;
  withArrow?: boolean;
  onClick?: () => void;
};

export function MarketingAccountButton({
  locale,
  className,
  signedOutClassName,
  signedInClassName,
  withArrow = false,
  onClick,
}: MarketingAccountButtonProps) {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    function updateUser() {
      setUser(getAccessToken() ? getStoredUser() : null);
    }
    updateUser();
    window.addEventListener("nearloy:auth-updated", updateUser);
    window.addEventListener("storage", updateUser);
    return () => {
      window.removeEventListener("nearloy:auth-updated", updateUser);
      window.removeEventListener("storage", updateUser);
    };
  }, []);

  const isSignedIn = Boolean(user);
  const href = user ? authenticatedDestination(user, null) : "/login";
  const label = isSignedIn
    ? locale === "ru"
      ? "Личный кабинет"
      : "Dashboard"
    : locale === "ru"
      ? "Войти"
      : "Sign in";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition",
        isSignedIn
          ? "border border-cyan-100/25 bg-cyan-200/12 text-cyan-50 shadow-[0_0_34px_rgba(103,232,249,0.16)] hover:border-cyan-100/40 hover:bg-cyan-200/18"
          : "border border-white/12 bg-white/7 text-white hover:bg-white/12",
        className,
        isSignedIn ? signedInClassName : signedOutClassName,
      )}
    >
      {isSignedIn ? <LayoutDashboard className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
      {label}
      {withArrow ? <ArrowRight className="h-4 w-4" /> : null}
    </Link>
  );
}
