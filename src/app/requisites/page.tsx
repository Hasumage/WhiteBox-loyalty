import type { Metadata } from "next";
import { Building2, CheckCircle2, FileText, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Реквизиты NearLoy",
  description: "Служебная страница с реквизитами проекта NearLoy.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const requisites = [
  { label: "Проект", value: "NearLoy" },
  { label: "ИНН владельца проекта", value: "773180285802" },
  { label: "Назначение", value: "Документы, договорённости и идентификация получателя" },
  { label: "Статус", value: "Базовые реквизиты" },
];

export default function RequisitesPage() {
  return (
    <main className="min-h-screen bg-[#050708] px-5 py-10 text-white">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(5,7,8,0.96))] p-7 shadow-[0_24px_90px_rgba(0,0,0,0.45)] md:p-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.22em] text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Реквизиты
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">Реквизиты NearLoy</h1>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.78fr]">
          <section className="rounded-[1.75rem] border border-white/10 bg-[#0d1117] p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black">Базовые данные</h2>
                <p className="text-sm text-white/52">Для документов и идентификации проекта.</p>
              </div>
            </div>

            <dl className="grid gap-3">
              {requisites.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 md:grid md:grid-cols-[220px_1fr] md:items-center"
                >
                  <dt className="text-sm font-semibold uppercase tracking-[0.18em] text-white/46">
                    {item.label}
                  </dt>
                  <dd className="mt-2 text-lg font-bold text-white md:mt-0">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="rounded-[1.75rem] border border-cyan-300/18 bg-cyan-300/[0.06] p-6 md:p-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <FileText className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black">Дополнительные реквизиты</h2>
            <p className="mt-4 leading-7 text-white/64">
              Платёжные данные, документы и условия предоставляются отдельно в рамках
              конкретной договорённости или договора.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
              Обновлено: 24.07.2026
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
