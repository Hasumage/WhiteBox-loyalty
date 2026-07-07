import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CompanyMemberRole, LoyaltyTransactionType, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CompanyAiLocationsService } from "./ai-locations/company-ai-locations.service";
import type { CompanyAiLocationsDraft } from "./ai-locations/company-ai-locations.types";
import { CompanyService } from "./company.service";
import { CompanyAiMode, type CompanyAiAssistDto, type CompanyAiMessageDto } from "./dto/company-ai.dto";

type CompanyAiProfilePatch = {
  name: string | null;
  slug: string | null;
  description: string | null;
  operatesOnline: boolean | null;
  categoryNames: string[];
  reason: string | null;
};

type CompanyAiOfferDraft = {
  title: string | null;
  description: string | null;
  code: string | null;
  cashierPhrase: string | null;
  imageAlt: string | null;
  terms: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

type CompanyAiLoyaltyDraft = {
  levels: Array<{ name: string; minimumSpend: number; cashbackPercent: number }>;
  note: string | null;
};

type CompanyAiPendingAction = {
  type: "UPDATE_PROFILE" | "UPDATE_LOGO" | "CREATE_OFFER" | "UPDATE_OFFER" | "UPDATE_LOYALTY" | "CREATE_LOCATIONS";
  label: string;
  confirmationText: string;
  payload: {
    profilePatch: CompanyAiProfilePatch | null;
    offerDraft: CompanyAiOfferDraft | null;
    loyaltyDraft: CompanyAiLoyaltyDraft | null;
    locationDraft: CompanyAiLocationsDraft | null;
    targetOfferId: string | null;
  };
};

type CompanyAiWebsiteInfo = {
  url: string;
  title: string | null;
  description: string | null;
  used: boolean;
  error: string | null;
};

export type CompanyAiAssistResult = {
  reply: string;
  intent: "ANSWER" | "NEED_MORE_INFO" | "PROPOSE_ACTION" | "BLOCKED";
  pendingAction: CompanyAiPendingAction | null;
  warnings: string[];
  blockedActions: string[];
  website: CompanyAiWebsiteInfo | null;
};

type WebsiteSnapshot = {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  error: string | null;
};

type SafeCompanyContext = {
  company: {
    name: string;
    description: string | null;
    categories: string[];
    operatesOnline: boolean;
    verificationStatus: string;
    identityVerificationCompleted: boolean;
    levels: Array<{ name: string; minimumSpend: number; cashbackPercent: number }>;
    subscriptionSpendPolicy: string;
  };
  availableCategories: Array<{ slug: string; name: string }>;
  permissions: {
    memberRole: CompanyMemberRole;
    canManageProfile: boolean;
    canSeeFinance: boolean;
  };
  metrics: {
    totalCustomers: number;
    activeSubscribers: number;
    pointsAwardedTotal: number;
    purchaseRevenueTotal: number;
    pendingPayouts: number;
    activeEntitlements: number;
  };
  monthActivity: {
    activeCustomers: number;
    pointsEarned: number;
    pointsSpent: number;
    purchases: number;
    purchaseRevenue: number;
    periodStartsAt: string;
  };
  finance: null | {
    availableForPayout: number;
    subscriptionGross: number;
    recognizedSubscriptionRevenue: number;
    savedPaymentMethod: boolean;
    billingStatus?: string;
    invoiceStatus?: string | null;
    amountDue?: number | null;
    currentPeriodStartsAt?: string | null;
    currentPeriodEndsAt?: string | null;
    trialEndsAt?: string | null;
    accessStatus?: string | null;
    graceEndsAt?: string | null;
    daysLeft?: number | null;
  };
  activeOffer: null | {
    id: string;
    title: string;
    description: string | null;
    code: string | null;
    hasImage: boolean;
    startsAt: string | null;
    endsAt: string | null;
  };
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_COMPANY_AI_MODEL = "gpt-5.4-nano";
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const COMPANY_AI_TIMEOUT_MS = 18_000;
const WEBSITE_FETCH_TIMEOUT_MS = 5_000;
const WEBSITE_TEXT_LIMIT = 2_200;
const WEBSITE_BODY_LIMIT = 180_000;
const MAX_IMAGE_DATA_URL_LENGTH = 750_000;
const MAX_LOYALTY_LEVELS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

const MYTHOLOGY_LEVEL_NAMES: Record<string, string[]> = {
  greek: ["Гермес", "Афина", "Аполлон", "Артемида", "Посейдон", "Зевс", "Гера", "Арес", "Гелиос", "Олимп", "Титан", "Кронос"],
  japanese: ["Кодама", "Кицунэ", "Тэнгу", "Райдзин", "Сусаноо", "Аматэрасу", "Рюдзин", "Цукуёми", "Инадзума", "Ямато"],
  norse: ["Руна", "Сага", "Фрейя", "Тор", "Один", "Вальхалла", "Локи", "Иггдрасиль"],
  egyptian: ["Анубис", "Бастет", "Гор", "Исида", "Ра", "Осирис", "Сфинкс", "Феникс"],
};

const NULLABLE_STRING_80 = { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] } as const;
const NULLABLE_STRING_120 = { anyOf: [{ type: "string", maxLength: 120 }, { type: "null" }] } as const;
const NULLABLE_STRING_180 = { anyOf: [{ type: "string", maxLength: 180 }, { type: "null" }] } as const;
const NULLABLE_STRING_500 = { anyOf: [{ type: "string", maxLength: 500 }, { type: "null" }] } as const;
const NULLABLE_BOOLEAN = { anyOf: [{ type: "boolean" }, { type: "null" }] } as const;

const PROFILE_PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: NULLABLE_STRING_80,
    slug: NULLABLE_STRING_80,
    description: NULLABLE_STRING_500,
    operatesOnline: NULLABLE_BOOLEAN,
    categoryNames: { type: "array", maxItems: 4, items: { type: "string", maxLength: 60 } },
    reason: NULLABLE_STRING_180,
  },
  required: ["name", "slug", "description", "operatesOnline", "categoryNames", "reason"],
} as const;

