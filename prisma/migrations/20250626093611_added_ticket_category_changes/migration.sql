/*
  Warnings:

  - The values [NEW_THREAD,STATUS_CHANGE,PRIORITY_CHANGE,ASSIGN_CHANGE] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `NotificationEvent` table. All the data in the column will be lost.
  - You are about to drop the column `ticketChangeAssignmentId` on the `NotificationEvent` table. All the data in the column will be lost.
  - You are about to drop the column `ticketChangePriorityId` on the `NotificationEvent` table. All the data in the column will be lost.
  - You are about to drop the column `ticketChangeStatusId` on the `NotificationEvent` table. All the data in the column will be lost.
  - You are about to drop the column `ticketThreadId` on the `NotificationEvent` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `TicketCategory` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `TicketCategory` table. All the data in the column will be lost.
  - You are about to drop the column `ticketCategoryId` on the `TicketChangeAssignment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[onAssignmentChangeId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[onPriorityChangeId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[onStatusChangeId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[onCategoryChangeId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[onThreadId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `currentCategoryId` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('TICKET_ASSIGNMENT_CHANGED', 'TICKET_PRIORITY_CHANGED', 'TICKET_STATUS_CHANGED', 'TICKET_CATEGORY_CHANGED', 'TICKET_THREAD_NEW', 'USER_ADDED_TO_TEAM');
ALTER TABLE "NotificationEvent" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_ticketChangeAssignmentId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_ticketChangePriorityId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_ticketChangeStatusId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationEvent" DROP CONSTRAINT "NotificationEvent_ticketThreadId_fkey";

-- DropForeignKey
ALTER TABLE "TicketChangeAssignment" DROP CONSTRAINT "TicketChangeAssignment_assignedFromId_fkey";

-- DropForeignKey
ALTER TABLE "TicketChangeAssignment" DROP CONSTRAINT "TicketChangeAssignment_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "TicketChangeAssignment" DROP CONSTRAINT "TicketChangeAssignment_ticketCategoryId_fkey";

-- DropIndex
DROP INDEX "NotificationEvent_ticketChangeAssignmentId_key";

-- DropIndex
DROP INDEX "NotificationEvent_ticketChangePriorityId_key";

-- DropIndex
DROP INDEX "NotificationEvent_ticketChangeStatusId_key";

-- DropIndex
DROP INDEX "NotificationEvent_ticketThreadId_key";

-- DropIndex
DROP INDEX "NotificationEvent_type_createdAt_idx";

-- AlterTable
ALTER TABLE "NotificationEvent" DROP COLUMN "createdAt",
DROP COLUMN "ticketChangeAssignmentId",
DROP COLUMN "ticketChangePriorityId",
DROP COLUMN "ticketChangeStatusId",
DROP COLUMN "ticketThreadId",
ADD COLUMN     "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onAssignmentChangeId" INTEGER,
ADD COLUMN     "onCategoryChangeId" INTEGER,
ADD COLUMN     "onPriorityChangeId" INTEGER,
ADD COLUMN     "onStatusChangeId" INTEGER,
ADD COLUMN     "onThreadId" INTEGER;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "currentCategoryId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TicketCategory" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "TicketChangeAssignment" DROP COLUMN "ticketCategoryId",
ALTER COLUMN "assignedFromId" DROP NOT NULL,
ALTER COLUMN "assignedToId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TicketChangeCategory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "categoryFromId" INTEGER NOT NULL,
    "categoryToId" INTEGER NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketChangeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_onAssignmentChangeId_key" ON "NotificationEvent"("onAssignmentChangeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_onPriorityChangeId_key" ON "NotificationEvent"("onPriorityChangeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_onStatusChangeId_key" ON "NotificationEvent"("onStatusChangeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_onCategoryChangeId_key" ON "NotificationEvent"("onCategoryChangeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_onThreadId_key" ON "NotificationEvent"("onThreadId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_currentCategoryId_fkey" FOREIGN KEY ("currentCategoryId") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeAssignment" ADD CONSTRAINT "TicketChangeAssignment_assignedFromId_fkey" FOREIGN KEY ("assignedFromId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeAssignment" ADD CONSTRAINT "TicketChangeAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_onAssignmentChangeId_fkey" FOREIGN KEY ("onAssignmentChangeId") REFERENCES "TicketChangeAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_onPriorityChangeId_fkey" FOREIGN KEY ("onPriorityChangeId") REFERENCES "TicketChangePriority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_onStatusChangeId_fkey" FOREIGN KEY ("onStatusChangeId") REFERENCES "TicketChangeStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_onCategoryChangeId_fkey" FOREIGN KEY ("onCategoryChangeId") REFERENCES "TicketChangeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_onThreadId_fkey" FOREIGN KEY ("onThreadId") REFERENCES "TicketThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCategory" ADD CONSTRAINT "TicketChangeCategory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCategory" ADD CONSTRAINT "TicketChangeCategory_categoryFromId_fkey" FOREIGN KEY ("categoryFromId") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCategory" ADD CONSTRAINT "TicketChangeCategory_categoryToId_fkey" FOREIGN KEY ("categoryToId") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCategory" ADD CONSTRAINT "TicketChangeCategory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
