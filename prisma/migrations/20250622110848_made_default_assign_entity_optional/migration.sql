-- DropForeignKey
ALTER TABLE "TicketCategory" DROP CONSTRAINT "TicketCategory_defaultAssignEntityId_fkey";

-- AlterTable
ALTER TABLE "TicketCategory" ALTER COLUMN "defaultAssignEntityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_defaultAssignEntityId_fkey" FOREIGN KEY ("defaultAssignEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
