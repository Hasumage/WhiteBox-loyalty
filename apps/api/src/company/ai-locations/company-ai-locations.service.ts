import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CompanyAiAssistDto } from "../dto/company-ai.dto";
import type { CompanyAiLocationCandidate, CompanyAiLocationsDraft } from "./company-ai-locations.types";

type WebsiteSnapshotInput = {
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  error: string | null;
};

type GeocoderFeature = {
  GeoObject?: {
    Point?: { pos?: string };
    name?: string;
    description?: string;
    metaDataProperty?: {
      GeocoderMetaData?: {
        precision?: string;
        text?: string;
        Address?: {
          formatted?: string;
          Components?: Array<{ kind?: string; name?: string }>;
        };
      };
    };
  };
};

type GeocoderResult = {
  latitude: number;
  longitude: number;
  precision: string | null;
  formattedAddress: string;
  city: string | null;
};

export type CompanyAiLocationsAssistResult = {
  reply: string;
  intent: "ANSWER" | "NEED_MORE_INFO" | "PROPOSE_ACTION" | "BLOCKED";
  pendingAction: {
    type: "CREATE_LOCATIONS";
    label: string;
    confirmationText: string;
    payload: {
      profilePatch: null;
      offerDraft: null;
      loyaltyDraft: null;
      locationDraft: CompanyAiLocationsDraft;
      targetOfferId: null;
    };
  } | null;
  warnings: string[];
  blockedActions: string[];
};

const LOCATION_FETCH_BODY_LIMIT = 160_000;
const LOCATION_TEXT_LIMIT = 14_000;
const MAX_LOCATION_CANDIDATES = 10;
const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];
const STRONG_PRECISIONS = new Set(["exact", "number"]);
const WEAK_PRECISIONS = new Set(["street", "other", "range"]);

