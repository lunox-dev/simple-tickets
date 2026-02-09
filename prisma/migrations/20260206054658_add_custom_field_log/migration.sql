/*
  Warnings:

  - A unique constraint covering the columns `[onCustomFieldChangeId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TICKET_CUSTOM_FIELD_CHANGED';

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN     "onCustomFieldChangeId" INTEGER;

-- CreateTable
CREATE TABLE "TicketChangeCustomField" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "ticketFieldDefinitionId" INTEGER NOT NULL,
    "valueFrom" TEXT,
    "valueTo" TEXT,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketChangeCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_onCustomFieldChangeId_key" ON "NotificationEvent"("onCustomFieldChangeId");

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_onCustomFieldChangeId_fkey" FOREIGN KEY ("onCustomFieldChangeId") REFERENCES "TicketChangeCustomField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCustomField" ADD CONSTRAINT "TicketChangeCustomField_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCustomField" ADD CONSTRAINT "TicketChangeCustomField_ticketFieldDefinitionId_fkey" FOREIGN KEY ("ticketFieldDefinitionId") REFERENCES "TicketFieldDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChangeCustomField" ADD CONSTRAINT "TicketChangeCustomField_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
