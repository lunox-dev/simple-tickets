/*
  Warnings:

  - You are about to drop the column `email` on the `EmailOTP` table. All the data in the column will be lost.
  - You are about to drop the column `used` on the `EmailOTP` table. All the data in the column will be lost.
  - Added the required column `Active` to the `Team` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Active` to the `UserTeam` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EmailOTP_email_idx";

-- AlterTable
ALTER TABLE "EmailOTP" DROP COLUMN "email",
DROP COLUMN "used",
ADD COLUMN     "UsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "Active" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "UserTeam" ADD COLUMN     "Active" BOOLEAN NOT NULL;
