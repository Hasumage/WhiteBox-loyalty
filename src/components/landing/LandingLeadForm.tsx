"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LandingLeadFormProps = {
  source: "user_landing" | "business_landing";
  title?: string;
  note?: string;
};

export function LandingLeadForm({
  source,
  title = "Запустим пилот",
  note = "Оставьте контакт, и мы обсудим подходящий сценарий подключения WhiteBox.",
}: LandingLeadFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const contactSubject = useMemo(() => encodeURIComponent("WhiteBox pilot request"), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/landing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Не удалось отправить заявку. Попробуйте ещё раз.");

      form.reset();
      setFormStartedAt(Date.now());
      setStatus("sent");
      setMessage(result?.message || "Заявка получена. Мы получили уведомление и вернёмся с ответом.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Не удалось отправить заявку.");
    }
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_0_44px_rgba(255,255,255,0.06)] backdrop-blur sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/20 bg-cyan-100/10 text-cyan-100">
          <Mail className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-2xl font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/58">{note}</p>
        </div>
      </div>

      <form id="contact" onSubmit={handleSubmit} className="mt-6 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="startedAt" value={formStartedAt} />
        <input className="hidden" name="_gotcha" tabIndex={-1} autoComplete="off" />
        <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />
        <Input name="name" required minLength={2} maxLength={80} className="rounded-2xl border-white/12 bg-black/28 text-white placeholder:text-white/36" placeholder="Имя" />
        <Input name="company" maxLength={120} className="rounded-2xl border-white/12 bg-black/28 text-white placeholder:text-white/36" placeholder="Компания" />
        <Input name="contact" required minLength={5} maxLength={120} className="rounded-2xl border-white/12 bg-black/28 text-white placeholder:text-white/36" placeholder="Email или Telegram" />
        <Input name="business" maxLength={120} className="rounded-2xl border-white/12 bg-black/28 text-white placeholder:text-white/36" placeholder="Сфера или город" />
        <Textarea name="message" required minLength={10} maxLength={1200} className="min-h-36 rounded-3xl border-white/12 bg-black/28 text-white placeholder:text-white/36 sm:col-span-2" placeholder="Что хотите проверить в пилоте?" />

        {status !== "idle" && (
          <div className={cn("rounded-3xl border px-4 py-3 text-sm font-medium sm:col-span-2", status === "sent" ? "border-emerald-200/24 bg-emerald-300/10 text-white" : "border-red-400/30 bg-red-500/10 text-red-100")}>
            {message}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <a href={`mailto:maksimpastuhov77@gmail.com?subject=${contactSubject}`} className="text-sm font-semibold text-white/64 transition hover:text-white">
            maksimpastuhov77@gmail.com
          </a>
          <Button disabled={status === "sending"} className="h-12 rounded-2xl bg-white px-6 text-[#07101e] hover:bg-white/88">
            {status === "sending" ? "Отправляем..." : "Отправить заявку"}
            {status === "sending" ? null : <Send className="h-4 w-4" />}
            {status === "sending" ? null : <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
