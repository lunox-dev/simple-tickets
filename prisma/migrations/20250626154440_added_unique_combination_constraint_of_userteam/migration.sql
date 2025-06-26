/*
  Warnings:

  - A unique constraint covering the columns `[userId,teamId]` on the table `UserTeam` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "Active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "Active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "UserTeam" ALTER COLUMN "Active" SET DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "UserTeam_userId_teamId_key" ON "UserTeam"("userId", "teamId");
