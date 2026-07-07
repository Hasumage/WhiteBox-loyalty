"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  Paperclip,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  companyAiAssist,
  companyCategories,
  companyCreateCompanyLocation,
  companyProfile,
  createCompanySpecialOffer,
  updateCompanyLoyaltySettings,
  updateCompanyProfile,
  updateCompanySpecialOffer,
  uploadCompanyMediaAsset,
  type CompanyAiAssistResult,
  type CompanyAiChatMessage,
  type CompanyAiOfferDraft,
  type CompanyAiPendingAction,
  type CompanyProfile,
} from "@/lib/api/company-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

const OFFER_WIDTH = 900;
const OFFER_HEIGHT = 506;
const LOGO_WIDTH = 512;
const LOGO_HEIGHT = 512;
const INPUT_LIMIT = 1500;
const SESSION_MEMORY_LIMIT = 1200;
const AI_HISTORY_LIMIT = 8;
const AI_MESSAGE_LIMIT = 900;

type Category = { id: number; slug: string; name: string; icon: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentPreview?: string;
  pendingAction?: CompanyAiPendingAction | null;
  actionImageFile?: File | null;
  warnings?: string[];
  blockedActions?: string[];
  websiteState?: CompanyAiAssistResult["website"];
  actionStatus?: "pending" | "applied" | "failed";
};