@Injectable()
export class CompanyAiLocationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async assist(
    userId: number,
    dto: CompanyAiAssistDto,
    website: WebsiteSnapshotInput | null,
  ): Promise<CompanyAiLocationsAssistResult | null> {
    const text = this.latestUserText(dto);
    if (!this.shouldHandle(text, dto, website)) return null;

    const member = await this.prisma.companyMember.findFirst({
      where: { userId, isActive: true },
      select: { companyId: true },
      orderBy: { id: "asc" },
    });
    if (!member) {
      return this.simpleReply("Не нашёл активную компанию для добавления адресов.", "NEED_MORE_INFO");
    }

    const existingLocations = await this.prisma.companyLocation.findMany({
      where: { companyId: member.companyId },
      select: { address: true, city: true, latitude: true, longitude: true },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    });

    const websiteUrl = this.extractWebsiteUrl(dto, website);
    const wantsWebsite = Boolean(websiteUrl && /сайт|спарс|парс|адреса|локац|точк|филиал|locations?|address/i.test(text));
    const sourceText = wantsWebsite ? await this.websiteLocationText(websiteUrl, website) : this.cleanAddressInput(text);
    const source = wantsWebsite ? "website" : "message";
    const inputs = this.extractAddressInputs(sourceText, source).slice(0, MAX_LOCATION_CANDIDATES);

    if (!inputs.length) {
      if (wantsWebsite && website?.error) {
        return this.simpleReply(`Не смог прочитать сайт: ${website.error}. Пришлите адреса текстом или другую страницу с контактами.`, "NEED_MORE_INFO");
      }
      return this.simpleReply("Не увидел конкретные адреса. Пришлите адрес, город + улицу/дом, или ссылку на страницу с точками.", "NEED_MORE_INFO");
    }

    const defaultCity = this.defaultCity(existingLocations);
    const candidates: CompanyAiLocationCandidate[] = [];
    for (const input of inputs) {
      candidates.push(await this.buildCandidate(input, defaultCity, existingLocations));
    }

    const savable = candidates.filter((candidate) =>
      ["READY", "CONFIRMATION_REQUIRED"].includes(candidate.status) && candidate.latitude != null && candidate.longitude != null,
    );
    const duplicateCount = candidates.filter((candidate) => candidate.status === "DUPLICATE").length;
    const needsDetailsCount = candidates.filter((candidate) => ["NEEDS_DETAILS", "FAILED"].includes(candidate.status)).length;

    if (!savable.length) {
      const reason =
        duplicateCount === candidates.length
          ? "Все найденные адреса уже похожи на существующие точки компании."
          : "Нашёл адреса, но не могу безопасно добавить их без уточнений.";
      return {
        reply: `${reason} Проверьте список: ${this.shortCandidateList(candidates)}`,
        intent: "NEED_MORE_INFO",
        pendingAction: null,
        warnings: candidates.map((candidate) => candidate.note).filter(Boolean).slice(0, 3) as string[],
        blockedActions: [],
      };
    }

    const draft: CompanyAiLocationsDraft = {
      source,
      candidates,
      reviewUrl: "/company/settings",
      note:
        needsDetailsCount > 0 || duplicateCount > 0
          ? "Добавятся только готовые адреса. Дубли и неточные результаты пропущены."
          : null,
    };

    const confirmationRequired = savable.some((candidate) => candidate.status === "CONFIRMATION_REQUIRED");
    const warnings = [
      confirmationRequired ? "У части адресов нужно глазами проверить город перед подтверждением." : "",
      duplicateCount ? `${duplicateCount} адрес(а) похожи на уже добавленные и будут пропущены.` : "",
      needsDetailsCount ? `${needsDetailsCount} адрес(а) требуют уточнения дома или города.` : "",
    ].filter(Boolean);

    return {
      reply: [
        `Нашёл ${candidates.length} адрес(ов), ${savable.length} можно добавить сейчас.`,
        confirmationRequired ? "Проверьте найденный город и точку на карте, затем подтвердите." : "Проверьте список и подтвердите добавление.",
      ].join(" "),
      intent: "PROPOSE_ACTION",
      pendingAction: {
        type: "CREATE_LOCATIONS",
        label: savable.length === 1 ? "Добавить точку компании" : `Добавить точки компании: ${savable.length}`,
        confirmationText: confirmationRequired
          ? "Подтвердите, что найденные адреса и города верные. После этого я добавлю точки компании."
          : "Подтвердите добавление найденных точек компании.",
        payload: {
          profilePatch: null,
          offerDraft: null,
          loyaltyDraft: null,
          locationDraft: draft,
          targetOfferId: null,
        },
      },
      warnings,
      blockedActions: [],
    };
  }

  private async buildCandidate(
    input: string,
    defaultCity: string | null,
    existingLocations: Array<{ address: string; city: string | null; latitude: Prisma.Decimal; longitude: Prisma.Decimal }>,
  ): Promise<CompanyAiLocationCandidate> {
    const hasCity = this.hasExplicitCity(input);
    const query = defaultCity && !hasCity ? `${defaultCity}, ${input}` : input;
    const geocoded = await this.geocode(query);
    if (!geocoded) {
      return {
        input,
        title: null,
        address: input,
        city: defaultCity,
        latitude: null,
        longitude: null,
        precision: null,
        status: "FAILED",
        note: "Геокодер не нашёл координаты. Уточните город, улицу и дом.",
        mapPreviewUrl: null,
        openTime: "09:00",
        closeTime: "21:00",
        workingDays: DEFAULT_WORKING_DAYS,
      };
    }

    const duplicate = existingLocations.some((location) => {
      const sameAddress = this.normalizeAddress(location.address) === this.normalizeAddress(geocoded.formattedAddress);
      const distance = this.distanceMeters(
        Number(location.latitude),
        Number(location.longitude),
        geocoded.latitude,
        geocoded.longitude,
      );
      return sameAddress || distance < 50;
    });
    if (duplicate) {
      return this.geocodedCandidate(input, geocoded, "DUPLICATE", "Похоже, такая точка уже есть у компании.");
    }

    const placeQuery = this.isPlaceQuery(input) && !this.hasAddressSignal(input);
    if (placeQuery) {
      return this.geocodedCandidate(
        input,
        geocoded,
        "CONFIRMATION_REQUIRED",
        `Нашёл место по названию: ${geocoded.formattedAddress}. Проверьте точку на карте перед подтверждением.`,
      );
    }

    const weakPrecision = !geocoded.precision || WEAK_PRECISIONS.has(geocoded.precision);
    const lacksHouse = !/\d/.test(input);
    if (weakPrecision || lacksHouse) {
      return this.geocodedCandidate(
        input,
        geocoded,
        "NEEDS_DETAILS",
        "Нужен более точный адрес: город, улица и номер дома.",
      );
    }

    if (!hasCity && !defaultCity && STRONG_PRECISIONS.has(geocoded.precision ?? "")) {
      return this.geocodedCandidate(
        input,
        geocoded,
        "CONFIRMATION_REQUIRED",
        `Нашёл: ${geocoded.formattedAddress}. Подтвердите, что это нужный город.`,
      );
    }

    return this.geocodedCandidate(input, geocoded, "READY", null);
  }

  private geocodedCandidate(
    input: string,
    geocoded: GeocoderResult,
    status: CompanyAiLocationCandidate["status"],
    note: string | null,
  ): CompanyAiLocationCandidate {
    return {
      input,
      title: null,
      address: geocoded.formattedAddress,
      city: geocoded.city,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      precision: geocoded.precision,
      status,
      note,
      mapPreviewUrl: `https://yandex.ru/maps/?pt=${geocoded.longitude},${geocoded.latitude}&z=16&l=map`,
      openTime: "09:00",
      closeTime: "21:00",
      workingDays: DEFAULT_WORKING_DAYS,
    };
  }

  private async geocode(query: string): Promise<GeocoderResult | null> {
    const apiKey =
      this.config.get<string>("YANDEX_GEOCODER_API_KEY")?.trim() ||
      this.config.get<string>("NEXT_PUBLIC_YANDEX_MAPS_API_KEY")?.trim();
    if (!apiKey) return null;

    const params = new URLSearchParams({
      apikey: apiKey,
      geocode: query,
      format: "json",
      lang: "ru_RU",
      results: "5",
    });
    const referer = this.config.get<string>("FRONTEND_ORIGIN") ?? "http://localhost:3000";
    const response = await fetch(`https://geocode-maps.yandex.ru/v1/?${params.toString()}`, {
      headers: { Referer: referer },
    }).catch(() => null);
    if (!response?.ok) return null;

    const payload = (await response.json().catch(() => null)) as {
      response?: { GeoObjectCollection?: { featureMember?: GeocoderFeature[] } };
    } | null;
    const geoObject = payload?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const pos = geoObject?.Point?.pos;
    if (!pos) return null;
    const [longitudeRaw, latitudeRaw] = pos.split(" ");
    const longitude = Number(longitudeRaw);
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const meta = geoObject.metaDataProperty?.GeocoderMetaData;
    const components = meta?.Address?.Components ?? [];
    const city =
      components.find((component) => component.kind === "locality")?.name ??
      components.find((component) => component.kind === "province")?.name ??
      null;
    return {
      latitude,
      longitude,
      precision: meta?.precision ?? null,
      formattedAddress: meta?.Address?.formatted ?? meta?.text ?? query,
      city,
    };
  }

  private shouldHandle(text: string, dto: CompanyAiAssistDto, website: WebsiteSnapshotInput | null) {
    const normalized = text.toLowerCase();
    const hasLocationIntent = /адрес|локац|точк|филиал|геокод|карте|карту|спарс|парс|location|address|branch/.test(normalized);
    const hasNaturalPlaceIntent = /где\s+находится|загугли|найди\s+(?:где|место)|покажи\s+где|place|poi/.test(normalized);
    const hasWebsite = Boolean(this.extractWebsiteUrl(dto, website));
    return hasLocationIntent || hasNaturalPlaceIntent || (hasWebsite && /сайт|контакт|contacts?|locations?/i.test(normalized));
  }

  private extractAddressInputs(text: string, source: "message" | "website") {
    const direct = source === "message" ? this.cleanAddressInput(text) : text;
    const lineCandidates = direct
      .split(/[\n;|]+/g)
      .map((line) => this.cleanAddressCandidate(line))
      .filter((line) => this.hasAddressSignal(line) || (source === "message" && this.isPlaceQuery(line)));
    const regexCandidates = this.extractInlineAddresses(direct);
    const cleanedDirect = this.cleanAddressCandidate(direct);
    const candidates =
      source === "message" && (this.hasAddressSignal(cleanedDirect) || this.isPlaceQuery(cleanedDirect))
        ? [cleanedDirect]
        : [];
    return this.uniqueCandidates([...candidates, ...lineCandidates, ...regexCandidates]);
  }

  private extractInlineAddresses(text: string) {
    const matches = [
      ...text.matchAll(
        /(?:(?:г\.?|город)\s*)?[А-ЯЁA-Z][А-ЯЁа-яёA-Za-z\-\s]{2,38},?\s+(?:ул\.?|улица|проспект|пр-т|пр\.|бульвар|б-р|шоссе|переулок|пер\.?|наб\.?|набережная|площадь|пл\.?|проезд|аллея|тракт)\s+[^.;\n|]{2,90}/giu,
      ),
      ...text.matchAll(
        /(?:ул\.?|улица|проспект|пр-т|пр\.|бульвар|б-р|шоссе|переулок|пер\.?|наб\.?|набережная|площадь|пл\.?|проезд|аллея|тракт)\s+[^.;\n|]{2,90}/giu,
      ),
    ];
    return matches
      .map((match) => this.cleanAddressCandidate(match[0]))
      .filter((candidate) => this.hasAddressSignal(candidate));
  }

  private cleanAddressInput(value: string) {
    return value
      .replace(/https?:\/\/[^\s)\]}>,]+/gi, " ")
      .replace(/\b(добавь|создай|поставь|найди|спарси|распарси|адреса|адрес|локации|локацию|точки|точку|филиалы|филиал)\b/giu, " ")
      .replace(/\b(загугли|гугли|где\s+находится|найди\s+где|покажи\s+где|место|объект)\b/giu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private cleanAddressCandidate(value: string) {
    return value
      .replace(/\s+/g, " ")
      .replace(/^[\s,.:—-]+|[\s,.:—-]+$/g, "")
      .replace(/\s+(телефон|тел\.|режим|часы|ежедневно|пн|вт|ср|чт|пт|сб|вс|как добраться|маршрут|сайт|email|почта).*$/iu, "")
      .trim();
  }

  private hasAddressSignal(value: string) {
    if (value.length < 6 || value.length > 180) return false;
    const hasStreet = /(?:ул\.?|улица|проспект|пр-т|пр\.|бульвар|б-р|шоссе|переулок|пер\.?|наб\.?|набережная|площадь|пл\.?|проезд|аллея|тракт)\b/iu.test(value);
    const hasHouse = /\d+[А-Яа-яA-Za-z0-9/-]*/.test(value);
    const hasCity = this.hasExplicitCity(value);
    return hasStreet || (hasCity && hasHouse);
  }

  private isPlaceQuery(value: string) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length < 4 || normalized.length > 100) return false;
    if (!/[a-zа-яё]/i.test(normalized)) return false;
    if (/https?:|@|\.ru|\.com|\.рф/i.test(normalized)) return false;
    const lower = normalized.toLowerCase();
    if (/^(мои|мой|моя|наши|наш|тут|там|сюда|отсюда|сайт|страница|карта|адреса?|локации?|точки?)$/iu.test(lower)) return false;
    return normalized.split(/\s+/).length <= 8;
  }

  private hasExplicitCity(value: string) {
    return /(?:^|[\s,])(?:г\.?|город|москва|санкт[-\s]?петербург|краснодар|казань|екатеринбург|новосибирск|нижний новгород|ростов|самара|воронеж|сочи|уфа|пермь|омск|челябинск|сколково|московская область)(?:[\s,]|$)/iu.test(
      value,
    );
  }

  private uniqueCandidates(values: string[]) {
    const seen = new Set<string>();
    return values
      .map((value) => this.cleanAddressCandidate(value))
      .filter(Boolean)
      .filter((value) => {
        const key = this.normalizeAddress(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private defaultCity(locations: Array<{ city: string | null; address: string }>) {
    const city = locations.find((location) => location.city)?.city?.trim();
    if (city) return city;
    const addressCity = locations
      .map((location) => location.address.split(",")[0]?.trim())
      .find((part) => part && !/(?:ул\.?|улица|проспект|шоссе|переулок|бульвар)/iu.test(part));
    return addressCity || null;
  }

  private normalizeAddress(value: string) {
    return value
      .toLowerCase()
      .replace(/[.,]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private shortCandidateList(candidates: CompanyAiLocationCandidate[]) {
    return candidates
      .slice(0, 4)
      .map((candidate) => `${candidate.input} — ${candidate.note ?? candidate.status}`)
      .join("; ");
  }

  private latestUserText(dto: CompanyAiAssistDto) {
    const latestFromMessages = [...(dto.messages ?? [])].reverse().find((message) => message.role === "user")?.content;
    return (dto.prompt || latestFromMessages || "").trim();
  }

  private extractWebsiteUrl(dto: CompanyAiAssistDto, website: WebsiteSnapshotInput | null) {
    return website?.url ?? dto.websiteUrl?.trim() ?? this.latestUserText(dto).match(/https?:\/\/[^\s)\]}>,]+/i)?.[0] ?? null;
  }

  private async websiteLocationText(url: string | null, website: WebsiteSnapshotInput | null) {
    const ownText = url ? await this.fetchWebsiteText(url).catch(() => null) : null;
    return ownText || website?.text || "";
  }

  private async fetchWebsiteText(inputUrl: string) {
    let current = new URL(inputUrl);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.assertPublicUrl(current);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch(current.toString(), {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            "User-Agent": "NearLoyCompanyLocationsAI/1.0",
            Accept: "text/html,text/plain;q=0.9,*/*;q=0.2",
          },
        });
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          current = new URL(location, current);
          continue;
        }
        if (!response.ok) return "";
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType && !/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) return "";
        const html = (await response.text()).slice(0, LOCATION_FETCH_BODY_LIMIT);
        return this.decodeHtml(
          html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(?:p|div|li|section|article|address|tr|h[1-6])>/gi, "\n")
            .replace(/<[^>]+>/g, " ")
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s+/g, "\n")
            .slice(0, LOCATION_TEXT_LIMIT),
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    return "";
  }

  private async assertPublicUrl(url: URL) {
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Only public http/https links are supported.");
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      throw new Error("Only public websites are supported.");
    }
    const directIp = isIP(hostname);
    if (directIp && this.isBlockedIp(hostname)) throw new Error("Only public websites are supported.");
    if (!directIp) {
      const records = await lookup(hostname, { all: true });
      if (!records.length || records.some((record) => this.isBlockedIp(record.address))) {
        throw new Error("Only public websites are supported.");
      }
    }
  }

  private isBlockedIp(address: string) {
    const family = isIP(address);
    if (family === 4) {
      const [a, b] = address.split(".").map(Number);
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

  private distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6_371_000;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private decodeHtml(value: string) {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&laquo;/g, "«")
      .replace(/&raquo;/g, "»")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private simpleReply(
    reply: string,
    intent: CompanyAiLocationsAssistResult["intent"],
  ): CompanyAiLocationsAssistResult {
    return { reply, intent, pendingAction: null, warnings: [], blockedActions: [] };
  }
}
