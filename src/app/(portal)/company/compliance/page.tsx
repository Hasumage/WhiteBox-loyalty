"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  FileCheck2,
  Globe2,
  Landmark,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import { companyProfile, submitCompanyVerification, type CompanyProfile } from "@/lib/api/company-client";
import { categoryName } from "@/lib/i18n/categories";
import { useI18n } from "@/lib/i18n/use-i18n";

function shortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

function digitsOnly(event: FormEvent<HTMLInputElement>, limit: number) {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, limit);
}

export default function CompanyCompliancePage() {
  const { t } = useI18n("ru");
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showApplication, setShowApplication] = useState(false);
  const [employmentType, setEmploymentType] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const latestBirthDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 16);
    return date.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    companyProfile().then(setProfile).catch((reason: Error) => setError(reason.message));
  }, []);

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    if (!employmentType) {
      setError("Выберите тип занятости.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    formData.set("contactName", profile.member.name);
    formData.set("contactEmail", profile.member.email);
    formData.set("companyName", profile.company.name);
    formData.set("employmentType", employmentType);
    formData.set("identityVerificationMode", "FULL");
    try {
      const response = await submitCompanyVerification(formData);
      setNotice(response.message || "Заявка отправлена на проверку.");
      setShowApplication(false);
      setEmploymentType("");
      setProfile(await companyProfile());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить заявку.");
    } finally {
      setSubmitting(false);
    }
  }

  const application = profile?.company.verificationApplication;
  const hasOpenApplication = application?.status === "SUBMITTED" || application?.status === "REVIEWING";
  const isVerified = profile?.company.identityVerificationCompleted && profile.company.verificationStatus === "APPROVED";
  const canSubmit = profile?.member.role === "OWNER" && !hasOpenApplication && !isVerified;

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Партнёр</p>
        <h1 className="text-3xl font-semibold">Профиль компании</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Проверка статуса, формата работы и доступов кабинета.
        </p>
      </header>
      {error && (
        <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {notice}
        </div>
      )}
      {profile && (
        <>
          <Card className="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_90%_0%,rgba(103,232,249,0.12),transparent_38%),rgba(255,255,255,0.025)] py-0">
            <CardContent className="flex flex-wrap items-center justify-between gap-5 p-6">
              <div className="flex items-center gap-4">
                <span className="rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.07] p-4">
                  <Building2 className="h-7 w-7 text-cyan-100" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold">{profile.company.name}</h2>
                  <p className="text-sm text-muted-foreground">{profile.company.description || "Описание не заполнено"}</p>
                </div>
              </div>
              {isVerified ? (
                <Badge className="bg-emerald-100 text-emerald-950">
                  <BadgeCheck /> Проверена
                </Badge>
              ) : hasOpenApplication ? (
                <Badge className="bg-amber-100 text-amber-950">
                  <CalendarDays /> На проверке
                </Badge>
              ) : (
                <Badge className="border border-cyan-200/25 bg-cyan-200/10 text-cyan-50">
                  <ShieldCheck /> Не верифицирована
                </Badge>
              )}
            </CardContent>
          </Card>

          {!isVerified && hasOpenApplication && application && (
            <Card className="overflow-hidden border-amber-200/20 bg-[radial-gradient(circle_at_10%_0%,rgba(251,191,36,0.12),transparent_45%),rgba(255,255,255,0.02)] py-0">
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <span className="mt-1 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-3">
                    <FileCheck2 className="h-6 w-6 text-amber-100" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">Заявка принята на проверку</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Администраторы получили запрос. После решения здесь появится итоговый статус и откроются
                      возможности подтверждённого партнёра.
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-100/75">
                      {application.status === "REVIEWING" ? "Проверяется" : "Отправлена"} {shortDate(application.createdAt)}
                      {" · "}
                      {application.identityVerificationMode === "FULL" ? "полная проверка" : "тестовый доступ"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isVerified && !hasOpenApplication && (
            <Card className="overflow-hidden border-cyan-200/20 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.2),transparent_46%),radial-gradient(circle_at_100%_50%,rgba(16,185,129,0.14),transparent_38%),rgba(255,255,255,0.025)] py-0">
              <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <span className="mt-1 h-fit rounded-2xl border border-cyan-100/30 bg-cyan-100/10 p-3 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                    <Sparkles className="h-6 w-6 text-cyan-100" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Следующий шаг</p>
                    <h2 className="mt-2 text-xl font-semibold">Верифицируйте компанию</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      Отправьте защищённую заявку, чтобы команда NearLoy могла подтвердить бизнес. Полная проверка
                      нужна для выпуска подписок и выплат.
                    </p>
                    {application?.status === "REJECTED" && (
                      <p className="mt-3 text-sm text-amber-100">Предыдущая заявка отклонена. Можно подать новую после исправлений.</p>
                    )}
                    {application?.status === "APPROVED" && !isVerified && (
                      <p className="mt-3 text-sm text-emerald-100">
                        Тестовый доступ одобрен. Для подписок и выплат завершите полную проверку.
                      </p>
                    )}
                  </div>
                </div>
                {canSubmit ? (
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 rounded-xl bg-white px-6 text-slate-950 shadow-[0_0_32px_rgba(255,255,255,0.2)] hover:bg-cyan-50"
                    onClick={() => setShowApplication((value) => !value)}
                  >
                    <ShieldCheck />
                    {showApplication ? "Скрыть форму" : "Начать верификацию"}
                  </Button>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
                    Заявку может отправить владелец компании.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {showApplication && canSubmit && (
            <Card className="overflow-hidden border-cyan-200/20 bg-white/[0.025] py-0">
              <CardContent className="p-6">
                <div className="mb-6 flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-5 w-5 text-cyan-100" />
                  <div>
                    <h2 className="text-xl font-semibold">Заявка на проверку партнёра</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Паспортные данные и фотография защищаются шифрованием. Фотография удаляется после одобрения
                      или отказа заявки.
                    </p>
                  </div>
                </div>
                <form className="space-y-5" onSubmit={submitVerification}>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">Тип занятости</span>
                      <OptionSelect
                        name="employmentType"
                        required
                        value={employmentType}
                        onChange={setEmploymentType}
                        placeholder="Выберите тип"
                        options={[
                          { value: "SELF_EMPLOYED", label: "Самозанятый", icon: Building2 },
                          { value: "INDIVIDUAL_ENTREPRENEUR", label: "Индивидуальный предприниматель", icon: Landmark },
                        ]}
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="font-medium">Сфера бизнеса</span>
                      <Input
                        name="businessCategory"
                        required
                        maxLength={120}
                        placeholder="Например, кофейня или фитнес"
                        className="h-12 rounded-xl border-white/12 bg-black/25"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-medium">Данные владельца по документам</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Input name="legalLastName" required maxLength={80} placeholder="Фамилия" className="h-12 rounded-xl border-white/12 bg-black/25" />
                      <Input name="legalFirstName" required maxLength={80} placeholder="Имя" className="h-12 rounded-xl border-white/12 bg-black/25" />
                      <Input name="legalMiddleName" maxLength={80} placeholder="Отчество, если есть" className="h-12 rounded-xl border-white/12 bg-black/25" />
                      <Input name="birthDate" required type="date" max={latestBirthDate} className="h-12 rounded-xl border-white/12 bg-black/25 [color-scheme:dark]" />
                    </div>
                  </div>

                  <label className="block space-y-2 text-sm">
                    <span className="font-medium">ИНН</span>
                    <Input
                      name="legalInn"
                      required
                      inputMode="numeric"
                      minLength={10}
                      maxLength={12}
                      pattern="\d{10}|\d{12}"
                      onInput={(event) => digitsOnly(event, 12)}
                      placeholder="10 или 12 цифр"
                      className="h-12 max-w-sm rounded-xl border-white/12 bg-black/25"
                    />
                  </label>

                  <div className="space-y-4 rounded-2xl border border-white/10 bg-black/15 p-4">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <FileCheck2 className="h-4 w-4 text-cyan-100" /> Паспортные данные для ручной проверки
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Input name="passportSeries" required inputMode="numeric" minLength={4} maxLength={4} pattern="\d{4}" onInput={(event) => digitsOnly(event, 4)} placeholder="Серия" className="h-12 rounded-xl border-white/12 bg-black/25" />
                        <Input name="passportNumber" required inputMode="numeric" minLength={6} maxLength={6} pattern="\d{6}" onInput={(event) => digitsOnly(event, 6)} placeholder="Номер" className="h-12 rounded-xl border-white/12 bg-black/25" />
                        <Input name="passportIssuedAt" required type="date" max={new Date().toISOString().slice(0, 10)} className="h-12 rounded-xl border-white/12 bg-black/25 [color-scheme:dark]" />
                        <Input name="passportDepartmentCode" inputMode="numeric" minLength={6} maxLength={6} pattern="\d{6}" onInput={(event) => digitsOnly(event, 6)} placeholder="Код подразделения" className="h-12 rounded-xl border-white/12 bg-black/25" />
                      </div>
                      <Textarea name="passportIssuedBy" required maxLength={240} placeholder="Кем выдан паспорт" className="min-h-24 rounded-xl border-white/12 bg-black/25" />
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-cyan-100/25 bg-cyan-100/[0.035] p-6 text-center hover:bg-cyan-100/[0.06]">
                        <UploadCloud className="h-7 w-7 text-cyan-100" />
                        <span className="font-medium">Фото паспорта</span>
                        <span className="text-sm text-muted-foreground">{photoName || "JPG, PNG, WEBP или HEIC до 8 МБ"}</span>
                        <input
                          type="file"
                          name="passportPhoto"
                          required
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                          className="sr-only"
                          onChange={(event) => setPhotoName(event.currentTarget.files?.[0]?.name || "")}
                        />
                      </label>
                  </div>

                  <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-muted-foreground">
                    <input type="checkbox" name="consentAccepted" required className="mt-1 accent-cyan-100" />
                    <span>
                      Я подтверждаю достоверность сведений и согласен на обработку данных для проверки партнёра
                      NearLoy.
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="h-11 rounded-xl bg-white px-6 text-slate-950 hover:bg-cyan-50"
                    >
                      <Send /> {submitting ? "Отправляем..." : "Отправить на проверку"}
                    </Button>
                    <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={() => setShowApplication(false)}>
                      Отмена
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <section className="grid gap-3 md:grid-cols-3">
            <Card className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <ShieldCheck className="mb-3 h-5 w-5 text-cyan-100" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Ваша роль</p>
                <p className="mt-2 text-lg font-semibold">{profile.member.role}</p>
              </CardContent>
            </Card>
            <Card className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <Globe2 className="mb-3 h-5 w-5 text-cyan-100" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Формат</p>
                <p className="mt-2 text-lg font-semibold">{profile.company.operatesOnline ? "Онлайн" : "Физические точки"}</p>
              </CardContent>
            </Card>
            <Card className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <Tags className="mb-3 h-5 w-5 text-cyan-100" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Категории</p>
                <p className="mt-2 text-lg font-semibold">{profile.company.categories.map((category) => categoryName(category, t)).join(", ") || "Не заданы"}</p>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