function messageId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function limitText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trim()}…`;
}

function normalizeText(value: string) {
  return transliterate(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .replace(/\s+/g, " ");
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  auto: ["авто", "машины", "машина", "автосервис", "car", "cars"],
  barber: ["барбер", "барбершоп", "стрижка", "борода", "grooming", "haircut"],
  beauty: ["красота", "салон", "маникюр", "косметология", "beauty", "spa", "salon"],
  books: ["книги", "книга", "канцелярия", "book", "books"],
  coffee: ["кофе", "кофейня", "кофейни", "кофешоп", "кофейный", "coffee", "cafe", "espresso", "roastery"],
  delivery: ["доставка", "курьер", "delivery", "courier"],
  education: ["образование", "курсы", "обучение", "education", "courses", "school"],
  electronics: ["электроника", "гаджеты", "телефоны", "electronics", "gadgets"],
  entertainment: ["развлечения", "кино", "ивенты", "events", "entertainment"],
  fashion: ["одежда", "мода", "fashion", "apparel", "clothes"],
  fitness: ["фитнес", "спортзал", "зал", "gym", "fitness", "workout"],
  food: ["еда", "ресторан", "рестораны", "кафе", "кухня", "food", "restaurant", "dining"],
  health: ["здоровье", "клиника", "медицина", "health", "clinic", "medical"],
  home: ["дом", "ремонт", "декор", "home", "decor"],
  kids: ["дети", "детский", "kids", "baby"],
  other: ["другое", "прочее", "other"],
  "pet-care": ["питомцы", "животные", "ветеринар", "pet", "pets", "vet"],
  pharmacy: ["аптека", "лекарства", "pharmacy", "pill"],
  retail: ["магазин", "ритейл", "товары", "retail", "shop", "store"],
  services: ["услуги", "сервис", "бытовые", "services", "service"],
  sports: ["спорт", "sports", "trophy"],
  travel: ["путешествия", "туризм", "travel", "booking"],
};

function transliterate(value: string) {
  return value
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");
}

function slugFromCompanyName(value: string) {
  const slug = transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
  if (slug.length >= 3 && !/^\d+$/.test(slug)) return slug;
  return "";
}

function extractUrl(value: string) {
  return value.match(/https?:\/\/[^\s)\]}>,]+/i)?.[0]?.replace(/[.,;!?]+$/g, "") ?? "";
}

function isConfirmText(value: string) {
  return /^(да|ок|окей|подтверждаю|согласен|согласна|yes|confirm)$/i.test(value.trim());
}

function matchCategoryIds(names: string[], categories: Category[]) {
  const requested = names.flatMap((name) => normalizeText(name).split(" ")).filter(Boolean);
  if (!requested.length) return [];

  const matched = categories
    .map((category) => {
      const categoryName = normalizeText(category.name);
      const categorySlug = normalizeText(category.slug);
      const aliases = (CATEGORY_ALIASES[category.slug] ?? []).flatMap((alias) => normalizeText(alias).split(" "));
      const haystack = new Set([categoryName, categorySlug, ...categoryName.split(" "), ...categorySlug.split(" "), ...aliases]);
      const score = requested.reduce((total, token) => {
        if (haystack.has(token)) return total + 4;
        if ([...haystack].some((item) => item.includes(token) || token.includes(item))) return total + 1;
        return total;
      }, 0);
      return { id: category.id, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(4, names.length)))
    .map((item) => item.id);
  return [...new Set(matched)];
}

function summarizePendingAction(action: CompanyAiPendingAction) {
  const profilePatch = action.payload.profilePatch;
  const offerDraft = action.payload.offerDraft;
  const loyaltyDraft = action.payload.loyaltyDraft;
  const locationDraft = action.payload.locationDraft;
  const details: string[] = [`тип: ${action.type}`, `название действия: ${action.label}`];

  if (profilePatch) {
    details.push(
      [
        profilePatch.name ? `название компании: ${profilePatch.name}` : "",
        profilePatch.slug ? `slug: ${profilePatch.slug}` : "",
        profilePatch.description ? `описание: ${profilePatch.description}` : "",
        profilePatch.categoryNames.length ? `категории: ${profilePatch.categoryNames.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }

  if (offerDraft) {
    details.push(
      [
        offerDraft.title ? `акция: ${offerDraft.title}` : "",
        offerDraft.description ? `описание акции: ${offerDraft.description}` : "",
        offerDraft.code ? `промокод: ${offerDraft.code}` : "",
        offerDraft.terms ? `условия: ${offerDraft.terms}` : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }

  if (loyaltyDraft?.levels.length) {
    details.push(
      `уровни: ${loyaltyDraft.levels
        .map((level) => `${level.name} от ${level.minimumSpend}, ${level.cashbackPercent}%`)
        .join("; ")}`,
    );
  }

  if (locationDraft?.candidates.length) {
    details.push(
      `локации: ${locationDraft.candidates
        .filter((candidate) => candidate.status === "READY" || candidate.status === "CONFIRMATION_REQUIRED")
        .map((candidate) => candidate.address)
        .join("; ")}`,
    );
  }

  return limitText(details.filter(Boolean).join(". "), 700);
}

function messageToAiMessage(message: ChatMessage): CompanyAiChatMessage {
  const actionMemory = message.pendingAction
    ? `\n\nОперативная память по предложенному действию, не цитируй пользователю: ${summarizePendingAction(message.pendingAction)}. Статус: ${
        message.actionStatus ?? "pending"
      }.`
    : "";
  return {
    role: message.role,
    content: limitText(`${message.content}${actionMemory}`, AI_MESSAGE_LIMIT),
  };
}

function buildSessionMemory(previous: string, userText: string, result: CompanyAiAssistResult) {
  const parts = [
    previous ? `До этого: ${previous}` : "",
    userText ? `Последний запрос пользователя: ${userText}` : "",
    `Последний ответ AI: ${result.reply}`,
    result.pendingAction ? `Текущее предложенное действие: ${summarizePendingAction(result.pendingAction)}` : "",
    result.intent === "NEED_MORE_INFO" ? "Сейчас пользователь, вероятно, отвечает на уточняющий вопрос по этой же задаче." : "",
  ].filter(Boolean);

  return limitText(parts.join(" "), SESSION_MEMORY_LIMIT);
}

function safeDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function appendOfferDraftToForm(form: FormData, draft: CompanyAiOfferDraft) {
  if (draft.title) form.set("title", draft.title);
  if (draft.description !== null) form.set("description", draft.description ?? "");
  if (draft.code !== null) form.set("code", draft.code ?? "");
  const startsAt = safeDate(draft.startsAt);
  const endsAt = safeDate(draft.endsAt);
  if (startsAt) form.set("startsAt", startsAt);
  if (endsAt) form.set("endsAt", endsAt);
}

function dataUrlFromFile(file: File, maxSide = 768, quality = 0.78) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.onload = () => {
      const source = String(reader.result ?? "");
      const image = new Image();
      image.onerror = () => reject(new Error("Не удалось открыть изображение."));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Canvas недоступен."));
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

async function cropOfferImage(file: File) {
  return cropImageToFile(file, OFFER_WIDTH, OFFER_HEIGHT, "offer", 0.88);
}

async function cropLogoImage(file: File) {
  return cropImageToFile(file, LOGO_WIDTH, LOGO_HEIGHT, "logo", 0.9);
}

async function cropImageToFile(file: File, width: number, height: number, prefix: string, quality: number) {
  const dataUrl = await dataUrlFromFile(file, 1600, 0.9);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Не удалось подготовить изображение акции."));
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен.");
  context.fillStyle = "#03060a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Не удалось сохранить изображение акции."))), "image/webp", quality),
  );
  return new File([blob], `${prefix}-${Date.now()}.webp`, { type: "image/webp" });
}

