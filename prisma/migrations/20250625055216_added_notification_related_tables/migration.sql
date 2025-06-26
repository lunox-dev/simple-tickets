/*
  Warnings:

  - A unique constraint covering the columns `[teamId]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userTeamId]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[apiKeyId]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_THREAD', 'STATUS_CHANGE', 'PRIORITY_CHANGE', 'ASSIGN_CHANGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotificationPreferences" JSONB DEFAULT '{}',
ADD COLUMN     "smsNotificationPreferences" JSONB DEFAULT '{}';

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "ticketThreadId" INTEGER,
    "ticketChangeAssignmentId" INTEGER,
    "ticketChangePriorityId" INTEGER,
    "ticketChangeStatusId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emailNotified" BOOLEAN NOT NULL DEFAULT false,
    "smsNotified" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateIndex
CREATE INDEX "NotificationEvent_type_createdAt_idx" ON "NotificationEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_read_idx" ON "NotificationRecipient"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_teamId_key" ON "Entity"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_userTeamId_key" ON "Entity"("userTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_apiKeyId_key" ON "Entity"("apiKeyId");

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
