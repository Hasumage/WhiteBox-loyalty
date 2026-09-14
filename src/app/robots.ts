import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/business", "/nearloy-hunt", "/hunt/public", "/faq", "/faq/clients", "/faq/business", "/contact"],
        disallow: ["/api/", "/admin/", "/company/", "/settings/", "/payment/", "/login", "/register"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL.replace(/^https?:\/\//, ""),
  };
}
