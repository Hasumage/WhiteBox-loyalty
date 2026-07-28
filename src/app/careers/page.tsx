import type { Metadata } from "next";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { CareersPageClient } from "./CareersPageClient";
import { getCareerRoles } from "./careerRoles";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

const title = "Вакансии NearLoy — работа в loyalty-tech, B2B, продукте и разработке";
const description =
  "Открытые вакансии NearLoy: B2B-менеджер, full-stack инженер, backend, продуктовый UI, Partner Success и операции. Работа в стартапе про программы лояльности и сервис для компаний.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  keywords: [
    "nearloy вакансии",
    "NearLoy работа",
    "работа NearLoy",
    "NearLoy careers",
    "вакансии стартап",
    "вакансии loyalty tech",
    "B2B менеджер NearLoy",
    "работа менеджер B2B",
    "full-stack инженер стартап",
    "product designer startup",
  ],
  alternates: {
    canonical: "/careers",
  },
  openGraph: {
    title,
    description,
    url: "/careers",
    siteName: "NearLoy",
    type: "website",
    locale: "ru_RU",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

function buildCareersJsonLd() {
  const roles = getCareerRoles("ru");

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: `${SITE_URL}/careers`,
      inLanguage: ["ru-RU", "en-US"],
      about: {
        "@type": "Organization",
        name: "NearLoy",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Вакансии NearLoy",
      itemListElement: roles.map((role, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: role.title,
        url: `${SITE_URL}${role.href}`,
      })),
    },
    ...roles.map((role) => ({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: role.title,
      description: `${role.intro}\n\n${role.points.join("\n")}`,
      datePosted: "2026-07-18",
      employmentType: ["CONTRACTOR", "PART_TIME"],
      hiringOrganization: {
        "@type": "Organization",
        name: "NearLoy",
        sameAs: SITE_URL,
      },
      jobLocationType: "TELECOMMUTE",
      applicantLocationRequirements: {
        "@type": "Country",
        name: "Russia",
      },
      industry: "Loyalty technology, SaaS, B2B",
      url: `${SITE_URL}${role.href}`,
    })),
  ];
}

export default function CareersPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildCareersJsonLd()) }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(168,85,247,0.16),transparent_28%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader />
      <CareersPageClient />
      <MarketingFooter />
    </main>
  );
}
