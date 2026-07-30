import type { Metadata } from "next";
import { FaqMarketingPage } from "../FaqMarketingPage";
import { clientFaqPage } from "../faq-content";

export const metadata: Metadata = {
  title: "FAQ NearLoy для клиентов",
  description: "Частые вопросы клиентов NearLoy о бонусах, QR, карте партнёров, мобильном приложении, профиле и безопасности.",
};

export default function ClientFaqPage() {
  return <FaqMarketingPage content={clientFaqPage} />;
}
