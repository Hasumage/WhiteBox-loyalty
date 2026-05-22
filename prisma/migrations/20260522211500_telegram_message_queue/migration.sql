CREATE TABLE "TelegramMessageQueue" (
  "id" TEXT NOT NULL,
  "recipientChatId" TEXT NOT NULL,
  "recipientRole" TEXT,
  "recipientLabel" TEXT,
  "text" TEXT NOT NULL,
  "parseMode" TEXT,
  "replyMarkup" JSONB,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "telegramMessageId" INTEGER,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "source" TEXT,
  "sourceId" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TelegramMessageQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramMessageQueue_status_nextRetryAt_idx" ON "TelegramMessageQueue"("status", "nextRetryAt");
CREATE INDEX "TelegramMessageQueue_source_sourceId_idx" ON "TelegramMessageQueue"("source", "sourceId");
CREATE INDEX "TelegramMessageQueue_recipientChatId_createdAt_idx" ON "TelegramMessageQueue"("recipientChatId", "createdAt");
