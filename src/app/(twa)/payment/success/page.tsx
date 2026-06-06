import { Suspense } from "react";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { PaymentSuccessClient } from "./payment-success-client";

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<TwaLoadingScreen title="Проверяем оплату" subtitle="Сверяем статус YooKassa и активируем подписку." />}>
      <PaymentSuccessClient />
    </Suspense>
  );
}
