import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { CareerRolePageClient } from "../CareerRolePageClient";
import { CAREER_ROLE_SLUGS, getCareerRole } from "../careerRoles";

type CareerRolePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

export function generateStaticParams() {
  return CAREER_ROLE_SLUGS.filter((slug) => slug !== "b2b-manager").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CareerRolePageProps): Promise<Metadata> {
  const { slug } = await params;
  const role = getCareerRole(slug, "ru");
  const roleEn = getCareerRole(slug, "en");

  if (!role || role.slug === "b2b-manager") {
    return {
      title: "Вакансия NearLoy",
      robots: { index: false, follow: false },
    };
  }

  const title = `${role.title} — вакансия NearLoy`;
  const description = `${role.detail.lead} ${roleEn ? roleEn.detail.lead : ""}`.trim();

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: [
      "nearloy вакансии",
      "NearLoy работа",
      role.title,
      roleEn?.title ?? "",
      "работа в стартапе",
      "loyalty tech jobs",
      "SaaS careers",
    ].filter(Boolean),
    alternates: {
      canonical: `/careers/${role.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/careers/${role.slug}`,
      siteName: "NearLoy",
      type: "article",
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
}

function buildRoleJsonLd(slug: string) {
  const role = getCareerRole(slug, "ru");
  if (!role) return null;

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: role.title,
    description: `${role.detail.lead}\n\n${role.detail.mission}\n\n${role.detail.expectations.join("\n")}`,
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
  };
}

export default async function CareerRolePage({ params }: CareerRolePageProps) {
  const { slug } = await params;
  const role = getCareerRole(slug, "ru");

  if (!role || role.slug === "b2b-manager") {
    notFound();
  }

  const jsonLd = buildRoleJsonLd(slug);

  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      {jsonLd ? (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(168,85,247,0.16),transparent_28%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader />
      <CareerRolePageClient slug={slug} />
      <MarketingFooter />
    </main>
  );
}
