"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, FileCheck, Landmark, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import { readClientLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;
type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const stepFields: Record<Step, string[]> = {
  1: ["employmentType", "contactName", "contactEmail", "password", "passwordConfirm", "companyName", "businessCategory"],
  2: ["legalLastName", "legalFirstName", "birthDate", "legalInn"],
  3: ["consentAccepted"],
};

function digitsOnly(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function maxBirthDateFor16() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 16);
  return date.toISOString().slice(0, 10);
}

const copy = {
  ru: {
    meta: "верификация компании",
    back: "Лендинг",
    badge: "Ручная проверка",
    title: "Регистрация компании в NearLoy",
    intro:
      "Company-доступ выдается только проверенным партнерам. На старте мы просим только универсальные данные для заявки, а условия выплат и договорные поля подключим позже под конкретный тип бизнеса.",
    cards: [
      [Building2, "Самозанятый", "ФИО, ИНН и контакт для первичной проверки. Реквизиты запросим отдельно, если они понадобятся."],
      [Landmark, "ИП", "ФИО, ИНН и описание бизнеса. ОГРНИП, банк и договорные поля не тащим в заявку заранее."],
      [FileCheck, "Фото паспорта", "Просим именно фото документа для ручной сверки, но не сохраняем изображение в БД."],
    ],
    progressTitle: "Прогресс верификации",
    stepWord: "Шаг",
    of: "из",
    draftRestored: "черновик восстановлен",
    draftSaved: "черновик сохранен в",
    tip: "Заполняйте только базовые данные. Финансовые реквизиты могут отличаться по типу бизнеса, поэтому добавим их отдельным безопасным сценарием.",
    steps: ["Тип", "База", "Верификация"],
    employmentType: "Тип занятости",
    selfEmployed: "Самозанятый",
    entrepreneur: "ИП",
    contactName: "Контактное лицо",
    email: "Email",
    telegram: "Telegram, если есть",
    password: "Пароль для кабинета",
    passwordConfirm: "Повторите пароль",
    accountHint:
      "Мы сразу создадим учетную запись Company. После проверки она станет владельцем компании, а позже сюда можно будет добавлять сотрудников.",
    companyName: "Название компании или проекта",
    businessCategory: "Что продаете / сфера бизнеса",
    legalHint:
      "Пока оставляем только универсальный минимум: ФИО по документам и ИНН. Реквизиты, ОГРНИП, регион и условия вывода добавим позже как отдельные настраиваемые поля.",
    legalLastName: "Фамилия по документам",
    legalFirstName: "Имя по документам",
    legalMiddleName: "Отчество, если есть",
    birthDate: "Дата рождения",
    inn: "ИНН",
    passportHint:
      "Для полной верификации введите паспортные данные и приложите фото. Текстовые паспортные данные хранятся зашифрованно, фото хранится зашифрованным файлом и удаляется после approve/reject.",
    passportSeries: "Серия паспорта",
    passportNumber: "Номер паспорта",
    passportIssuedBy: "Кем выдан",
    passportIssuedAt: "Дата выдачи",
    passportDepartmentCode: "Код подразделения",
    passportPhoto: "Фото паспорта",
    passportPhotoButton: "Выбрать файл",
    passportPhotoEmpty: "Файл не выбран",
    passportPhotoHelp: "JPG, PNG, WEBP или HEIC до 8 MB. Лучше фото разворота с данными, без бликов и обрезанных углов.",
    consent:
      "Я подтверждаю достоверность данных и согласен на обработку персональных данных для проверки партнера и подготовки выплат.",
    backButton: "Назад",
    nextButton: "Далее",
    sending: "Отправляем...",
    submit: "Отправить на проверку",
    success: "Заявка отправлена. Мы свяжемся после ручной проверки.",
    error: "Не удалось отправить заявку.",
    stepBlocked: "Заполните обязательные поля текущего шага, чтобы идти дальше.",
    ageBlocked: "Партнерский кабинет доступен только с 16 лет.",
  },
  en: {
    meta: "verified company onboarding",
    back: "Landing",
    badge: "Manual verification",
    title: "Register a company in NearLoy",
    intro:
      "Company access is issued only to verified partners. We collect only universal application details first; payout and contract fields will be added later per business type.",
    cards: [
      [Building2, "Self-employed", "Legal name, tax ID and contact details for the first review. Payout details are requested separately if needed."],
      [Landmark, "Individual entrepreneur", "Legal name, tax ID and business description. Registration and bank fields are not requested upfront."],
      [FileCheck, "Passport photo", "We request a document photo for manual checks, but the image itself is not stored in the database."],
    ],
    progressTitle: "Verification progress",
    stepWord: "Step",
    of: "of",
    draftRestored: "draft restored",
    draftSaved: "draft saved at",
    tip: "Fill only the basic data. Financial details vary by business model, so they will be handled in a separate safe flow.",
    steps: ["Type", "Basics", "Verification"],
    employmentType: "Employment type",
    selfEmployed: "Self-employed",
    entrepreneur: "Individual entrepreneur",
    contactName: "Contact person",
    email: "Email",
    telegram: "Telegram, optional",
    password: "Account password",
    passwordConfirm: "Repeat password",
    accountHint:
      "We will create a Company account immediately. After review, it becomes the company owner and later can invite employees.",
    companyName: "Company or project name",
    businessCategory: "What do you sell / business area",
    legalHint:
      "For now we keep only the universal minimum: legal full name and tax ID. Payout, registration and contract fields will be added later as configurable fields.",
    legalLastName: "Legal last name",
    legalFirstName: "Legal first name",
    legalMiddleName: "Middle name, optional",
    birthDate: "Birth date",
    inn: "Tax ID",
    passportHint:
      "For full verification, enter passport data and attach a photo. Text passport data is encrypted; the photo is stored as an encrypted file and removed after approve/reject.",
    passportSeries: "Passport series",
    passportNumber: "Passport number",
    passportIssuedBy: "Issued by",
    passportIssuedAt: "Issue date",
    passportDepartmentCode: "Department code",
    passportPhoto: "Passport photo",
    passportPhotoButton: "Choose file",
    passportPhotoEmpty: "No file selected",
    passportPhotoHelp: "JPG, PNG, WEBP or HEIC up to 8 MB. Use a clear photo of the identity page without glare or cropped corners.",
    consent:
      "I confirm that the data is accurate and consent to personal data processing for partner verification and payout preparation.",
    backButton: "Back",
    nextButton: "Next",
    sending: "Sending...",
    submit: "Submit verification",
    success: "Verification request submitted. We will contact you after manual review.",
    error: "Failed to submit request.",
    stepBlocked: "Fill in the required fields on this step before moving forward.",
    ageBlocked: "Company access is available only from age 16.",
  },
} satisfies Record<Locale, Record<string, unknown>>;

