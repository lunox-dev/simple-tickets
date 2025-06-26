/*
  Warnings:

  - A unique constraint covering the columns `[ticketThreadId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ticketChangeAssignmentId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ticketChangePriorityId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ticketChangeStatusId]` on the table `NotificationEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_ticketThreadId_key" ON "NotificationEvent"("ticketThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_ticketChangeAssignmentId_key" ON "NotificationEvent"("ticketChangeAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_ticketChangePriorityId_key" ON "NotificationEvent"("ticketChangePriorityId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_ticketChangeStatusId_key" ON "NotificationEvent"("ticketChangeStatusId");

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_ticketThreadId_fkey" FOREIGN KEY ("ticketThreadId") REFERENCES "TicketThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_ticketChangeAssignmentId_fkey" FOREIGN KEY ("ticketChangeAssignmentId") REFERENCES "TicketChangeAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_ticketChangePriorityId_fkey" FOREIGN KEY ("ticketChangePriorityId") REFERENCES "TicketChangePriority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_ticketChangeStatusId_fkey" FOREIGN KEY ("ticketChangeStatusId") REFERENCES "TicketChangeStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
