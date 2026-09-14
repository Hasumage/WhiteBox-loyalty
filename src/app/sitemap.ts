import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/business", priority: 0.95, changeFrequency: "weekly" },
  { path: "/nearloy-hunt", priority: 0.9, changeFrequency: "weekly" },
  { path: "/hunt/public", priority: 0.65, changeFrequency: "daily" },
  { path: "/faq", priority: 0.55, changeFrequency: "monthly" },
  { path: "/faq/clients", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq/business", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.45, changeFrequency: "monthly" },
  { path: "/careers", priority: 0.35, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
