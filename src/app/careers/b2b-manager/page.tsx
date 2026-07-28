import type { Metadata } from "next";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { B2BManagerCareerPageClient } from "./B2BManagerCareerPageClient";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Менеджер по привлечению B2B-клиентов — вакансия NearLoy",
  description:
    "Вакансия NearLoy для менеджера по привлечению B2B-клиентов: локальный бизнес, loyalty-tech, партнёрские продажи, развитие клиентской базы и долгосрочный доход от привлечённых компаний.",
  keywords: [
    "nearloy вакансии",
    "NearLoy вакансии",
    "NearLoy работа",
    "вакансия NearLoy",
    "менеджер по привлечению B2B клиентов",
    "B2B менеджер NearLoy",
    "работа B2B продажи",
    "работа loyalty tech",
    "B2B client acquisition manager",
  ],
  alternates: {
    canonical: "/careers/b2b-manager",
  },
  openGraph: {
    title: "Менеджер по привлечению B2B-клиентов — NearLoy",
    description:
      "Ищем человека, который поможет привлекать первые компании, выстраивать B2B-продажи и развивать партнёрскую базу NearLoy.",
    url: "/careers/b2b-manager",
    siteName: "NearLoy",
    locale: "ru_RU",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Менеджер по привлечению B2B-клиентов — NearLoy",
    description: "Вакансия NearLoy: B2B-продажи, локальный бизнес и развитие партнёрской базы.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jobPostingJsonLd = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Менеджер по привлечению B2B-клиентов",
  description:
    "NearLoy ищет менеджера по привлечению B2B-клиентов для запуска продаж, поиска локальных бизнесов, проведения презентаций и сопровождения компаний до подключения. Основная модель вознаграждения — 30% от стоимости подписки каждой привлечённой компании, пока компания продолжает пользоваться NearLoy и оплачивать подписку.",
  datePosted: "2026-07-18",
  employmentType: ["CONTRACTOR", "PART_TIME"],
  hiringOrganization: {
    "@type": "Organization",
    name: "NearLoy",
    url: SITE_URL,
  },
  jobLocationType: "TELECOMMUTE",
  applicantLocationRequirements: {
    "@type": "Country",
    name: "Russia",
  },
  industry: "Loyalty technology, SaaS, B2B sales",
  directApply: false,
  url: `${SITE_URL}/careers/b2b-manager`,
};

export default function B2BManagerCareerPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.14),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(168,85,247,0.16),transparent_28%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader />
      <B2BManagerCareerPageClient />
      <MarketingFooter />
    </main>
  );
}
