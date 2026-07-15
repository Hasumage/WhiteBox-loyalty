// #SubNearloyCode: клиентские подписки и создание подписок компаниями временно скрыты даже локально.
// #SubNearloyCode: чтобы вернуть модуль, снова подключите env-флаг ниже и проверьте все места с этой меткой.
// export const SUBSCRIPTIONS_ENABLED = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === "true";
export const SUBSCRIPTIONS_ENABLED = false;

export const subscriptionsReleaseMessage = {
  // #SubNearloyCode: прямые переходы в скрытый клиентский модуль не должны раскрывать подписки до запуска.
  title: "Раздел пока закрыт",
  description:
    "Сейчас в NearLoy доступны бонусы, QR, уровни, статусы и карта партнёров. Этот раздел вернётся отдельным обновлением после тестирования.",
  companyTitle: "Модуль тарифов пока закрыт",
  companyDescription:
    "Пока компании работают с клиентами, QR-кодами, баллами и уровнями. Создание тарифов и услуги для клиентов появятся после отдельного запуска.",
};