const OFFER_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: NULLABLE_STRING_80,
    description: NULLABLE_STRING_500,
    code: NULLABLE_STRING_80,
    cashierPhrase: NULLABLE_STRING_180,
    imageAlt: NULLABLE_STRING_180,
    terms: NULLABLE_STRING_180,
    startsAt: NULLABLE_STRING_80,
    endsAt: NULLABLE_STRING_80,
  },
  required: ["title", "description", "code", "cashierPhrase", "imageAlt", "terms", "startsAt", "endsAt"],
} as const;

const LOYALTY_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    levels: {
      type: "array",
      maxItems: MAX_LOYALTY_LEVELS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", maxLength: 60 },
          minimumSpend: { type: "number", minimum: 0, maximum: 10_000_000 },
          cashbackPercent: { type: "number", minimum: 0, maximum: 25 },
        },
        required: ["name", "minimumSpend", "cashbackPercent"],
      },
    },
    note: NULLABLE_STRING_180,
  },
  required: ["levels", "note"],
} as const;

const LOCATION_CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    input: { type: "string", maxLength: 180 },
    title: NULLABLE_STRING_120,
    address: { type: "string", maxLength: 240 },
    city: NULLABLE_STRING_80,
    latitude: { anyOf: [{ type: "number" }, { type: "null" }] },
    longitude: { anyOf: [{ type: "number" }, { type: "null" }] },
    precision: NULLABLE_STRING_80,
    status: { type: "string", enum: ["READY", "CONFIRMATION_REQUIRED", "NEEDS_DETAILS", "DUPLICATE", "FAILED"] },
    note: NULLABLE_STRING_180,
    mapPreviewUrl: NULLABLE_STRING_500,
    openTime: NULLABLE_STRING_80,
    closeTime: NULLABLE_STRING_80,
    workingDays: {
      anyOf: [
        {
          type: "array",
          maxItems: 7,
          items: { type: "integer", minimum: 0, maximum: 6 },
        },
        { type: "null" },
      ],
    },
  },
  required: [
    "input",
    "title",
    "address",
    "city",
    "latitude",
    "longitude",
    "precision",
    "status",
    "note",
    "mapPreviewUrl",
    "openTime",
    "closeTime",
    "workingDays",
  ],
} as const;

const LOCATION_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    source: { type: "string", enum: ["message", "website"] },
    candidates: {
      type: "array",
      maxItems: 10,
      items: LOCATION_CANDIDATE_SCHEMA,
    },
    reviewUrl: NULLABLE_STRING_500,
    note: NULLABLE_STRING_180,
  },
  required: ["source", "candidates", "reviewUrl", "note"],
} as const;

const PENDING_ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["UPDATE_PROFILE", "UPDATE_LOGO", "CREATE_OFFER", "UPDATE_OFFER", "UPDATE_LOYALTY", "CREATE_LOCATIONS"] },
    label: { type: "string", maxLength: 80 },
    confirmationText: { type: "string", maxLength: 220 },
    payload: {
      type: "object",
      additionalProperties: false,
      properties: {
        profilePatch: { anyOf: [PROFILE_PATCH_SCHEMA, { type: "null" }] },
        offerDraft: { anyOf: [OFFER_DRAFT_SCHEMA, { type: "null" }] },
        loyaltyDraft: { anyOf: [LOYALTY_DRAFT_SCHEMA, { type: "null" }] },
        locationDraft: { anyOf: [LOCATION_DRAFT_SCHEMA, { type: "null" }] },
        targetOfferId: NULLABLE_STRING_80,
      },
      required: ["profilePatch", "offerDraft", "loyaltyDraft", "locationDraft", "targetOfferId"],
    },
  },
  required: ["type", "label", "confirmationText", "payload"],
} as const;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string", maxLength: 900 },
    intent: { type: "string", enum: ["ANSWER", "NEED_MORE_INFO", "PROPOSE_ACTION", "BLOCKED"] },
    pendingAction: { anyOf: [PENDING_ACTION_SCHEMA, { type: "null" }] },
    warnings: {
      type: "array",
      maxItems: 3,
      items: { type: "string", maxLength: 180 },
    },
    blockedActions: {
      type: "array",
      maxItems: 3,
      items: { type: "string", maxLength: 180 },
    },
  },
  required: ["reply", "intent", "pendingAction", "warnings", "blockedActions"],
} as const;