export default function CompanyRegisterPage() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [step, setStep] = useState<Step>(1);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState("SELF_EMPLOYED");
  const [passportFileName, setPassportFileName] = useState("");
  const [companyReferralCode, setCompanyReferralCode] = useState("");
  const t = copy[locale];
  const cards = t.cards as Array<[typeof Building2, string, string]>;
  const steps = t.steps as string[];
  const maxBirthDate = useMemo(() => maxBirthDateFor16(), []);

  const draftLabel = useMemo(() => {
    if (!draftSavedAt) return "";
    return draftSavedAt === "restored" ? String(t.draftRestored) : `${t.draftSaved} ${draftSavedAt}`;
  }, [draftSavedAt, t.draftRestored, t.draftSaved]);

  useEffect(() => {
    setLocale(readClientLocale("en"));
    setCompanyReferralCode(new URLSearchParams(window.location.search).get("ref")?.trim() ?? "");
    const raw = window.localStorage.getItem("nearloy.company-register-draft");
    if (!raw || !formRef.current) return;
    try {
      const draft = JSON.parse(raw) as Record<string, string>;
      for (const [name, value] of Object.entries(draft)) {
        const field = formRef.current.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (field) field.value = value;
      }
      if (draft.employmentType) setEmploymentType(draft.employmentType);
      setDraftSavedAt("restored");
    } catch {
      window.localStorage.removeItem("nearloy.company-register-draft");
    }
  }, []);

  function saveDraft(form: HTMLFormElement) {
    const draft = Object.fromEntries(
      Array.from(new FormData(form).entries())
        .filter(([, value]) => typeof value === "string")
        .filter(([key]) => key !== "password" && key !== "passwordConfirm")
        .map(([key, value]) => [key, String(value)]),
    );
    window.localStorage.setItem("nearloy.company-register-draft", JSON.stringify(draft));
    setDraftSavedAt(new Date().toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }));
  }

  function normalizeDigits(event: FormEvent<HTMLInputElement>, max: number) {
    event.currentTarget.value = digitsOnly(event.currentTarget.value, max);
  }

  function field(name: string) {
    return formRef.current?.elements.namedItem(name) as FieldElement | RadioNodeList | null;
  }

  function validateField(name: string) {
    const item = field(name);
    if (!item) return true;
    if (item instanceof RadioNodeList) {
      return item.value.trim().length > 0;
    }
    return item.reportValidity();
  }

  function validateStep(targetStep = step) {
    const names = [...stepFields[targetStep]];
    if (targetStep === 2) {
      const birthDate = field("birthDate") as HTMLInputElement | null;
      if (birthDate?.value && birthDate.value > maxBirthDate) {
        birthDate.setCustomValidity(String(t.ageBlocked));
        birthDate.reportValidity();
        birthDate.setCustomValidity("");
        setStatus("error");
        setMessage(String(t.ageBlocked));
        return false;
      }
    }
    if (targetStep === 3) {
      names.push("passportSeries", "passportNumber", "passportIssuedAt", "passportIssuedBy", "passportPhoto");
    }
    const ok = names.every(validateField);
    if (!ok) {
      setStatus("error");
      setMessage(String(t.stepBlocked));
    } else if (status === "error" && message === String(t.stepBlocked)) {
      setStatus("idle");
      setMessage("");
    }
    return ok;
  }

  function goToStep(nextStep: Step) {
    if (nextStep <= step) {
      setStep(nextStep);
      return;
    }
    for (let current = step; current < nextStep; current += 1) {
      if (!validateStep(current as Step)) return;
    }
    setStep(nextStep);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(3)) return;
    const form = event.currentTarget;
    const payload = new FormData(form);
    payload.set("identityVerificationMode", "FULL");
    payload.set("consentAccepted", form.querySelector<HTMLInputElement>("#consentAccepted")?.checked === true ? "true" : "false");

    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/company/register", {
        method: "POST",
        body: payload,
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message || String(t.error));
      setStatus("sent");
      setMessage(String(t.success));
      window.localStorage.removeItem("nearloy.company-register-draft");
      form.reset();
      setEmploymentType("SELF_EMPLOYED");
      setPassportFileName("");
      setStep(1);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(t.error));
    }
  }

  return (
    <main className="min-h-screen bg-[#03060d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,72px_72px,72px_72px]" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <NearLoyLogo className="h-10 w-10" />
            <div>
              <p className="text-xl font-semibold">NearLoy</p>
              <p className="text-xs text-white/48">{String(t.meta)}</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher locale={locale} onChange={setLocale} />
            <Button asChild variant="outline" className="border-white/12 bg-white/6 text-white hover:bg-white/12">
              <Link href="/"><ArrowLeft className="h-4 w-4" /> {String(t.back)}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 shadow-[0_0_46px_rgba(255,255,255,0.06)]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-sm text-white/60">
                <ShieldCheck className="h-4 w-4" /> {String(t.badge)}
              </div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{String(t.title)}</h1>
              <p className="mt-4 leading-7 text-white/60">{String(t.intro)}</p>
            </div>
            <div className="grid gap-3">
              {cards.map(([Icon, title, text]) => (
                <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.08]"><Icon className="h-5 w-5" /></span>
                  <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-white/52">{text}</p></div>
                </div>
              ))}
            </div>
          </div>

          <form ref={formRef} onSubmit={submit} onChange={(event) => saveDraft(event.currentTarget)} className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_0_46px_rgba(255,255,255,0.06)] sm:p-6">
            <input type="hidden" name="companyReferralCode" value={companyReferralCode} />
            <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{String(t.progressTitle)}</span>
                <span className="text-white/52">{t.stepWord as string} {step} {t.of as string} 3 {draftLabel ? `· ${draftLabel}` : ""}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(step / 3) * 100}%` }} />
              </div>
              <p className="mt-3 text-sm leading-6 text-white/56">{String(t.tip)}</p>
            </div>

            <div className="mb-6 grid gap-2 sm:grid-cols-3">
              {steps.map((label, index) => {
                const value = (index + 1) as Step;
                return (
                  <button key={label} type="button" onClick={() => goToStep(value)} className={cn("rounded-2xl border px-4 py-3 text-left transition", step === value ? "border-white bg-white text-black" : "border-white/10 bg-black/18 text-white/56 hover:bg-white/[0.07]")}> 
                    <p className="text-xs uppercase tracking-wide opacity-60">{String(t.stepWord)} {value}</p>
                    <p className="font-semibold">{label}</p>
                  </button>
                );
              })}
            </div>

            <div className={cn("grid gap-4", step !== 1 && "hidden")}>
              <label className="space-y-2">
                <span className="text-sm text-white/60">{String(t.employmentType)}</span>
                <OptionSelect
                  name="employmentType"
                  required
                  value={employmentType}
                  onChange={setEmploymentType}
                  options={[
                    { value: "SELF_EMPLOYED", label: String(t.selfEmployed), icon: Building2 },
                    { value: "INDIVIDUAL_ENTREPRENEUR", label: String(t.entrepreneur), icon: Landmark },
                  ]}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="contactName" required maxLength={120} placeholder={String(t.contactName)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="contactEmail" required type="email" maxLength={160} placeholder={String(t.email)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="contactTelegram" maxLength={80} placeholder={String(t.telegram)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="companyName" required maxLength={160} placeholder={String(t.companyName)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder={String(t.password)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="passwordConfirm" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder={String(t.passwordConfirm)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/58">{String(t.accountHint)}</div>
              <Textarea name="businessCategory" required maxLength={120} placeholder={String(t.businessCategory)} className="min-h-28 rounded-xl border-white/12 bg-black/22 text-white" />
            </div>

            <div className={cn("grid gap-4", step !== 2 && "hidden")}>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50/80">{String(t.legalHint)}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="legalLastName" required maxLength={80} placeholder={String(t.legalLastName)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="legalFirstName" required maxLength={80} placeholder={String(t.legalFirstName)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="legalMiddleName" maxLength={80} placeholder={String(t.legalMiddleName)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="birthDate" required type="date" max={maxBirthDate} placeholder={String(t.birthDate)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white [color-scheme:dark]" />
                <Input name="legalInn" required inputMode="numeric" minLength={10} maxLength={12} pattern="\d{10}|\d{12}" onInput={(event) => normalizeDigits(event, 12)} placeholder={String(t.inn)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
              </div>
            </div>

            <div className={cn("grid gap-4", step !== 3 && "hidden")}>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/82">{String(t.passportHint)}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="passportSeries" required inputMode="numeric" minLength={4} maxLength={4} pattern="\d{4}" onInput={(event) => normalizeDigits(event, 4)} placeholder={String(t.passportSeries)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="passportNumber" required inputMode="numeric" minLength={6} maxLength={6} pattern="\d{6}" onInput={(event) => normalizeDigits(event, 6)} placeholder={String(t.passportNumber)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
                <Input name="passportIssuedAt" required type="date" max={new Date().toISOString().slice(0, 10)} placeholder={String(t.passportIssuedAt)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white [color-scheme:dark]" />
                <Input name="passportDepartmentCode" inputMode="numeric" minLength={6} maxLength={6} pattern="\d{6}" onInput={(event) => normalizeDigits(event, 6)} placeholder={String(t.passportDepartmentCode)} className="h-12 rounded-xl border-white/12 bg-black/22 text-white" />
              </div>
              <Textarea name="passportIssuedBy" required maxLength={240} placeholder={String(t.passportIssuedBy)} className="min-h-24 rounded-xl border-white/12 bg-black/22 text-white" />
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/18 bg-black/22 p-8 text-center transition hover:border-white/35 hover:bg-white/[0.06]">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/8 shadow-[0_0_24px_rgba(255,255,255,0.08)]">
                      <UploadCloud className="h-7 w-7 text-white" />
                    </span>
                    <span className="text-lg font-semibold">{String(t.passportPhoto)}</span>
                    <span className="mt-2 max-w-xl text-sm leading-6 text-white/56">{String(t.passportPhotoHelp)}</span>
                    <input
                      name="passportPhoto"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      required
                      onChange={(event) => setPassportFileName(event.currentTarget.files?.[0]?.name ?? "")}
                      className="sr-only"
                    />
                    <span className="mt-5 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-black/30 text-left sm:flex-row">
                      <span className="inline-flex items-center justify-center border-b border-white/12 bg-white/[0.08] px-5 py-3 font-semibold text-white transition group-hover:bg-white/[0.12] sm:border-b-0 sm:border-r">
                        {String(t.passportPhotoButton)}
                      </span>
                      <span className="min-w-0 flex-1 truncate px-5 py-3 text-white/70">
                        {passportFileName || String(t.passportPhotoEmpty)}
                      </span>
                    </span>
              </label>
              <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/18 p-4 text-sm leading-6 text-white/64">
                <input id="consentAccepted" name="consentAccepted" required type="checkbox" className="mt-1 h-4 w-4" />
                <span>{String(t.consent)}</span>
              </label>
            </div>

            {message && <div className={cn("mt-5 rounded-2xl border p-4 text-sm", status === "error" ? "border-red-300/20 bg-red-300/10 text-red-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100")}>{message}</div>}

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <Button type="button" variant="secondary" disabled={step === 1} onClick={() => setStep((Math.max(1, step - 1) as Step))}>{String(t.backButton)}</Button>
              {step < 3 ? (
                <Button type="button" className="bg-white text-black hover:bg-white/90" onClick={() => goToStep((Math.min(3, step + 1) as Step))}>{String(t.nextButton)}</Button>
              ) : (
                <Button type="submit" disabled={status === "sending"} className="bg-white text-black hover:bg-white/90">
                  {status === "sending" ? String(t.sending) : String(t.submit)}
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

