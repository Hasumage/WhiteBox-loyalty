import { translate, type TranslationKey } from "./dictionary";

describe("i18n dictionary", () => {
  it("returns translated static copy by key", () => {
    expect(translate("ru", "admin.telegram.title")).toBe("Уведомления в Telegram");
    expect(translate("en", "admin.telegram.title")).toBe("Telegram notifications");
  });

  it("keeps dictionary keys typed", () => {
    const key: TranslationKey = "admin.telegram.createSecureLink";

    expect(translate("ru", key)).toBe("Создать защищённую ссылку");
  });

  it("contains admin shell and page namespaces for future framework migration", () => {
    expect(translate("ru", "admin.nav.usersPartners")).toBe("Пользователи и партнёры");
    expect(translate("en", "admin.nav.companyVerification")).toBe("Company verification");
    expect(translate("ru", "admin.dashboard.title")).toBe("Доброе утро, команда. Вот текущий пульс платформы.");
    expect(translate("en", "admin.leads.retryDue")).toBe("Retry due Telegram sends");
    expect(translate("ru", "admin.verifications.syncStorage")).toBe("Синхронизировать");
  });

  it("keeps new Telegram routing page copy localized", () => {
    expect(translate("ru", "admin.telegram.centerTitle")).toBe("Центр Telegram-уведомлений");
    expect(translate("ru", "admin.telegram.routingList")).toBe("Список Telegram-подключений админов");
    expect(translate("en", "admin.telegram.routingList")).toBe("Admin Telegram routing list");
  });

  it("keeps newly translated admin pages localized", () => {
    expect(translate("ru", "admin.subscriptions.title")).toBe("Аналитика подписок");
    expect(translate("ru", "admin.support.guardRails")).toBe("Ограничения доступа");
    expect(translate("ru", "admin.compliance.title")).toBe("Комплаенс");
  });
});
