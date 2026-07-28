ALTER TABLE "UserProfilePreference"
ADD COLUMN IF NOT EXISTS "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "geoNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
