ALTER TABLE "User" ADD COLUMN "maxId" TEXT;
CREATE UNIQUE INDEX "User_maxId_key" ON "User"("maxId");