@Injectable()
export class CompanyAiService {
  constructor(
    private readonly config: ConfigService,
    private readonly companyService: CompanyService,
    private readonly prisma: PrismaService,
    private readonly aiLocations: CompanyAiLocationsService,
  ) {}

  async assist(userId: number, dto: CompanyAiAssistDto): Promise<CompanyAiAssistResult> {
    const locale = dto.locale ?? "ru";
    const deterministicLoyaltyDraft = this.deterministicLoyaltyDraft(dto, locale);
    if (deterministicLoyaltyDraft) {
      return { ...deterministicLoyaltyDraft, website: null };
    }

    const messages = this.compactMessages(dto);
    const context = await this.safeContext(userId, dto.activeOfferId);
    const deterministicSubscriptionReply = this.deterministicCompanySubscriptionReply(dto, context, locale);
    if (deterministicSubscriptionReply) {
      return { ...deterministicSubscriptionReply, website: null };
    }

    const website = await this.websiteSnapshot(dto);
    const deterministicLocationReply = await this.aiLocations.assist(userId, dto, website);
    if (deterministicLocationReply) {
      return { ...deterministicLocationReply, website: this.websiteInfo(website) };
    }

    const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("OpenAI API key is not configured.");
    }

    const imageDataUrl = this.safeImageDataUrl(dto.imageDataUrl);
    const model = this.config.get<string>("OPENAI_MODEL")?.trim() || DEFAULT_COMPANY_AI_MODEL;
    const maxOutputTokens = this.maxOutputTokens();

