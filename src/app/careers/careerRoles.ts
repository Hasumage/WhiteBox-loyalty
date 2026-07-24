import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Code2,
  Compass,
  HeartHandshake,
  LifeBuoy,
  Megaphone,
  Palette,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Locale } from "@/lib/i18n/shared";

type LocalizedString = Record<Locale, string>;

type CareerRoleSource = {
  slug: string;
  href: string;
  icon: LucideIcon;
  title: LocalizedString;
  tag: LocalizedString;
  intro: LocalizedString;
  points: LocalizedString[];
  featured?: boolean;
  detail: {
    badge: LocalizedString;
    lead: LocalizedString;
    mission: LocalizedString;
    focus: Array<{
      icon: LucideIcon;
      title: LocalizedString;
      text: LocalizedString;
    }>;
    expectations: LocalizedString[];
    growth: LocalizedString[];
  };
};

export type CareerRole = {
  slug: string;
  href: string;
  icon: LucideIcon;
  title: string;
  tag: string;
  intro: string;
  points: string[];
  featured?: boolean;
  detail: {
    badge: string;
    lead: string;
    mission: string;
    focus: Array<{
      icon: LucideIcon;
      title: string;
      text: string;
    }>;
    expectations: string[];
    growth: string[];
  };
};

type CareersPageCopy = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  rolesEyebrow: string;
  rolesTitle: string;
  rolesIntro: string;
  applyBadge: string;
  applyTitle: string;
  applyText: string;
  applyCta: string;
};

const l = (value: LocalizedString, locale: Locale) => value[locale] ?? value.ru;

