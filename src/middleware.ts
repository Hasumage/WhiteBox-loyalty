import { decodeJwt } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectPreferredLocale, LOCALE_COOKIE } from "@/lib/i18n/shared";

const ACCESS_COOKIE = "wb_access_token";
const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT"]);
const CLIENT_APP_ROLES = new Set(["CLIENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
const ROLES = new Set(["CLIENT", "ADMIN", "SUPER_ADMIN", "MANAGER", "SUPPORT", "COMPANY"]);

function destinationForRole(role: string) {
  if (role === "SUPPORT") return "/admin/support";
  if (ADMIN_ROLES.has(role)) return "/admin";
  if (role === "COMPANY") return "/company";
  return "/app";
}

function responseWithLocale(request: NextRequest, response = NextResponse.next(), defaultLocale?: "ru" | "en") {
  if (!request.cookies.get(LOCALE_COOKIE)?.value) {
    const locale = defaultLocale ?? detectPreferredLocale({
      countryCode:
        request.headers.get("x-vercel-ip-country") ??
        request.headers.get("cf-ipcountry") ??
        request.headers.get("x-country-code"),
      acceptLanguage: request.headers.get("accept-language"),
    });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_MAX_AGE,
      sameSite: "lax",
    });
  }
  return response;
}

function redirectToLogin(request: NextRequest) {
  const isCapacitorApp = request.nextUrl.searchParams.get("app") === "capacitor";
  const login = new URL(isCapacitorApp ? "/mobile-login" : "/login", request.url);
  if (isCapacitorApp) {
    login.searchParams.set("app", "capacitor");
  }
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return responseWithLocale(request, NextResponse.redirect(login));
}

function isCapacitorClientRoute(path: string) {
  return (
    path === "/app" ||
    path === "/map" ||
    path.startsWith("/map/") ||
    path === "/history" ||
    path === "/hunt" ||
    path.startsWith("/hunt/") ||
    path === "/scan" ||
    path === "/company" ||
    path.startsWith("/company/") ||
    path.startsWith("/settings") ||
    path.startsWith("/categories") ||
    path.startsWith("/companies") ||
    path.startsWith("/marketplace")
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path === "/max") {
    return responseWithLocale(request, undefined, "ru");
  }

  if (
    path === "/" ||
    path === "/business" ||
    path === "/landing" ||
    path === "/login" ||
    path === "/register" ||
    path === "/forgot-password" ||
    path === "/mobile-entry" ||
    path === "/mobile-language" ||
    path === "/mobile-login" ||
    path === "/mobile-register" ||
    path === "/mobile-forgot-password" ||
    path === "/company/register"
  ) {
    return responseWithLocale(request);
  }

  if (path.startsWith("/help")) {
    return responseWithLocale(request);
  }

  if (path === "/hunt/public") {
    return responseWithLocale(request);
  }

  if (path.startsWith("/wallet/")) {
    return responseWithLocale(request);
  }

  if (request.nextUrl.searchParams.get("app") === "capacitor" && isCapacitorClientRoute(path)) {
    return responseWithLocale(request);
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const payload = decodeJwt(token);
    const role = typeof payload.role === "string" ? payload.role : undefined;
    const expiresAt = typeof payload.exp === "number" ? payload.exp * 1000 : 0;

    if (!role || !ROLES.has(role) || expiresAt <= Date.now()) {
      return redirectToLogin(request);
    }

    if (path.startsWith("/admin")) {
      if (!ADMIN_ROLES.has(role)) {
        return responseWithLocale(request, NextResponse.redirect(new URL(destinationForRole(role), request.url)));
      }
      if (role === "SUPPORT" && !path.startsWith("/admin/support")) {
        return responseWithLocale(request, NextResponse.redirect(new URL("/admin/support", request.url)));
      }
      return responseWithLocale(request);
    }

    if (path.startsWith("/company")) {
      if (role !== "COMPANY" && !ADMIN_ROLES.has(role)) {
        return responseWithLocale(request, NextResponse.redirect(new URL(destinationForRole(role), request.url)));
      }
      return responseWithLocale(request);
    }

    if (CLIENT_APP_ROLES.has(role)) {
      return responseWithLocale(request);
    }
    if (ADMIN_ROLES.has(role)) {
      return responseWithLocale(request, NextResponse.redirect(new URL("/admin", request.url)));
    }
    if (role === "COMPANY") {
      return responseWithLocale(request, NextResponse.redirect(new URL("/company", request.url)));
    }

    return redirectToLogin(request);
  } catch {
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: [
    "/",
    "/business",
    "/landing",
    "/login",
    "/register",
    "/forgot-password",
    "/mobile-entry",
    "/mobile-language",
    "/mobile-login",
    "/mobile-register",
    "/mobile-forgot-password",
    "/max",
    "/app",
    "/company/register",
    "/map",
    "/history",
    "/hunt",
    "/hunt/:path*",
    "/settings/:path*",
    "/scan",
    "/categories/:path*",
    "/companies/:path*",
    "/marketplace/:path*",
    "/wallet/:path*",
    "/admin/:path*",
    "/company/:path*",
    "/help/:path*",
  ],
};
