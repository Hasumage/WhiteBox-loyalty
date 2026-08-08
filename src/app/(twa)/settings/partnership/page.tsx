"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, Handshake, Mail, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

const benefits = [
  "client.partnership.benefit1",
  "client.partnership.benefit2",
  "client.partnership.benefit3",
] as const;

export default function PartnershipPage() {
  const { t } = useI18n("ru");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const contactSubject = useMemo(() => encodeURIComponent("NearLoy partnership request"), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const rawMessage = String(payload.message ?? "").trim();

    try {
      const response = await fetch("/api/landing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          message: `[Партнерство из профиля]\n${rawMessage}`,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Не удалось отправить заявку. Попробуйте еще раз.");

      form.reset();
      setFormStartedAt(Date.now());
      setStatus("sent");
      setMessage("Заявка отправлена. Мы получили контакт и вернемся с ответом.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  return (
    <article className="mx-auto max-w-lg pb-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.partnership.title")}</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {t("client.partnership.subtitle")}
      </p>
      <section className="glass rounded-xl border border-white/10 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">{t("client.partnership.why")}</p>
        </div>
        <ul className="space-y-2">
          {benefits.map((item) => (
            <li key={item} className="text-muted-foreground flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="glass mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-xl border border-cyan-200/20 bg-cyan-200/10 p-2 text-cyan-100">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">{t("client.partnership.request")}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Расскажите, какую механику хотите запустить: совместную акцию, бонусы, партнерскую сеть или пилот для бизнеса.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <input type="hidden" name="startedAt" value={formStartedAt} />
          <input className="hidden" name="_gotcha" tabIndex={-1} autoComplete="off" />
          <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="name" required minLength={2} maxLength={80} placeholder="Ваше имя" className="h-12 rounded-xl" />
            <Input name="company" maxLength={120} placeholder="Компания или проект" className="h-12 rounded-xl" />
          </div>
          <Input name="contact" required minLength={5} maxLength={120} placeholder="Email или Telegram" className="h-12 rounded-xl" />
          <Input name="business" maxLength={120} placeholder="Сфера, город или аудитория" className="h-12 rounded-xl" />
          <Textarea
            name="message"
            required
            minLength={10}
            maxLength={1200}
            placeholder="Что хотите обсудить?"
            className="min-h-28 rounded-2xl"
          />

          {status !== "idle" && (
            <div className={cn("rounded-2xl border px-4 py-3 text-sm", status === "sent" ? "border-emerald-200/24 bg-emerald-300/10 text-emerald-50" : "border-red-400/30 bg-red-500/10 text-red-100")}>
              {message}
            </div>
          )}

          <div className="grid gap-3">
            <Button disabled={status === "sending"} className="h-12 rounded-xl">
              {status === "sending" ? "Отправляем..." : "Отправить заявку"}
              {status === "sending" ? null : <Send className="h-4 w-4" />}
              {status === "sending" ? null : <ArrowRight className="h-4 w-4" />}
            </Button>
            <a href={`mailto:nearloyalty@gmail.com?subject=${contactSubject}`} className="text-center text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              nearloyalty@gmail.com
            </a>
          </div>
        </form>
      </section>
    </article>
  );
}