export default function CompanyAiPage() {
  const { locale } = useI18n("ru");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "hello",
      role: "assistant",
      content:
        "Привет. Напишите, что хотите сделать: спросить статистику, обновить карточку компании, создать акцию, разобрать сайт или подготовить уровни. Если нужно фото для акции — просто прикрепите его к сообщению.",
    },
  ]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [awaitingOfferImage, setAwaitingOfferImage] = useState(false);
  const [error, setError] = useState("");
  const [sessionMemory, setSessionMemory] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([companyProfile(), companyCategories()])
      .then(([nextProfile, nextCategories]) => {
        if (!alive) return;
        setProfile(nextProfile);
        setCategories(nextCategories);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить данные компании.");
      })
      .finally(() => {
        if (alive) setBootLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const pendingMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.pendingAction && message.actionStatus === "pending"),
    [messages],
  );

  async function pickImage(file: File) {
    setError("");
    if (file.size > 4 * 1024 * 1024) {
      setError("Картинка должна быть до 4 МБ.");
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError("Поддерживаются PNG, JPG и WEBP.");
      return;
    }
    setImageFile(file);
    setImagePreview(await dataUrlFromFile(file, 900, 0.86));
  }

  function clearAttachment() {
    setImageFile(null);
    setImagePreview("");
  }

  function appendAssistant(content: string, extra?: Partial<ChatMessage>) {
    setMessages((current) => [
      ...current,
      {
        id: messageId(),
        role: "assistant",
        content,
        ...extra,
      },
    ]);
  }

  async function sendMessage() {
    const text = input.trim();
    const attachedFile = imageFile;
    const attachedPreview = imagePreview;
    if (!text && !attachedFile) return;
    setError("");

    const userMessage: ChatMessage = {
      id: messageId(),
      role: "user",
      content: text || "Прикрепил фото.",
      attachmentPreview: attachedPreview || undefined,
    };

    setInput("");
    clearAttachment();
    setMessages((current) => [...current, userMessage]);

    if (!attachedFile && text && pendingMessage?.pendingAction && isConfirmText(text)) {
      await applyPendingAction(pendingMessage.id, pendingMessage.pendingAction, pendingMessage.actionImageFile ?? null);
      return;
    }

    if (attachedFile && activeOfferId && awaitingOfferImage && !text) {
      await attachImageToActiveOffer(activeOfferId, attachedFile);
      return;
    }

    setLoading(true);
    try {
      const imageDataUrl = attachedFile ? await dataUrlFromFile(attachedFile, 768, 0.72) : undefined;
      const recentMessages = [...messages, userMessage]
        .filter((message) => message.role === "user" || message.role === "assistant")
        .slice(-AI_HISTORY_LIMIT)
        .map(messageToAiMessage);
      const apiMessages: CompanyAiChatMessage[] = sessionMemory
        ? [
            {
              role: "assistant",
              content: `Оперативная память текущей вкладки до перезагрузки страницы. Используй для коротких уточнений, но не пересказывай её пользователю: ${sessionMemory}`,
            },
            ...recentMessages,
          ]
        : recentMessages;
      const response = await companyAiAssist({
        mode: "CHAT",
        messages: apiMessages,
        prompt: text,
        websiteUrl: extractUrl(text) || undefined,
        activeOfferId: activeOfferId ?? undefined,
        imageDataUrl,
        locale: locale === "ru" ? "ru" : "en",
      });
      appendAssistant(response.reply, {
        pendingAction: response.pendingAction,
        actionStatus: response.pendingAction ? "pending" : undefined,
        actionImageFile: attachedFile,
        warnings: response.warnings,
        blockedActions: response.blockedActions,
        websiteState: response.website,
      });
      setSessionMemory((current) => buildSessionMemory(current, text || userMessage.content, response));
    } catch (reason) {
      appendAssistant(reason instanceof Error ? reason.message : "Не удалось получить ответ помощника.");
    } finally {
      setLoading(false);
    }
  }

  async function attachImageToActiveOffer(offerId: string, file: File) {
    setLoading(true);
    try {
      const form = new FormData();
      form.set("file", await cropOfferImage(file));
      form.set("width", String(OFFER_WIDTH));
      form.set("height", String(OFFER_HEIGHT));
      await updateCompanySpecialOffer(offerId, form);
      setAwaitingOfferImage(false);
      appendAssistant("Отлично, фото добавил к акции. Если нужен промокод — напишите его сюда, и я подготовлю обновление.");
    } catch (reason) {
      appendAssistant(reason instanceof Error ? reason.message : "Не удалось добавить фото к акции.");
    } finally {
      setLoading(false);
    }
  }

  async function applyPendingAction(messageIdToUpdate: string, action: CompanyAiPendingAction, actionImageFile?: File | null) {
    setMessages((current) => current.map((message) => (message.id === messageIdToUpdate ? { ...message, actionStatus: "applied" } : message)));
    setLoading(true);
    try {
      if (action.type === "UPDATE_PROFILE") {
        await applyProfilePatch(action);
      } else if (action.type === "UPDATE_LOGO") {
        await updateLogo(actionImageFile ?? null);
      } else if (action.type === "CREATE_OFFER") {
        await createOffer(action, actionImageFile ?? null);
      } else if (action.type === "UPDATE_OFFER") {
        await updateOffer(action, actionImageFile ?? null);
      } else if (action.type === "UPDATE_LOYALTY") {
        await updateLoyalty(action);
      } else if (action.type === "CREATE_LOCATIONS") {
        await createLocations(action);
      }
      setSessionMemory((current) =>
        limitText(`${current} Подтверждено и применено действие: ${summarizePendingAction(action)}.`, SESSION_MEMORY_LIMIT),
      );
    } catch (reason) {
      setMessages((current) => current.map((message) => (message.id === messageIdToUpdate ? { ...message, actionStatus: "failed" } : message)));
      appendAssistant(reason instanceof Error ? reason.message : "Не удалось применить действие.");
    } finally {
      setLoading(false);
    }
  }

  async function applyProfilePatch(action: CompanyAiPendingAction) {
    const patch = action.payload.profilePatch;
    if (!profile || !patch) throw new Error("Нет подготовленных изменений профиля.");
    const currentCategoryIds = profile.company.categories.map((category) => category.id);
    const matchedCategoryIds = matchCategoryIds(patch.categoryNames, categories);
    const nextName = patch.name?.trim() || profile.company.name;
    const nextSlug =
      slugFromCompanyName(patch.slug ?? "") ||
      (patch.name?.trim() ? slugFromCompanyName(nextName) : profile.company.slug);
    const updated = await updateCompanyProfile({
      name: nextName,
      slug: nextSlug || profile.company.slug,
      description: patch.description ?? profile.company.description ?? "",
      operatesOnline: patch.operatesOnline ?? profile.company.operatesOnline,
      categoryIds: matchedCategoryIds.length ? matchedCategoryIds : currentCategoryIds,
    });
    setProfile(updated);
    appendAssistant(
      matchedCategoryIds.length || !patch.categoryNames.length
        ? `Готово. Профиль обновлён. Публичная ссылка теперь /wallet/${updated.company.slug}.`
        : `Готово. Название, описание и slug обновлены: /wallet/${updated.company.slug}. Категории не менял — не нашёл совпадения в текущем каталоге.`,
    );
  }

  async function updateLogo(actionImageFile: File | null) {
    if (!actionImageFile) throw new Error("Прикрепите изображение логотипа к сообщению, и я подготовлю замену.");
    const form = new FormData();
    form.set("kind", "LOGO");
    form.set("file", await cropLogoImage(actionImageFile));
    form.set("width", String(LOGO_WIDTH));
    form.set("height", String(LOGO_HEIGHT));
    await uploadCompanyMediaAsset(form);
    appendAssistant("Готово. Логотип обновлён и приведён к квадратному формату 512×512.");
  }

  async function createOffer(action: CompanyAiPendingAction, actionImageFile: File | null) {
    const draft = action.payload.offerDraft;
    if (!draft?.title) throw new Error("Для создания акции нужно название.");
    const form = new FormData();
    appendOfferDraftToForm(form, draft);
    form.set("width", String(OFFER_WIDTH));
    form.set("height", String(OFFER_HEIGHT));
    if (actionImageFile) {
      form.set("file", await cropOfferImage(actionImageFile));
    }
    const { offer } = await createCompanySpecialOffer(form);
    setActiveOfferId(offer.id);
    setAwaitingOfferImage(!actionImageFile);
    appendAssistant(
      actionImageFile
        ? "Акция создана, фото тоже добавил. Если хотите — можем ещё добавить промокод или даты действия."
        : `Акция создана. Если хотите добавить фото, отправьте его в чат. Рекомендуемый размер: ${OFFER_WIDTH}×${OFFER_HEIGHT}.`,
    );
  }

  async function updateOffer(action: CompanyAiPendingAction, actionImageFile: File | null) {
    const offerId = action.payload.targetOfferId || activeOfferId;
    const draft = action.payload.offerDraft;
    if (!offerId) throw new Error("Не нашёл акцию, которую нужно обновить.");
    if (!draft && !actionImageFile) throw new Error("Нет изменений для акции.");
    const form = new FormData();
    if (draft) appendOfferDraftToForm(form, draft);
    form.set("width", String(OFFER_WIDTH));
    form.set("height", String(OFFER_HEIGHT));
    if (actionImageFile) {
      form.set("file", await cropOfferImage(actionImageFile));
    }
    const { offer } = await updateCompanySpecialOffer(offerId, form);
    setActiveOfferId(offer.id);
    setAwaitingOfferImage(false);
    appendAssistant("Готово. Акция обновлена.");
  }

  async function updateLoyalty(action: CompanyAiPendingAction) {
    const draft = action.payload.loyaltyDraft;
    if (!profile || !draft?.levels.length) throw new Error("Нет подготовленных уровней.");
    await updateCompanyLoyaltySettings({
      subscriptionSpendPolicy: profile.company.subscriptionSpendPolicy,
      levelRules: draft.levels.map((level) => ({
        levelName: level.name,
        minTotalSpend: level.minimumSpend,
        cashbackPercent: level.cashbackPercent,
      })),
    });
    const updated = await companyProfile();
    setProfile(updated);
    appendAssistant("Готово. Уровни лояльности обновлены.");
  }

  async function createLocations(action: CompanyAiPendingAction) {
    const draft = action.payload.locationDraft;
    const candidates =
      draft?.candidates.filter(
        (candidate) =>
          (candidate.status === "READY" || candidate.status === "CONFIRMATION_REQUIRED") &&
          candidate.latitude != null &&
          candidate.longitude != null,
      ) ?? [];
    if (!candidates.length) throw new Error("Нет готовых адресов для добавления.");

    const created = [];
    const failed: string[] = [];
    for (const candidate of candidates) {
      const result = await companyCreateCompanyLocation({
        title: candidate.title ?? undefined,
        address: candidate.address,
        city: candidate.city ?? undefined,
        latitude: candidate.latitude ?? undefined,
        longitude: candidate.longitude ?? undefined,
        openTime: candidate.openTime ?? undefined,
        closeTime: candidate.closeTime ?? undefined,
        workingDays: candidate.workingDays ?? undefined,
        isActive: true,
      });
      if (result.ok) {
        created.push(result.data);
      } else {
        failed.push(`${candidate.address}: ${result.message}`);
      }
    }

    if (!created.length) {
      throw new Error(failed[0] ?? "Не удалось добавить точки компании.");
    }

    const firstMapLink = `/map?company=${created[0].companyId}&location=${created[0].uuid}`;
    const failedText = failed.length ? ` ${failed.length} адрес(а) не добавлены: ${failed.slice(0, 2).join("; ")}.` : "";
    appendAssistant(
      created.length === 1
        ? `Готово. Добавил точку компании. Проверьте её на карте: ${firstMapLink}.${failedText}`
        : `Готово. Добавил ${created.length} точек компании. Первая точка на карте: ${firstMapLink}.${failedText}`,
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-6.5rem)] flex-col gap-3 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      <header className="overflow-hidden rounded-[1.15rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_26%),radial-gradient(circle_at_88%_0%,rgba(168,85,247,0.08),transparent_28%),rgba(255,255,255,0.018)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" /> Чат-помощник
              </Badge>
              <h1 className="text-xl font-semibold sm:text-2xl">Помощник компании</h1>
            </div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Спросите, поручите, подтвердите — AI аккуратно подготовит изменения.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 border-violet-300/25 bg-violet-300/10 text-violet-100">
            <Bot className="h-3.5 w-3.5" /> ИИ с уточняющими вопросами
          </Badge>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <Card className="glass mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden border-white/10 py-0">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div
            ref={scrollRef}
            className={cn(
              "nearloy-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5",
              messages.length === 1 && !loading ? "flex flex-col justify-center" : "",
            )}
          >
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                onConfirm={
                  message.pendingAction && message.actionStatus === "pending"
                    ? () => void applyPendingAction(message.id, message.pendingAction!, message.actionImageFile ?? null)
                    : undefined
                }
              />
            ))}
            {loading && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
                Обрабатываю…
              </div>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/10 p-3 sm:p-4">
            {imagePreview && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                <img src={imagePreview} alt="Вложение" className="h-16 w-20 rounded-xl object-cover" />
                <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                  Фото прикреплено. Для акции оно будет приведено к {OFFER_WIDTH}×{OFFER_HEIGHT}.
                </div>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={clearAttachment}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="mx-auto flex max-w-5xl items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void pickImage(file);
                }}
              />
              <Button type="button" variant="secondary" className="size-14 shrink-0 rounded-2xl p-0" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                value={input}
                maxLength={INPUT_LIMIT}
                disabled={bootLoading}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Например: «Сколько у меня активных пользователей?» или «Компания теперь называется Супер кофе»"
                className="h-14 min-h-14 resize-none rounded-2xl bg-black/10 py-4"
              />
              <Button type="button" className="size-14 shrink-0 rounded-2xl p-0" disabled={loading || bootLoading || (!input.trim() && !imageFile)} onClick={() => void sendMessage()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="mx-auto mt-2 flex max-w-5xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{input.length}/{INPUT_LIMIT}</span>
              {activeOfferId && <span>Текущая акция в чате активна: можно добавить фото, промокод или даты.</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LocationDraftDetails({ locationDraft }: { locationDraft: CompanyAiPendingAction["payload"]["locationDraft"] }) {
  if (!locationDraft?.candidates.length) return null;
  return (
    <div className="grid gap-2">
      {locationDraft.candidates.slice(0, 10).map((candidate) => (
        <div key={`${candidate.input}-${candidate.address}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="flex min-w-0 items-start gap-2 font-semibold text-white">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
              <span className="min-w-0">{candidate.address}</span>
            </p>
            <Badge variant="outline" className={locationStatusClass(candidate.status)}>
              {locationStatusLabel(candidate.status)}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {candidate.city ? <span>{candidate.city}</span> : null}
            {candidate.precision ? <span>точность: {candidate.precision}</span> : null}
            {candidate.mapPreviewUrl ? (
              <a className="text-cyan-100 underline-offset-4 hover:underline" href={candidate.mapPreviewUrl} target="_blank" rel="noreferrer">
                проверить на карте
              </a>
            ) : null}
          </div>
          {candidate.note ? <p className="mt-2 text-xs text-amber-100">{candidate.note}</p> : null}
        </div>
      ))}
      {locationDraft.note ? <p className="text-xs text-muted-foreground">{locationDraft.note}</p> : null}
    </div>
  );
}

function locationStatusLabel(status: NonNullable<CompanyAiPendingAction["payload"]["locationDraft"]>["candidates"][number]["status"]) {
  if (status === "READY") return "готово";
  if (status === "CONFIRMATION_REQUIRED") return "проверить";
  if (status === "NEEDS_DETAILS") return "уточнить";
  if (status === "DUPLICATE") return "дубль";
  return "ошибка";
}

function locationStatusClass(status: NonNullable<CompanyAiPendingAction["payload"]["locationDraft"]>["candidates"][number]["status"]) {
  if (status === "READY") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "CONFIRMATION_REQUIRED") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  if (status === "DUPLICATE") return "border-white/10 bg-white/[0.04] text-muted-foreground";
  return "border-red-300/25 bg-red-300/10 text-red-100";
}

function ChatBubble({ message, onConfirm }: { message: ChatMessage; onConfirm?: () => void }) {
  const assistant = message.role === "assistant";
  return (
    <div className={cn("flex gap-3", assistant ? "justify-start" : "justify-end")}>
      {assistant && (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.08)]">
          <Bot className="h-4 w-4" />
        </span>
      )}
      <div
        className={cn(
          "w-fit max-w-2xl space-y-3 rounded-[1.35rem] border px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.16)]",
          assistant ? "border-white/10 bg-white/[0.035]" : "border-cyan-300/20 bg-cyan-300/[0.09]",
        )}
      >
        {!assistant && (
          <div className="mb-1 flex items-center gap-2 text-xs text-cyan-100">
            <User className="h-3.5 w-3.5" /> Вы
          </div>
        )}
        {message.attachmentPreview && <img src={message.attachmentPreview} alt="Вложение" className="max-h-72 rounded-2xl object-cover" />}
        <p className="whitespace-pre-wrap text-sm leading-6 text-pretty">{message.content}</p>
        {message.websiteState && (
          <div className={cn("rounded-2xl border p-3 text-xs", message.websiteState.used ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100")}>
            {message.websiteState.used ? "Сайт прочитан" : message.websiteState.error || "Сайт не удалось прочитать"}
          </div>
        )}
        {Boolean(message.warnings?.length) && (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-50">
            {message.warnings!.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}
        {Boolean(message.blockedActions?.length) && (
          <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-xs text-red-100">
            {message.blockedActions!.map((item) => <p key={item}>{item}</p>)}
          </div>
        )}
        {message.pendingAction && (
          <ActionPreview action={message.pendingAction} status={message.actionStatus} onConfirm={onConfirm} />
        )}
      </div>
      {!assistant && (
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
          <User className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

function ActionPreview({ action, status, onConfirm }: { action: CompanyAiPendingAction; status?: ChatMessage["actionStatus"]; onConfirm?: () => void }) {
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Предлагаю действие</p>
          <h3 className="mt-1 font-semibold">{action.label}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{action.confirmationText}</p>
        </div>
        {status === "applied" ? (
          <Badge variant="outline" className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" /> Применено
          </Badge>
        ) : (
          <Button type="button" className="rounded-xl" onClick={onConfirm}>
            Подтвердить
          </Button>
        )}
      </div>
      <ActionDetails action={action} />
      {status === "failed" && <p className="mt-3 text-sm text-red-100">Не удалось применить. Можно попробовать ещё раз.</p>}
    </div>
  );
}

function ActionDetails({ action }: { action: CompanyAiPendingAction }) {
  const profilePatch = action.payload.profilePatch;
  const offerDraft = action.payload.offerDraft;
  const loyaltyDraft = action.payload.loyaltyDraft;
  const locationDraft = action.payload.locationDraft;
  return (
    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
      {profilePatch?.name && <p>Название: {profilePatch.name}</p>}
      {profilePatch?.slug && (
        <p>Публичная ссылка: /wallet/{slugFromCompanyName(profilePatch.slug) || profilePatch.slug}</p>
      )}
      {profilePatch?.description && <p>Описание: {profilePatch.description}</p>}
      {profilePatch?.categoryNames.length ? <p>Категории: {profilePatch.categoryNames.join(", ")}</p> : null}
      {offerDraft?.title && <p>Акция: {offerDraft.title}</p>}
      {offerDraft?.description && <p>{offerDraft.description}</p>}
      {offerDraft?.code && <p>Промокод: {offerDraft.code}</p>}
      {offerDraft?.terms && <p>Условия: {offerDraft.terms}</p>}
      {loyaltyDraft?.levels.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {loyaltyDraft.levels.map((level) => (
            <div key={`${level.name}-${level.minimumSpend}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="font-semibold text-white">{level.name}</p>
              <p>от {level.minimumSpend.toLocaleString("ru-RU")} ₽ · {level.cashbackPercent}%</p>
            </div>
          ))}
        </div>
      ) : null}
      {action.type === "UPDATE_LOGO" ? (
        <p className="flex items-center gap-2 text-xs text-cyan-100">
          <ImagePlus className="h-3.5 w-3.5" /> Рекомендуемый размер логотипа: {LOGO_WIDTH}×{LOGO_HEIGHT}
        </p>
      ) : null}
      {action.type === "CREATE_OFFER" || action.type === "UPDATE_OFFER" ? (
        <p className="flex items-center gap-2 text-xs text-cyan-100">
          <ImagePlus className="h-3.5 w-3.5" /> Рекомендуемый размер фото: {OFFER_WIDTH}×{OFFER_HEIGHT}
        </p>
      ) : null}
      <LocationDraftDetails locationDraft={locationDraft} />
    </div>
  );
}