    const userContent: Array<Record<string, string>> = [
      {
        type: "input_text",
        text: JSON.stringify({
          mode: dto.mode ?? CompanyAiMode.CHAT,
          messages,
          context,
          website,
          imageAttached: Boolean(imageDataUrl),
          activeOfferId: dto.activeOfferId ?? null,
        }),
      },
    ];
    if (imageDataUrl) {
      userContent.push({ type: "input_image", image_url: imageDataUrl, detail: "low" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COMPANY_AI_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: maxOutputTokens,
          reasoning: { effort: "none" },
          input: [
            {
              role: "system",
              content: this.systemPrompt(locale),
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "company_ai_chat_result",
              strict: true,
              schema: RESULT_SCHEMA,
            },
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as OpenAiResponsePayload | null;
      if (!response.ok) {
        throw new ServiceUnavailableException(payload?.error?.message ?? `OpenAI request failed with HTTP ${response.status}.`);
      }

      const result = this.normalizePendingAction(this.parseResult(payload));
      return {
        ...result,
        reply: this.userFacingReply(result.reply),
        intent: result.pendingAction ? "PROPOSE_ACTION" : result.intent,
        website: this.websiteInfo(website),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException("OpenAI request timed out.");
      }
      throw new ServiceUnavailableException("OpenAI request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private systemPrompt(locale: "ru" | "en") {
    return [
      "You are NearLoy company chat assistant.",
      `Language: ${locale === "ru" ? "Russian" : "English"}.`,
      "Behave like a useful chat, not a form generator and not a help desk.",
      "Messages may include short tab-session operational memory. Use it to understand follow-up replies, but never mention or quote that memory.",
      "Answer questions directly using only facts from context. For metrics, cite the actual numbers from context.",
      "If the user asks until when NearLoy subscription/access is active, answer from context.finance.currentPeriodEndsAt, trialEndsAt, accessStatus, graceEndsAt and daysLeft. Do not say the date is unavailable when these fields exist.",
      "Never expose JSON keys, internal field names, camelCase variables, enum names, or expressions like fieldName = value. Translate every metric into a normal human label.",
      "When the user wants a safe change, do not claim it is done. Propose exactly one pendingAction and ask for confirmation in reply.",
      "When pendingAction is present, phrase the reply as a proposal: use 'предлагаю'/'могу' instead of 'уже сделал' or 'поменяю'.",
      "Safe actions: update company display name, public slug, description, online/offline flag, category names; update company logo/avatar only when imageAttached is true; create or update a special offer; draft loyalty levels; propose company locations only when exact coordinates are already prepared by the location module.",
      "For loyalty levels: if the user provides thresholds/percentages and a naming theme, create the full loyaltyDraft yourself. Do not ask the user to choose names; choose polished names that match the theme.",
      "For loyalty levels: preserve the exact thresholds and cashback percentages from the user when they provide them. The levels array may contain up to 12 items.",
      "For requests like 'rename current levels and add new levels', return one UPDATE_LOYALTY action containing the complete final ordered list of all levels.",
      "For category changes, use only category names or slugs from context.availableCategories. If the user asks for an unavailable category, choose the closest available category and explain it shortly.",
      "When proposing a company name change, also propose a clean latin slug unless the user explicitly asks to keep the old slug.",
      "For logo/avatar requests: if imageAttached is true, use UPDATE_LOGO with all payload fields null and say the logo will be cropped to 512x512. If no image is attached, ask the user to attach the image and do not create pendingAction.",
      "Forbidden actions: passwords, account access, roles, staff permissions, payouts, payment methods, provider settings, security settings, infrastructure, identity verification and legal data.",
      "If forbidden, set intent BLOCKED, put the request in blockedActions, and suggest a safe manual/admin path.",
      "If the user wants an offer but key info is missing, ask one short follow-up question instead of inventing everything.",
      "If an image is attached, use it to write offer copy or image alt text. Do not describe invisible details as facts.",
      "If a website snapshot is available, use it for profile/offer drafts. Do not invent addresses, schedules, prices or legal claims.",
      "For an offer image, mention that the recommended image size is 900×506.",
      "Keep replies concise, friendly and operational. No Markdown tables.",
    ].join(" ");
  }

  private normalizePendingAction(result: Omit<CompanyAiAssistResult, "website">): Omit<CompanyAiAssistResult, "website"> {
    const action = result.pendingAction;
    if (!action) return result;

    const valid =
      action.type === "UPDATE_LOGO" ||
      (action.type === "UPDATE_PROFILE" && Boolean(action.payload.profilePatch)) ||
      ((action.type === "CREATE_OFFER" || action.type === "UPDATE_OFFER") && Boolean(action.payload.offerDraft)) ||
      (action.type === "UPDATE_LOYALTY" && Boolean(action.payload.loyaltyDraft?.levels.length)) ||
      (action.type === "CREATE_LOCATIONS" &&
        Boolean(
          action.payload.locationDraft?.candidates.some(
            (candidate) =>
              (candidate.status === "READY" || candidate.status === "CONFIRMATION_REQUIRED") &&
              candidate.latitude != null &&
              candidate.longitude != null,
          ),
        ));

    if (valid) return result;

    return {
      ...result,
      intent: "NEED_MORE_INFO",
      pendingAction: null,
      reply:
        result.intent === "BLOCKED"
          ? result.reply
          : "Пока не вижу достаточно данных для безопасного изменения. Напишите, что именно нужно поменять, а для логотипа прикрепите изображение.",
    };
  }

  private deterministicLoyaltyDraft(dto: CompanyAiAssistDto, locale: "ru" | "en"): Omit<CompanyAiAssistResult, "website"> | null {
    const text = this.latestUserText(dto);
    const normalized = text.toLowerCase();
    if (!/уровн|лояльн|cashback|к[эе]шб[эе]к|балл|level|loyalty/i.test(normalized)) return null;
    if (!/мифолог|greek|греч|япон|japan|скандинав|norse|египет|egypt/i.test(normalized)) return null;

    const pairs = this.extractLoyaltyPairs(text);
    if (pairs.length < 2) return null;

    const theme = this.detectMythologyTheme(normalized);
    const names = MYTHOLOGY_LEVEL_NAMES[theme] ?? MYTHOLOGY_LEVEL_NAMES.greek;
    const levels = pairs.slice(0, MAX_LOYALTY_LEVELS).map((pair, index) => ({
      name: names[index] ?? `${locale === "ru" ? "Уровень" : "Level"} ${index + 1}`,
      minimumSpend: pair.minimumSpend,
      cashbackPercent: pair.cashbackPercent,
    }));
    const themeLabel =
      theme === "japanese"
        ? "японской мифологии"
        : theme === "norse"
          ? "скандинавской мифологии"
          : theme === "egyptian"
            ? "египетской мифологии"
            : "греческой мифологии";
    const summary = levels.map((level) => `${level.name} — от ${level.minimumSpend.toLocaleString("ru-RU")} ₽, ${level.cashbackPercent}%`).join("; ");

    return {
      reply:
        locale === "ru"
          ? `Предлагаю заменить уровни на ${levels.length} уровней по теме ${themeLabel}: ${summary}. Подтвердите, и я применю изменения.`
          : `I suggest replacing the loyalty ladder with ${levels.length} mythology-themed levels: ${summary}. Confirm to apply it.`,
      intent: "PROPOSE_ACTION",
      pendingAction: {
        type: "UPDATE_LOYALTY",
        label: `Уровни лояльности: ${themeLabel}`,
        confirmationText: `Подтвердите замену уровней на ${levels.length} уровней по теме ${themeLabel}.`,
        payload: {
          profilePatch: null,
          offerDraft: null,
          loyaltyDraft: {
            levels,
            note: `Пороги и проценты взяты из сообщения пользователя, названия подобраны по теме ${themeLabel}.`,
          },
          locationDraft: null,
          targetOfferId: null,
        },
      },
      warnings: [],
      blockedActions: [],
    };
  }

  private latestUserText(dto: CompanyAiAssistDto) {
    const latestFromMessages = [...(dto.messages ?? [])].reverse().find((message) => message.role === "user")?.content;
    return (dto.prompt || latestFromMessages || "").trim();
  }

  private deterministicCompanySubscriptionReply(
    dto: CompanyAiAssistDto,
    context: SafeCompanyContext,
    locale: "ru" | "en",
  ): Omit<CompanyAiAssistResult, "website"> | null {
    const text = this.latestUserText(dto).toLowerCase();
    const asksNearLoySubscription =
      /nearloy|нирлой|подписк|доступ|billing|биллинг/.test(text) &&
      /до какого|до\s+когда|когда.*заканч|сколько.*остал|активн|срок|статус/.test(text);
    if (!asksNearLoySubscription) return null;

    const finance = context.finance;
    if (!finance) {
      return {
        reply:
          locale === "ru"
            ? "Не вижу финансовый статус подписки NearLoy в доступных данных. Проверьте раздел «Подписка» или права доступа к финансам."
            : "I cannot see the NearLoy subscription billing status in the available data.",
        intent: "ANSWER",
        pendingAction: null,
        warnings: [],
        blockedActions: [],
      };
    }

    const periodEnd = this.parseDate(finance.currentPeriodEndsAt);
    const trialEnd = this.parseDate(finance.trialEndsAt);
    const graceEnd = this.parseDate(finance.graceEndsAt);
    const status = finance.accessStatus ?? finance.billingStatus ?? "UNKNOWN";
    const daysLeft = finance.daysLeft ?? (periodEnd ? this.daysUntil(periodEnd) : null);
    const periodEndLabel = periodEnd ? this.formatDate(periodEnd, locale) : null;
    const graceEndLabel = graceEnd ? this.formatDate(graceEnd, locale) : null;
    const trialEndLabel = trialEnd ? this.formatDate(trialEnd, locale) : null;

    let reply: string;
    if (status === "TRIAL" && trialEndLabel) {
      reply =
        locale === "ru"
          ? `Пробный период NearLoy активен до ${trialEndLabel}. ${this.daysLeftText(daysLeft)}`
          : `The NearLoy trial is active until ${trialEndLabel}. ${this.daysLeftText(daysLeft, "en")}`;
    } else if (status === "GRACE" && graceEndLabel) {
      reply =
        locale === "ru"
          ? `Основной период подписки закончился${periodEndLabel ? ` ${periodEndLabel}` : ""}. Сейчас действует льготный доступ до ${graceEndLabel}. ${this.daysLeftText(daysLeft)}`
          : `The main subscription period ended${periodEndLabel ? ` on ${periodEndLabel}` : ""}. Grace access is active until ${graceEndLabel}. ${this.daysLeftText(daysLeft, "en")}`;
    } else if (status === "PAST_DUE" || status === "SUSPENDED" || daysLeft === 0) {
      reply =
        locale === "ru"
          ? `По данным биллинга текущий период NearLoy закончился${periodEndLabel ? ` ${periodEndLabel}` : ""}. Нужно продлить подписку или проверить оплату.`
          : `According to billing data, the current NearLoy period ended${periodEndLabel ? ` on ${periodEndLabel}` : ""}. Renewal or payment check is required.`;
    } else if (periodEndLabel) {
      reply =
        locale === "ru"
          ? `Подписка NearLoy активна до ${periodEndLabel}. ${this.daysLeftText(daysLeft)}`
          : `The NearLoy subscription is active until ${periodEndLabel}. ${this.daysLeftText(daysLeft, "en")}`;
    } else {
      reply =
        locale === "ru"
          ? `Статус подписки NearLoy: ${this.humanBillingStatus(status)}. Дата окончания периода в данных не указана.`
          : `NearLoy subscription status: ${status}. The period end date is not available.`;
    }

    return {
      reply: reply.trim(),
      intent: "ANSWER",
      pendingAction: null,
      warnings: [],
      blockedActions: [],
    };
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private daysUntil(date: Date) {
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / DAY_MS));
  }

  private formatDate(date: Date, locale: "ru" | "en") {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  private daysLeftText(daysLeft: number | null | undefined, locale: "ru" | "en" = "ru") {
    if (daysLeft == null) return "";
    if (locale === "en") return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`;
    const mod10 = daysLeft % 10;
    const mod100 = daysLeft % 100;
    const word = mod10 === 1 && mod100 !== 11 ? "день" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "дня" : "дней";
    return `Осталось ${daysLeft} ${word}.`;
  }

  private humanBillingStatus(status: string) {
    const labels: Record<string, string> = {
      ACTIVE: "активна",
      TRIAL: "пробный период",
      GRACE: "льготный период",
      PAST_DUE: "просрочена",
      SUSPENDED: "приостановлена",
    };
    return labels[status] ?? status;
  }

  private detectMythologyTheme(value: string) {
    if (/япон|japan|самура|синто|ками/.test(value)) return "japanese";
    if (/скандинав|norse|викинг|один|тор|вальхалл/.test(value)) return "norse";
    if (/египет|egypt|фараон|анубис|ра\b/.test(value)) return "egyptian";
    return "greek";
  }

  private extractLoyaltyPairs(value: string) {
    const pairs = [...value.matchAll(/(?:от\s*)?([0-9][0-9\s.,]*)\s*(?:₽|руб(?:лей|ля|\.?)?)?[^%\n]{0,80}?([0-9]+(?:[.,][0-9]+)?)\s*%/giu)]
      .map((match) => ({
        minimumSpend: Number(match[1].replace(/\s/g, "").replace(",", ".")),
        cashbackPercent: Number(match[2].replace(",", ".")),
      }))
      .filter((pair) => Number.isFinite(pair.minimumSpend) && Number.isFinite(pair.cashbackPercent))
      .filter((pair) => pair.minimumSpend >= 0 && pair.minimumSpend <= 10_000_000 && pair.cashbackPercent >= 0 && pair.cashbackPercent <= 25)
      .sort((left, right) => left.minimumSpend - right.minimumSpend);

    const unique = new Map<number, { minimumSpend: number; cashbackPercent: number }>();
    for (const pair of pairs) unique.set(pair.minimumSpend, pair);
    return [...unique.values()];
  }

  private userFacingReply(reply: string) {
    const labels: Record<string, string> = {
      activeCustomers: "активных клиентов",
      activeEntitlements: "активных доступов",
      activeSubscribers: "активных подписчиков",
      amountDue: "к оплате",
      availableForPayout: "доступно для выплат",
        billingStatus: "статус подписки",
        currentPeriodEndsAt: "подписка активна до",
        currentPeriodStartsAt: "текущий период начался",
        trialEndsAt: "пробный период до",
        accessStatus: "статус доступа",
        graceEndsAt: "льготный период до",
        daysLeft: "дней осталось",
        invoiceStatus: "статус счёта",
      pendingPayouts: "заявок на выплату",
      periodStartsAt: "начало периода",
      pointsAwardedTotal: "всего начислено баллов",
      pointsEarned: "начислено баллов",
      pointsSpent: "списано баллов",
      purchaseRevenue: "выручка за период",
      purchaseRevenueTotal: "общая выручка",
      recognizedSubscriptionRevenue: "подтверждённая выручка по подпискам",
      savedPaymentMethod: "сохранённый способ оплаты",
      subscriptionGross: "оборот подписок",
      totalCustomers: "клиентов всего",
    };

    let cleaned = reply.replace(/\s*\(([a-z][A-Za-z0-9_]{2,}\s*=\s*[^)]{0,90})\)/g, "");
    for (const [key, label] of Object.entries(labels)) {
      cleaned = cleaned
        .replace(new RegExp(`\\b${key}\\s*=\\s*`, "g"), `${label} — `)
        .replace(new RegExp(`\\b${key}\\b`, "g"), label);
    }
    return cleaned
      .replace(/\bACTIVE\b/g, "активна")
      .replace(/\bTRIAL\b/g, "пробный период")
      .replace(/\bPAST_DUE\b/g, "просрочена")
      .replace(/\bSUSPENDED\b/g, "приостановлена")
      .replace(/\bPAID\b/g, "оплачен")
      .replace(/\bOPEN\b/g, "ожидает оплаты")
      .replace(/\bWAIVED\b/g, "без оплаты")
      .replace(/\bCANCELED\b/g, "отменён")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private compactMessages(dto: CompanyAiAssistDto): CompanyAiMessageDto[] {
    const source = dto.messages?.length ? dto.messages : dto.prompt ? [{ role: "user" as const, content: dto.prompt }] : [];
    return source
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 1500),
      }))
      .filter((message) => message.content.length > 0);
  }

  private async safeContext(userId: number, activeOfferId?: string): Promise<SafeCompanyContext> {
    const [profile, member] = await Promise.all([
      this.companyService.profile(userId),
      this.prisma.companyMember.findFirst({
        where: { userId, isActive: true },
        select: { companyId: true, role: true },
        orderBy: { id: "asc" },
      }),
    ]);
    if (!member) {
      throw new ServiceUnavailableException("Company membership not found.");
    }

    const [dashboard, monthActivity, activeOffer, availableCategories] = await Promise.all([
      this.companyService.dashboard(userId),
      this.monthActivity(member.companyId),
      this.activeOffer(member.companyId, activeOfferId),
      this.prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { slug: true, name: true },
      }),
    ]);

    const canSeeFinance = member.role !== CompanyMemberRole.CASHIER;
    const finance = canSeeFinance ? await this.safeFinance(userId) : null;

    return {
      company: {
        name: profile.company.name,
        description: profile.company.description,
        categories: profile.company.categories.map((category) => category.name).slice(0, 8),
        operatesOnline: profile.company.operatesOnline,
        verificationStatus: profile.company.verificationStatus,
        identityVerificationCompleted: profile.company.identityVerificationCompleted,
        levels: profile.company.levels.slice(0, 8),
        subscriptionSpendPolicy: profile.company.subscriptionSpendPolicy,
      },
      availableCategories,
      permissions: {
        memberRole: member.role,
        canManageProfile: member.role !== CompanyMemberRole.CASHIER,
        canSeeFinance,
      },
      metrics: {
        totalCustomers: dashboard.metrics.customers,
        activeSubscribers: dashboard.metrics.activeSubscribers,
        pointsAwardedTotal: dashboard.metrics.pointsAwarded,
        purchaseRevenueTotal: dashboard.metrics.purchaseRevenue,
        pendingPayouts: dashboard.metrics.pendingPayouts,
        activeEntitlements: dashboard.metrics.activeEntitlements,
      },
      monthActivity,
      finance,
      activeOffer,
    };
  }

  private async safeFinance(userId: number): Promise<SafeCompanyContext["finance"]> {
    try {
      const [finance, billing] = await Promise.all([
        this.companyService.finance(userId),
        this.companyService.billing(userId),
      ]);
      const now = new Date();
      const periodEndsAt = billing.account.currentPeriodEndsAt ?? null;
      const periodDaysLeft = periodEndsAt ? Math.max(0, Math.ceil((periodEndsAt.getTime() - now.getTime()) / DAY_MS)) : null;
      const accessStatus = billing.access?.status ?? billing.account.status;
      const calculatedDaysLeft =
        billing.access?.daysLeft ??
        (accessStatus === "ACTIVE" || accessStatus === "TRIAL" ? periodDaysLeft : periodEndsAt && periodEndsAt <= now ? 0 : null);
      return {
        availableForPayout: finance.availableForPayout,
        subscriptionGross: finance.subscriptionGross,
        recognizedSubscriptionRevenue: finance.recognizedSubscriptionRevenue,
        savedPaymentMethod: Boolean(finance.savedPaymentMethod),
        billingStatus: billing.account.status,
        invoiceStatus: billing.invoice?.status ?? null,
        amountDue: billing.invoice ? Number(billing.invoice.amountDue) : null,
        currentPeriodStartsAt: billing.account.currentPeriodStartsAt?.toISOString() ?? null,
        currentPeriodEndsAt: billing.account.currentPeriodEndsAt?.toISOString() ?? null,
        trialEndsAt: billing.account.trialEndsAt?.toISOString() ?? null,
        accessStatus,
        graceEndsAt: billing.access?.graceEndsAt?.toISOString() ?? null,
        daysLeft: calculatedDaysLeft,
      };
    } catch {
      return null;
    }
  }

  private async monthActivity(companyId: number): Promise<SafeCompanyContext["monthActivity"]> {
    const now = new Date();
    const periodStartsAt = new Date(now.getFullYear(), now.getMonth(), 1);
    const [purchaseUsers, loyaltyUsers, purchaseAggregate, pointsEarned, pointsSpent, purchases] = await Promise.all([
      this.prisma.companyPurchase.findMany({
        where: { companyId, createdAt: { gte: periodStartsAt } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.loyaltyTransaction.findMany({
        where: { companyId, occurredAt: { gte: periodStartsAt } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      this.prisma.companyPurchase.aggregate({
        where: { companyId, createdAt: { gte: periodStartsAt } },
        _sum: { amount: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { companyId, occurredAt: { gte: periodStartsAt }, type: LoyaltyTransactionType.EARN },
        _sum: { amount: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { companyId, occurredAt: { gte: periodStartsAt }, type: LoyaltyTransactionType.SPEND },
        _sum: { amount: true },
      }),
      this.prisma.companyPurchase.count({
        where: { companyId, createdAt: { gte: periodStartsAt } },
      }),
    ]);
    const activeCustomers = new Set([...purchaseUsers.map((item) => item.userId), ...loyaltyUsers.map((item) => item.userId)]).size;
    return {
      activeCustomers,
      pointsEarned: pointsEarned._sum.amount ?? 0,
      pointsSpent: pointsSpent._sum.amount ?? 0,
      purchases,
      purchaseRevenue: Number(purchaseAggregate._sum.amount ?? 0),
      periodStartsAt: periodStartsAt.toISOString(),
    };
  }

  private async activeOffer(companyId: number, activeOfferId?: string): Promise<SafeCompanyContext["activeOffer"]> {
    if (!activeOfferId) return null;
    const offer = await this.prisma.companySpecialOffer.findFirst({
      where: { id: activeOfferId, companyId, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        code: true,
        imageStorageKey: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!offer) return null;
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      code: offer.code,
      hasImage: Boolean(offer.imageStorageKey),
      startsAt: offer.startsAt?.toISOString() ?? null,
      endsAt: offer.endsAt?.toISOString() ?? null,
    };
  }

  private maxOutputTokens() {
    const configured = Number(this.config.get<string>("OPENAI_COMPANY_ASSISTANT_MAX_OUTPUT_TOKENS"));
    if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_OUTPUT_TOKENS;
    return Math.min(Math.max(Math.floor(configured), 650), 1200);
  }

  private safeImageDataUrl(imageDataUrl?: string) {
    const value = imageDataUrl?.trim();
    if (!value) return null;
    if (value.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new ServiceUnavailableException("Image is too large for AI analysis.");
    }
    if (!/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) {
      throw new ServiceUnavailableException("Unsupported image format for AI analysis.");
    }
    return value;
  }

  private parseResult(payload: OpenAiResponsePayload | null): Omit<CompanyAiAssistResult, "website"> {
    const text =
      payload?.output_text ??
      payload?.output?.flatMap((item) => item.content ?? []).find((content) => typeof content.text === "string")?.text;
    if (!text) {
      throw new ServiceUnavailableException("OpenAI response is empty.");
    }
    try {
      return JSON.parse(text) as Omit<CompanyAiAssistResult, "website">;
    } catch {
      throw new ServiceUnavailableException("OpenAI response has invalid JSON.");
    }
  }

  private async websiteSnapshot(dto: CompanyAiAssistDto): Promise<WebsiteSnapshot | null> {
    const url = this.extractWebsiteUrl(dto);
    if (!url) return null;
    try {
      return await this.fetchWebsiteSnapshot(url);
    } catch (error) {
      return {
        url,
        title: null,
        description: null,
        text: "",
        error: error instanceof Error ? error.message : "Не удалось прочитать сайт.",
      };
    }
  }

  private websiteInfo(snapshot: WebsiteSnapshot | null): CompanyAiWebsiteInfo | null {
    if (!snapshot) return null;
    return {
      url: snapshot.url,
      title: snapshot.title,
      description: snapshot.description,
      used: Boolean(snapshot.text && !snapshot.error),
      error: snapshot.error,
    };
  }

  private extractWebsiteUrl(dto: CompanyAiAssistDto) {
    const direct = dto.websiteUrl?.trim();
    const fromPrompt = [...(dto.messages ?? []), ...(dto.prompt ? [{ role: "user" as const, content: dto.prompt }] : [])]
      .map((message) => message.content.match(/https?:\/\/[^\s)\]}>,]+/i)?.[0])
      .find(Boolean);
    const raw = direct || fromPrompt;
    if (!raw) return null;
    const trimmed = raw.replace(/[.,;!?]+$/g, "");
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  private async fetchWebsiteSnapshot(inputUrl: string): Promise<WebsiteSnapshot> {
    let current = new URL(inputUrl);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.assertPublicUrl(current);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(current.toString(), {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            "User-Agent": "NearLoyCompanyAI/1.0",
            Accept: "text/html,text/plain;q=0.9,*/*;q=0.2",
          },
        });
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          current = new URL(location, current);
          continue;
        }
        if (!response.ok) {
          throw new Error(`Сайт вернул HTTP ${response.status}.`);
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType && !/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
          throw new Error("Сайт вернул не HTML-страницу.");
        }
        const length = Number(response.headers.get("content-length"));
        if (Number.isFinite(length) && length > WEBSITE_BODY_LIMIT) {
          throw new Error("Страница слишком большая для быстрого анализа.");
        }
        const html = (await response.text()).slice(0, WEBSITE_BODY_LIMIT);
        const normalized = this.normalizeWebsiteText(html);
        return {
          url: current.toString(),
          title: normalized.title,
          description: normalized.description,
          text: (normalized.text ?? "").slice(0, WEBSITE_TEXT_LIMIT),
          error: null,
        };
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("Слишком много перенаправлений сайта.");
  }

  private normalizeWebsiteText(html: string) {
    const title = this.decodeHtml(this.pickMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
    const description = this.decodeHtml(
      this.pickMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ??
        this.pickMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i),
    );
    const text = this.decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    return { title, description, text };
  }

  private pickMeta(html: string, pattern: RegExp) {
    return html.match(pattern)?.[1]?.trim() || null;
  }

  private decodeHtml(value: string | null) {
    if (!value) return null;
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async assertPublicUrl(url: URL) {
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Поддерживаются только http/https ссылки.");
    }
    if (url.username || url.password) {
      throw new Error("Ссылки с логином и паролем не поддерживаются.");
    }
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      throw new Error("Можно анализировать только публичные сайты.");
    }

    const directIp = isIP(hostname);
    if (directIp && this.isBlockedIp(hostname)) {
      throw new Error("Можно анализировать только публичные сайты.");
    }
    if (!directIp) {
      const records = await lookup(hostname, { all: true });
      if (!records.length || records.some((record) => this.isBlockedIp(record.address))) {
        throw new Error("Можно анализировать только публичные сайты.");
      }
    }
  }

  private isBlockedIp(address: string) {
    const family = isIP(address);
    if (family === 4) {
      const parts = address.split(".").map(Number);
      const [a, b] = parts;
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
      );
    }
    if (family === 6) {
      const normalized = address.toLowerCase();
      return (
        normalized === "::1" ||
        normalized === "::" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        normalized.startsWith("fe80") ||
        normalized.startsWith("::ffff:127.") ||
        normalized.startsWith("::ffff:10.") ||
        normalized.startsWith("::ffff:192.168.")
      );
    }
    return true;
  }
}