const careerRoleSources: CareerRoleSource[] = [
  {
    slug: "b2b-manager",
    href: "/careers/b2b-manager",
    icon: Megaphone,
    title: {
      ru: "Менеджер по привлечению B2B-клиентов",
      en: "B2B Client Acquisition Manager",
    },
    tag: {
      ru: "Главная роль запуска",
      en: "Launch key role",
    },
    intro: {
      ru: "Искать локальные бизнесы, проводить первые переговоры, подключать компании к NearLoy и помогать выстроить систему B2B-продаж.",
      en: "Find local businesses, run first conversations, onboard companies to NearLoy and help build the B2B sales system.",
    },
    points: [
      {
        ru: "30% от стоимости подписки каждой привлечённой компании",
        en: "30% of the subscription value from each referred company",
      },
      {
        ru: "Доход сохраняется, пока компания продолжает пользоваться NearLoy",
        en: "Recurring income while the company keeps using NearLoy",
      },
      {
        ru: "Роль может вырасти в руководство направлением продаж и маркетинга",
        en: "The role can grow into sales and marketing leadership",
      },
    ],
    featured: true,
    detail: {
      badge: {
        ru: "B2B и партнёрства",
        en: "B2B and partnerships",
      },
      lead: {
        ru: "Роль для человека, который умеет находить бизнесы, начинать разговор и превращать интерес в подключённую компанию.",
        en: "A role for someone who can find businesses, start conversations and turn interest into connected partners.",
      },
      mission: {
        ru: "На старте NearLoy важно не просто продавать, а вместе с продуктом понять, какие аргументы, сценарии и процессы реально работают для локального бизнеса.",
        en: "At the launch stage, NearLoy needs more than sales: we need to discover which arguments, flows and processes truly work for local businesses.",
      },
      focus: [],
      expectations: [],
      growth: [],
    },
  },
  {
    slug: "full-stack-engineer",
    href: "/careers/full-stack-engineer",
    icon: Code2,
    title: {
      ru: "Full-stack инженер",
      en: "Full-stack Engineer",
    },
    tag: {
      ru: "Продукт и платформа",
      en: "Product and platform",
    },
    intro: {
      ru: "Развивать кабинеты, платёжные сценарии, карты, AI-модули и внутренние инструменты.",
      en: "Build dashboards, payment flows, maps, AI modules and internal tools.",
    },
    points: [
      { ru: "Next.js, TypeScript и аккуратный UI", en: "Next.js, TypeScript and careful UI work" },
      { ru: "API, права доступа и интеграции", en: "API, permissions and integrations" },
      {
        ru: "Умение доводить фичу до продакшена",
        en: "Ability to ship a feature all the way to production",
      },
    ],
    detail: {
      badge: {
        ru: "Инженерия продукта",
        en: "Product engineering",
      },
      lead: {
        ru: "Нужен инженер, который любит не только писать код, но и понимать, зачем экран, API или сценарий существуют в продукте.",
        en: "We need an engineer who likes writing code and also understands why a screen, API or flow exists in the product.",
      },
      mission: {
        ru: "NearLoy быстро растёт по функциям: кабинеты клиентов и компаний, админка, платежи, карты, медиа, AI и внутренние инструменты. Важно держать качество, скорость и понятную архитектуру.",
        en: "NearLoy is growing across customer and company dashboards, admin tools, payments, maps, media, AI and internal workflows. We need quality, speed and clear architecture.",
      },
      focus: [
        {
          icon: Code2,
          title: { ru: "Интерфейсы и сценарии", en: "Interfaces and flows" },
          text: {
            ru: "Делать аккуратные экраны на Next.js и TypeScript: от мобильных клиентских страниц до сложной админки.",
            en: "Build polished Next.js and TypeScript screens: from mobile customer pages to complex admin panels.",
          },
        },
        {
          icon: ServerCog,
          title: { ru: "API и интеграции", en: "API and integrations" },
          text: {
            ru: "Связывать UI с серверной логикой, платежами, правами доступа, уведомлениями и внешними сервисами.",
            en: "Connect UI with backend logic, payments, permissions, notifications and external services.",
          },
        },
        {
          icon: Compass,
          title: { ru: "Продуктовое мышление", en: "Product thinking" },
          text: {
            ru: "Замечать слабые места сценариев и предлагать более надёжные решения.",
            en: "Spot weak points in product flows and suggest stronger solutions.",
          },
        },
      ],
      expectations: [
        { ru: "уверенно работаете с TypeScript и React/Next.js", en: "confident with TypeScript and React/Next.js" },
        {
          ru: "понимаете API, состояния, формы и права доступа",
          en: "understand APIs, state, forms and access control",
        },
        {
          ru: "доводите фичу от идеи до проверяемого результата",
          en: "take a feature from idea to verifiable result",
        },
        {
          ru: "бережно относитесь к данным, миграциям и пользовательским сценариям",
          en: "treat data, migrations and user flows carefully",
        },
      ],
      growth: [
        { ru: "участие в архитектуре ключевых модулей", en: "shape architecture of key modules" },
        { ru: "возможность вести продуктовые направления", en: "opportunity to own product areas" },
        { ru: "влияние на инженерные практики", en: "influence engineering practices" },
      ],
    },
  },
  {
    slug: "backend-engineer",
    href: "/careers/backend-engineer",
    icon: ShieldCheck,
    title: {
      ru: "Backend инженер",
      en: "Backend Engineer",
    },
    tag: {
      ru: "Надёжность и финансы",
      en: "Reliability and finance",
    },
    intro: {
      ru: "Укреплять серверную часть: платежи, выплаты, уведомления, отчёты и безопасные операции.",
      en: "Strengthen backend systems: payments, payouts, notifications, reporting and safe operations.",
    },
    points: [
      { ru: "NestJS, Prisma, PostgreSQL", en: "NestJS, Prisma, PostgreSQL" },
      { ru: "Очереди, вебхуки и аудит действий", en: "Queues, webhooks and audit trails" },
      { ru: "Внимательность к данным и миграциям", en: "Careful work with data and migrations" },
    ],
    detail: {
      badge: {
        ru: "Сервер и безопасность",
        en: "Backend and security",
      },
      lead: {
        ru: "Роль для человека, которому интересно держать в порядке платежи, данные, интеграции и критичные бизнес-процессы.",
        en: "A role for someone who enjoys keeping payments, data, integrations and critical business processes in order.",
      },
      mission: {
        ru: "В NearLoy много чувствительной логики: подписки компаний, выплаты, уведомления, права, аудит, Telegram, email и внешние платёжные провайдеры. Здесь нужна аккуратность без героического хаоса.",
        en: "NearLoy has a lot of sensitive logic: company subscriptions, payouts, notifications, permissions, audit, Telegram, email and payment providers. It needs discipline, not heroic chaos.",
      },
      focus: [
        {
          icon: ServerCog,
          title: { ru: "Серверные модули", en: "Backend modules" },
          text: {
            ru: "Развивать API, фоновые задачи, вебхуки, очереди и отчётные сценарии.",
            en: "Build APIs, background jobs, webhooks, queues and reporting flows.",
          },
        },
        {
          icon: ShieldCheck,
          title: { ru: "Надёжность", en: "Reliability" },
          text: {
            ru: "Следить за идемпотентностью, аудитом, правами доступа, ошибками провайдеров и восстановлением после сбоев.",
            en: "Own idempotency, audit trails, permissions, provider errors and failure recovery.",
          },
        },
        {
          icon: Sparkles,
          title: { ru: "Чистые процессы", en: "Clean processes" },
          text: {
            ru: "Превращать сложные ручные операции в понятные безопасные сценарии.",
            en: "Turn complex manual operations into clear and safe workflows.",
          },
        },
      ],
      expectations: [
        {
          ru: "понимаете PostgreSQL, Prisma и серверную архитектуру",
          en: "understand PostgreSQL, Prisma and backend architecture",
        },
        {
          ru: "умеете проектировать безопасные операции с данными",
          en: "can design safe data operations",
        },
        {
          ru: "аккуратно относитесь к миграциям и внешним интеграциям",
          en: "handle migrations and external integrations carefully",
        },
        {
          ru: "разбираете сложные баги до причины, а не до заплатки",
          en: "debug root causes instead of stopping at surface patches",
        },
      ],
      growth: [
        { ru: "ответственность за финансовые и инфраструктурные модули", en: "own finance and infrastructure modules" },
        { ru: "участие в проектировании внутренних сервисов", en: "design internal services" },
        { ru: "рост в сторону lead backend / platform engineer", en: "growth toward lead backend / platform engineer" },
      ],
    },
  },
  {
    slug: "product-ui-designer",
    href: "/careers/product-ui-designer",
    icon: Palette,
    title: {
      ru: "Product / UI дизайнер",
      en: "Product / UI Designer",
    },
    tag: {
      ru: "Интерфейсы",
      en: "Interfaces",
    },
    intro: {
      ru: "Проектировать понятные экраны для клиентов, компаний, PR-менеджеров и админки.",
      en: "Design clear screens for customers, companies, PR managers and admins.",
    },
    points: [
      { ru: "Мобильные сценарии и web-кабинеты", en: "Mobile flows and web dashboards" },
      { ru: "Дизайн-система в тёмной эстетике NearLoy", en: "Design system in NearLoy’s dark aesthetic" },
      { ru: "Прототипы без лишней декоративности", en: "Prototypes without decorative noise" },
    ],
    detail: {
      badge: {
        ru: "Продуктовый дизайн",
        en: "Product design",
      },
      lead: {
        ru: "Нужен дизайнер, который умеет делать красиво, но не забывает, что интерфейс должен работать у кассы, в телефоне и в админке.",
        en: "We need a designer who can make things beautiful while remembering that the interface must work at the checkout, on phones and in admin tools.",
      },
      mission: {
        ru: "NearLoy сочетает клиентское приложение, публичные карточки компаний, кабинет бизнеса, PR-инструменты и админские панели. Нужно держать единый стиль и не превращать продукт в музей красивых, но непонятных экранов.",
        en: "NearLoy combines a customer app, public company cards, business workspace, PR tools and admin panels. The product needs one clear visual language, not a museum of beautiful but confusing screens.",
      },
      focus: [
        {
          icon: Palette,
          title: { ru: "UI-система", en: "UI system" },
          text: {
            ru: "Развивать визуальный язык NearLoy: glass, тёмные экраны, карточки, состояния, пустые экраны и мобильные сценарии.",
            en: "Develop the NearLoy visual language: glass, dark screens, cards, states, empty screens and mobile flows.",
          },
        },
        {
          icon: Users,
          title: { ru: "Пользовательские пути", en: "User journeys" },
          text: {
            ru: "Проектировать сценарии клиентов, компаний, кассиров, PR-менеджеров и админов.",
            en: "Design flows for customers, companies, cashiers, PR managers and admins.",
          },
        },
        {
          icon: Sparkles,
          title: { ru: "Быстрые прототипы", en: "Fast prototypes" },
          text: {
            ru: "Собирать варианты, которые можно быстро проверить и передать в разработку без лишнего шума.",
            en: "Create options that can be quickly tested and handed to engineering without noise.",
          },
        },
      ],
      expectations: [
        { ru: "понимаете мобильные интерфейсы и web-кабинеты", en: "understand mobile interfaces and web dashboards" },
        {
          ru: "работаете с дизайн-системой и состояниями компонентов",
          en: "work with design systems and component states",
        },
        {
          ru: "видите, где интерфейс перегружен и что нужно убрать",
          en: "see where an interface is overloaded and what should be removed",
        },
        { ru: "можете объяснить решение простым языком", en: "can explain design decisions in simple language" },
      ],
      growth: [
        { ru: "влияние на визуальную систему NearLoy", en: "shape NearLoy’s visual system" },
        { ru: "работа над ключевыми пользовательскими сценариями", en: "work on key user journeys" },
        { ru: "рост в сторону product designer / design lead", en: "growth toward product designer / design lead" },
      ],
    },
  },
  {
    slug: "partner-success",
    href: "/careers/partner-success",
    icon: LifeBuoy,
    title: {
      ru: "Partner Success",
      en: "Partner Success",
    },
    tag: {
      ru: "Поддержка компаний",
      en: "Company support",
    },
    intro: {
      ru: "Помогать партнёрам настраивать карточку, уровни, акции, команду и первые операции.",
      en: "Help partners set up their card, levels, offers, team and first operations.",
    },
    points: [
      { ru: "Сильная эмпатия к пользователю", en: "Strong user empathy" },
      { ru: "Умение объяснять сложное простым языком", en: "Ability to explain complex things simply" },
      { ru: "Сбор проблем и передача в продукт", en: "Collect issues and turn them into product feedback" },
    ],
    detail: {
      badge: {
        ru: "Партнёрский запуск",
        en: "Partner onboarding",
      },
      lead: {
        ru: "Роль для человека, который помогает компаниям не просто зарегистрироваться, а реально начать пользоваться NearLoy.",
        en: "A role for someone who helps companies not just register, but actually start using NearLoy.",
      },
      mission: {
        ru: "Партнёрам нужно быстро понять, как оформить карточку, настроить уровни, добавить команду, запустить акции и не потеряться в интерфейсе. Здесь важны спокойствие, ясность и человеческая поддержка.",
        en: "Partners need to quickly understand how to prepare their card, levels, team and offers without getting lost. Calm, clarity and human support matter here.",
      },
      focus: [
        {
          icon: LifeBuoy,
          title: { ru: "Онбординг компаний", en: "Company onboarding" },
          text: {
            ru: "Проводить партнёра через первые настройки и помогать довести профиль до готовности.",
            en: "Guide partners through first settings and help make their profile ready.",
          },
        },
        {
          icon: HeartHandshake,
          title: { ru: "Поддержка отношений", en: "Relationship support" },
          text: {
            ru: "Отвечать на вопросы, замечать блокеры и помогать компании получать пользу от продукта.",
            en: "Answer questions, notice blockers and help companies get value from the product.",
          },
        },
        {
          icon: ClipboardList,
          title: { ru: "Обратная связь", en: "Feedback" },
          text: {
            ru: "Собирать повторяющиеся проблемы и передавать их в продукт понятными задачами.",
            en: "Collect recurring issues and turn them into clear product tasks.",
          },
        },
      ],
      expectations: [
        { ru: "умеете объяснять простым языком", en: "can explain things simply" },
        { ru: "терпеливо относитесь к вопросам пользователей", en: "are patient with user questions" },
        { ru: "структурируете хаос в понятные шаги", en: "structure chaos into clear next steps" },
        { ru: "видите, где проблема в продукте, а не в человеке", en: "can see when the product, not the person, is the problem" },
      ],
      growth: [
        { ru: "формирование базы знаний и сценариев поддержки", en: "build a knowledge base and support playbooks" },
        { ru: "улучшение онбординга компаний", en: "improve company onboarding" },
        { ru: "рост в сторону руководителя Partner Success", en: "growth toward Partner Success lead" },
      ],
    },
  },
  {
    slug: "operations-coordinator",
    href: "/careers/operations-coordinator",
    icon: Users,
    title: {
      ru: "Операционный координатор",
      en: "Operations Coordinator",
    },
    tag: {
      ru: "Процессы",
      en: "Operations",
    },
    intro: {
      ru: "Следить за задачами, алертами, документами, регламентами и ежедневной работой команды.",
      en: "Track tasks, alerts, docs, playbooks and the team’s daily operating rhythm.",
    },
    points: [
      { ru: "Порядок в задачах и статусах", en: "Order in tasks and statuses" },
      { ru: "Внимание к деталям", en: "Attention to detail" },
      { ru: "Готовность быстро разбирать нестандартные ситуации", en: "Ability to handle unusual situations quickly" },
    ],
    detail: {
      badge: {
        ru: "Операционная система",
        en: "Operating system",
      },
      lead: {
        ru: "Нужен человек, который любит, когда задачи не тонут, статусы понятны, а важные сигналы не теряются в шуме.",
        en: "We need someone who likes when tasks don’t sink, statuses are clear and important signals don’t get lost in noise.",
      },
      mission: {
        ru: "NearLoy растёт модулями: финансы, PR, компании, клиенты, уведомления, админка. Чтобы продукт не ехал в разные стороны, нужны понятные процессы и аккуратный контроль.",
        en: "NearLoy grows by modules: finance, PR, companies, customers, notifications and admin tools. Clear processes and careful control keep it moving in one direction.",
      },
      focus: [
        {
          icon: ClipboardList,
          title: { ru: "Задачи и статусы", en: "Tasks and statuses" },
          text: {
            ru: "Следить за досками, алертами, приоритетами, ответственными и сроками.",
            en: "Watch boards, alerts, priorities, owners and deadlines.",
          },
        },
        {
          icon: ShieldCheck,
          title: { ru: "Регламенты", en: "Playbooks" },
          text: {
            ru: "Фиксировать процессы так, чтобы команда не держала всё в голове.",
            en: "Document processes so the team does not keep everything in their heads.",
          },
        },
        {
          icon: Sparkles,
          title: { ru: "Ежедневная ясность", en: "Daily clarity" },
          text: {
            ru: "Подсвечивать, что горит, что ждёт решения и где нужен следующий шаг.",
            en: "Highlight what is burning, what needs a decision and where the next step is missing.",
          },
        },
      ],
      expectations: [
        { ru: "держите порядок в задачах и документах", en: "keep tasks and documents organized" },
        { ru: "уточняете и доводите до ясности", en: "ask clarifying questions and drive to clarity" },
        { ru: "замечаете мелочи, из которых потом вырастают проблемы", en: "notice small details before they become problems" },
        { ru: "спокойно работаете с несколькими направлениями одновременно", en: "can calmly work across several areas at once" },
      ],
      growth: [
        { ru: "построение операционной системы проекта", en: "build the project’s operating system" },
        { ru: "влияние на процессы команды и админские инструменты", en: "influence team processes and admin tools" },
        { ru: "рост в сторону операционного менеджера продукта", en: "growth toward product operations manager" },
      ],
    },
  },
];

