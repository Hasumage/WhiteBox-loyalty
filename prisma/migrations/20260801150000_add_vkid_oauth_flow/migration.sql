CREATE TABLE "OAuthState" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "redirectAfter" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthLoginTicket" (
  "id" TEXT NOT NULL,
  "ticketHash" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "redirectAfter" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OAuthLoginTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");
CREATE INDEX "OAuthState_provider_expiresAt_idx" ON "OAuthState"("provider", "expiresAt");

CREATE UNIQUE INDEX "OAuthLoginTicket_ticketHash_key" ON "OAuthLoginTicket"("ticketHash");
CREATE INDEX "OAuthLoginTicket_userId_idx" ON "OAuthLoginTicket"("userId");
CREATE INDEX "OAuthLoginTicket_provider_expiresAt_idx" ON "OAuthLoginTicket"("provider", "expiresAt");

ALTER TABLE "OAuthLoginTicket"
  ADD CONSTRAINT "OAuthLoginTicket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
