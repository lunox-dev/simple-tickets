/*
  Warnings:

  - You are about to drop the column `actionEntityId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_actionEntityId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "actionEntityId",
ADD COLUMN     "actionUserTeamId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_actionUserTeamId_fkey" FOREIGN KEY ("actionUserTeamId") REFERENCES "UserTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