const careersPageCopy: Record<Locale, CareersPageCopy> = {
  ru: {
    badge: "Команда NearLoy",
    title: "Вакансии для тех, кто любит делать продукт живым",
    subtitle:
      "Мы строим NearLoy как рабочую инфраструктуру для клиентов, компаний, PR-агентов и админов. Нужны люди, которые умеют видеть проблему, быстро собирать решение и не терять вкус к деталям.",
    primaryCta: "Написать NearLoy",
    secondaryCta: "Посмотреть продукт",
    rolesEyebrow: "Открытые роли",
    rolesTitle: "Куда можно подключиться",
    rolesIntro:
      "Если роль звучит близко, но не совпадает на 100% — всё равно пишите. В маленьком продукте сильные люди часто находят место быстрее, чем появляется идеальное название вакансии.",
    applyBadge: "Как откликнуться",
    applyTitle: "Напишите пару строк о себе и роли",
    applyText:
      "Не нужен длинный формальный текст. Расскажите, чем вы сильны, какие продукты делали и какую часть NearLoy хотите усилить. Мы посмотрим и вернёмся с понятным следующим шагом.",
    applyCta: "Написать NearLoy",
  },
  en: {
    badge: "NearLoy team",
    title: "Careers for people who make products feel alive",
    subtitle:
      "We build NearLoy as a living product for customers, companies and the team. We need people who spot problems fast and turn ideas into shipped work.",
    primaryCta: "Contact NearLoy",
    secondaryCta: "View product",
    rolesEyebrow: "Open roles",
    rolesTitle: "Where you can join",
    rolesIntro:
      "If a role feels close but not perfect, still reach out. In a small product, strong people often find the right place before the perfect title exists.",
    applyBadge: "How to apply",
    applyTitle: "Write a few lines about yourself and the role",
    applyText:
      "No long formal cover letter is needed. Tell us what you are good at, what you have built and which part of NearLoy you would like to strengthen. We will review it and reply with a clear next step.",
    applyCta: "Contact NearLoy",
  },
};

