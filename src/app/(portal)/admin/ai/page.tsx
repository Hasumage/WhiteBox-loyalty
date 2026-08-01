"use client";

import { type ClipboardEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Send,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  adminApplyAiAction,
  adminAskAi,
  type AdminAiChatMessage,
  type AdminAiPendingAction,
  type AdminAiTable,
} from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

type ChatMessage = AdminAiChatMessage & {
  id: string;
  attachmentPreview?: string;
  table?: AdminAiTable;
  pendingAction?: AdminAiPendingAction | null;
};

const IMAGE_MAX_SIDE = 768;
const IMAGE_QUALITY = 0.72;
const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;

function newId() {
  return crypto.randomUUID();
}

function visibleHistory(messages: ChatMessage[]): AdminAiChatMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content })).slice(-12);
}

function resizePromptTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  const maxHeight = 136;
  element.style.height = "auto";
  const nextHeight = Math.min(element.scrollHeight, maxHeight);
  element.style.height = `${nextHeight}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

function dataUrlFromFile(file: File, maxSide = IMAGE_MAX_SIDE, quality = IMAGE_QUALITY) {
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
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function ActionCard({
  action,
  onApply,
  applying,
}: {
  action: AdminAiPendingAction;
  onApply: (action: AdminAiPendingAction) => void;
  applying: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/8 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">Предлагаю действие</p>
          <h3 className="mt-2 text-base font-semibold">{action.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
        </div>
        <Button onClick={() => onApply(action)} disabled={applying} className="shrink-0">
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Подтвердить
        </Button>
      </div>
    </div>
  );
}

function AiTable({ table }: { table: AdminAiTable }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="font-semibold">{table.title}</p>
        {table.summary ? <p className="mt-1 text-xs text-muted-foreground">{table.summary}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-white/[0.035] text-muted-foreground">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  className={cn("px-4 py-2 font-medium", column.align === "right" && "text-right")}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-t border-white/10">
                {table.columns.map((column) => {
                  const value = row[column.key];
                  const text = value === null || value === undefined || value === "" ? "—" : String(value);
                  const isLink = typeof value === "string" && value.startsWith("/");
                  return (
                    <td
                      key={column.key}
                      className={cn("max-w-[260px] px-4 py-3 align-top", column.align === "right" && "text-right")}
                    >
                      {isLink ? (
                        <a href={value} className="font-medium text-cyan-100 underline-offset-4 hover:underline">
                          открыть
                        </a>
                      ) : (
                        <span className="line-clamp-2">{text}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.totalRows && table.totalRows > table.rows.length ? (
        <p className="border-t border-white/10 px-4 py-2 text-xs text-muted-foreground">
          Показаны первые {table.rows.length} из {table.totalRows}.
        </p>
      ) : null}
    </div>
  );
}

export default function AdminAiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const canSend = (input.trim().length > 0 || Boolean(imageFile)) && !loading;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    resizePromptTextarea(inputRef.current);
  }, [input]);

  async function attachImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Можно прикрепить только изображение.");
      return;
    }
    if (file.size > MAX_IMAGE_FILE_SIZE) {
      setError("Картинка слишком тяжёлая. Максимум 8 МБ до сжатия.");
      return;
    }
    try {
      const preview = await dataUrlFromFile(file, 512, 0.78);
      setImageFile(file);
      setImagePreview(preview);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось подготовить изображение.");
    }
  }

  function clearAttachment() {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));
    const file = imageItem?.getAsFile();
    if (!file) return;
    event.preventDefault();
    void attachImage(file);
  }

  async function sendMessage(value = input) {
    const text = value.trim();
    const attachedFile = imageFile;
    const attachedPreview = imagePreview;
    if ((!text && !attachedFile) || loading) return;

    const userMessage: ChatMessage = {
      id: newId(),
      role: "user",
      content: text || "Прикрепил изображение.",
      attachmentPreview: attachedPreview || undefined,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    clearAttachment();
    setLoading(true);
    setError(null);

    let imageDataUrl: string | undefined;
    try {
      imageDataUrl = attachedFile ? await dataUrlFromFile(attachedFile) : undefined;
    } catch (error) {
      setLoading(false);
      setError(error instanceof Error ? error.message : "Не удалось подготовить изображение.");
      return;
    }

    const res = await adminAskAi({
      message: text || "Проанализируй прикреплённое изображение.",
      messages: visibleHistory(nextMessages),
      imageDataUrl,
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.message);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content:
            "Помощник сейчас не ответил. Попробуйте ещё раз через минуту или уточните запрос.",
        },
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "assistant",
        content: res.data.reply,
        table: res.data.table,
        pendingAction: res.data.pendingAction ?? null,
      },
    ]);
  }

  async function applyAction(messageId: string, action: AdminAiPendingAction) {
    setApplyingId(messageId);
    setError(null);
    const res = await adminApplyAiAction(action);
    setApplyingId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMessages((current) => [
      ...current.map((message) => (message.id === messageId ? { ...message, pendingAction: null } : message)),
      { id: newId(), role: "assistant", content: res.data.reply },
    ]);
  }

  return (
    <main className="flex h-[calc(100dvh-6.25rem)] min-h-0 flex-col overflow-hidden px-0 py-0 md:h-[calc(100dvh-1px)] md:px-8 md:py-4">
      <Card className="glass min-h-0 flex-1 overflow-hidden border-white/10">
        <CardContent className="flex h-full min-h-0 flex-col p-0">
          {error ? (
            <div className="mx-4 mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto p-4 [scrollbar-width:none] md:p-6 [&::-webkit-scrollbar]:hidden"
          >
            {messages.length === 0 && !loading ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-2xl font-semibold tracking-tight text-white/45 sm:text-3xl">
                Чем займёмся?
              </div>
            ) : null}
            <div className="space-y-5">
              {messages.map((message) => {
                const assistant = message.role === "assistant";
                return (
                  <div key={message.id} className={cn("flex gap-3", assistant ? "justify-start" : "justify-end")}>
                    {assistant ? (
                      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                        <Bot className="h-4 w-4" />
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[min(900px,82%)] whitespace-pre-line rounded-[24px] border px-5 py-4 text-sm leading-7",
                        assistant
                          ? "border-white/10 bg-white/[0.035]"
                          : "border-cyan-300/25 bg-cyan-300/10 text-cyan-50",
                      )}
                    >
                      {!assistant ? (
                        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-cyan-100">
                          <User className="h-3.5 w-3.5" />
                          Вы
                        </div>
                      ) : null}
                      {message.content}
                      {message.table ? <AiTable table={message.table} /> : null}
                      {message.attachmentPreview ? (
                        <img
                          src={message.attachmentPreview}
                          alt="Прикреплённое изображение"
                          className="mt-3 max-h-72 w-full rounded-2xl border border-white/10 object-cover"
                        />
                      ) : null}
                      {message.pendingAction ? (
                        <ActionCard
                          action={message.pendingAction}
                          applying={applyingId === message.id}
                          onApply={(action) => void applyAction(message.id, action)}
                        />
                      ) : null}
                    </div>
                    {!assistant ? (
                      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground">
                        <User className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {loading ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                    <Bot className="h-4 w-4" />
                  </span>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Думаю и проверяю контекст…
                </div>
              ) : null}
            </div>
          </div>

          <form
            className="shrink-0 border-t border-white/10 p-3 md:p-4"
            onPaste={handlePaste}
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            {imagePreview ? (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-2">
                <img
                  src={imagePreview}
                  alt="Изображение к сообщению"
                  className="h-14 w-20 shrink-0 rounded-xl border border-white/10 object-cover"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{imageFile?.name ?? "Изображение"}</p>
                  <p className="text-muted-foreground">Прикреплено к следующему сообщению</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={clearAttachment}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void attachImage(file);
                }}
              />
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(event) => {
                  const nextValue = event.target.value.slice(0, 1500);
                  setInput(nextValue);
                  resizePromptTextarea(event.currentTarget);
                }}
                placeholder="Введите ваш запрос"
                rows={1}
                className="max-h-[136px] min-h-[38px] resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 shadow-none outline-none transition-[height] duration-75 ease-out placeholder:text-sm focus-visible:ring-0"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 min-w-10 rounded-2xl px-3"
                  title="Прикрепить изображение"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
                <Button type="submit" size="lg" disabled={!canSend} className="h-10 min-w-10 rounded-2xl px-3">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
