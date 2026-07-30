import type { Metadata } from "next";
import { FaqMarketingPage } from "../FaqMarketingPage";
import { businessFaqPage } from "../faq-content";

export const metadata: Metadata = {
  title: "FAQ NearLoy для бизнеса",
  description: "Частые вопросы бизнеса NearLoy о подключении компании, кабинете партнёра, сотрудниках, лояльности, аналитике, выплатах и безопасности.",
};

export default function BusinessFaqPage() {
  return <FaqMarketingPage content={businessFaqPage} />;
}
