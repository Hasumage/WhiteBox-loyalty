import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, FileText, Gift, Scale, ShieldCheck } from "lucide-react";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";

export const metadata: Metadata = {
  title: "Правила розыгрыша 100 000 ₽ для бизнеса — NearLoy",
  description: "Условия участия компаний в розыгрыше NearLoy на 100 000 ₽ для развития бизнеса.",
};

const ruleSections = [
  {
    title: "1. Статус мероприятия",
    text: [
      "Розыгрыш проводится как рекламное стимулирующее мероприятие сервиса NearLoy и направлен на продвижение продукта для бизнеса.",
      "Мероприятие не является азартной игрой. Участие не связано с риском проигрыша денежных средств сверх обычных расходов на использование сервиса.",
      "Информация о сроках, призе, порядке участия, правилах определения победителя и выдачи приза размещается на этой странице и может уточняться до даты выбора победителя.",
    ],
  },
  {
    title: "2. Кто может участвовать",
    text: [
      "Участником может быть только реально существующая российская организация, индивидуальный предприниматель или самозанятый, ведущий законную деятельность на территории РФ.",
      "От имени участника действует представитель, которому исполнилось 18 лет и который вправе представлять компанию или предпринимателя.",
      "Один бизнес участвует один раз. Дубли, фиктивные регистрации, подмена данных, массовые технические аккаунты и попытки обойти правила не допускаются.",
    ],
  },
  {
    title: "3. Условия участия",
    text: [
      "Компания должна быть зарегистрирована в NearLoy и иметь активный статус на дату определения победителя.",
      "Тестовые данные, дубли, фиктивные карточки и технические аккаунты сами по себе не дают права на участие.",
      "NearLoy вправе запросить документы или сведения, подтверждающие существование компании, полномочия представителя и корректность участия.",
    ],
  },
  {
    title: "4. Когда проводится розыгрыш",
    text: [
      "Розыгрыш проводится после достижения цели: 50 активных российских компаний в NearLoy.",
      "Дата выбора победителя публикуется дополнительно после достижения цели. Обычно выбор проводится в течение 10 рабочих дней после фиксации списка участников.",
      "Если на дату проверки часть компаний утратила право участия, список формируется только из компаний, которые соответствуют условиям на момент проверки.",
    ],
  },
  {
    title: "5. Приз и порядок выдачи",
    text: [
      "Призовой фонд: один денежный приз 100 000 ₽ на развитие бизнеса.",
      "Победитель определяется случайным образом из списка допущенных компаний. Результат фиксируется внутренним протоколом NearLoy.",
      "Победителю нужно подтвердить реквизиты и документы в срок, указанный в уведомлении. Если победитель не выходит на связь или не подтверждает право на приз, NearLoy вправе выбрать резервного победителя.",
    ],
  },
  {
    title: "6. Налоги, документы и проверки",
    text: [
      "Налоги, сборы, банковские комиссии и иные обязательные платежи обрабатываются по правилам, применимым к статусу победителя и способу выплаты.",
      "NearLoy вправе удержать, перечислить или запросить необходимые налоговые сведения, если это требуется законодательством.",
      "Выплата может быть отложена или отменена, если документы не подтверждены, сведения недостоверны, деятельность нарушает закон или правила NearLoy.",
    ],
  },
  {
    title: "7. Основания для отказа",
    text: [
      "NearLoy может исключить участника при нарушении правил сервиса, попытке мошенничества, использовании чужих данных, искусственном дроблении бизнеса или техническом злоупотреблении.",
      "Участник также может быть исключён при наличии незаконной деятельности, санкционных ограничений, недостоверных реквизитов или утрате активного статуса в NearLoy.",
      "Решение об исключении принимается на основании доступных данных, логов, документов, платёжной истории и результатов проверки.",
    ],
  },
  {
    title: "8. Ответственность и изменения",
    text: [
      "NearLoy не отвечает за сбои связи, недоступность банков, ошибки платёжных провайдеров, недостоверные данные участника или невозможность связаться с представителем компании.",
      "NearLoy вправе обновлять правила, если это нужно для соблюдения закона, защиты участников, исправления технических ошибок или предотвращения злоупотреблений.",
      "Актуальная редакция правил действует с момента публикации на этой странице.",
    ],
  },
];

export default function GiveawayRulesPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(168,85,247,0.12),transparent_26%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="business" />

      <section className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/business/giveaway" className="inline-flex items-center gap-2 text-sm font-semibold text-white/66 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Назад к розыгрышу
        </Link>
        <div className="mt-8 overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_0_70px_rgba(255,255,255,0.055)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50">
            <FileText className="h-4 w-4" />
            Правила розыгрыша
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">100 000 ₽ для развития бизнеса</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/62">
            Ниже — рабочая редакция правил для публичной страницы NearLoy. Перед официальным стартом розыгрыша нужно указать полные реквизиты организатора и финальные календарные даты.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Gift, label: "Приз", value: "100 000 ₽" },
              { icon: BadgeCheck, label: "Цель", value: "50 компаний" },
              { icon: ShieldCheck, label: "Условие", value: "Активная компания" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-black/24 p-5">
                <item.icon className="h-6 w-6 text-cyan-100" />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-white/40">{item.label}</p>
                <p className="mt-2 text-xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-5xl gap-4 px-4 pb-14 sm:px-6 lg:px-8">
        {ruleSections.map((section) => (
          <article key={section.title} className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-white/62">
              {section.text.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-amber-200/18 bg-amber-300/10 p-6">
          <Scale className="h-7 w-7 text-amber-100" />
          <h2 className="mt-4 text-xl font-semibold">Важное юридическое примечание</h2>
          <p className="mt-3 text-sm leading-6 text-white/64">
            Это продуктовая редакция правил, подготовленная для интерфейса. Перед публичным запуском розыгрыша её стоит проверить с юристом, указать точного организатора, ИНН/ОГРН, сроки, порядок обработки персональных данных и налоговый порядок выплаты.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/company/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90">
            Зарегистрировать компанию
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/business" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12">
            На лендинг для бизнеса
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