const careerPrinciplesSource: LocalizedString[] = [
  {
    ru: "Делаем интерфейсы, которыми реально пользуются у кассы, в дороге и в рабочем кабинете.",
    en: "We build interfaces people actually use at the checkout, on the go and in work dashboards.",
  },
  {
    ru: "Любим быстрые релизы, но не трогаем критичную инфраструктуру без понятного контроля.",
    en: "We like fast releases, but critical infrastructure always needs clear control.",
  },
  {
    ru: "Пишем коротко, проверяем факты и не прячем проблемы под красивым текстом.",
    en: "We write clearly, check facts and do not hide problems under pretty wording.",
  },
];

export const CAREER_ROLE_SLUGS = careerRoleSources.map((role) => role.slug);

function localizeRole(role: CareerRoleSource, locale: Locale): CareerRole {
  return {
    slug: role.slug,
    href: role.href,
    icon: role.icon,
    title: l(role.title, locale),
    tag: l(role.tag, locale),
    intro: l(role.intro, locale),
    points: role.points.map((point) => l(point, locale)),
    featured: role.featured,
    detail: {
      badge: l(role.detail.badge, locale),
      lead: l(role.detail.lead, locale),
      mission: l(role.detail.mission, locale),
      focus: role.detail.focus.map((item) => ({
        icon: item.icon,
        title: l(item.title, locale),
        text: l(item.text, locale),
      })),
      expectations: role.detail.expectations.map((item) => l(item, locale)),
      growth: role.detail.growth.map((item) => l(item, locale)),
    },
  };
}

export function getCareersPageCopy(locale: Locale = "ru") {
  return careersPageCopy[locale] ?? careersPageCopy.ru;
}

export function getCareerRoles(locale: Locale = "ru") {
  return careerRoleSources.map((role) => localizeRole(role, locale));
}

export const careerRoles = getCareerRoles("ru");

export function getCareerRole(slug: string, locale: Locale = "ru") {
  const role = careerRoleSources.find((item) => item.slug === slug);
  return role ? localizeRole(role, locale) : undefined;
}

export function getCareerPrinciples(locale: Locale = "ru") {
  return careerPrinciplesSource.map((principle) => l(principle, locale));
}

export const careerPrinciples = getCareerPrinciples("ru");
