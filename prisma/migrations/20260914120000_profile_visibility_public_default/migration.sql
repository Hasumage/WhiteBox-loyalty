ALTER TABLE "UserProfilePreference" ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC';

UPDATE "UserProfilePreference"
SET "profileVisibility" = 'PUBLIC'
WHERE "profileVisibility" = 'PRIVATE';
