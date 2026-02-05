-- DropForeignKey
ALTER TABLE "TicketFieldDefinition" DROP CONSTRAINT "TicketFieldDefinition_applicableCategoryId_fkey";

-- AlterTable
ALTER TABLE "TicketFieldDefinition" ADD COLUMN     "activeInCreate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "activeInRead" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "apiConfig" JSONB,
ADD COLUMN     "key" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "multiSelect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketFieldGroupId" INTEGER,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'TEXT',
ALTER COLUMN "applicableCategoryId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TicketFieldGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketFieldGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketFieldGroupCategory" (
    "ticketFieldGroupId" INTEGER NOT NULL,
    "ticketCategoryId" INTEGER NOT NULL,

    CONSTRAINT "TicketFieldGroupCategory_pkey" PRIMARY KEY ("ticketFieldGroupId","ticketCategoryId")
);

-- AddForeignKey
ALTER TABLE "TicketFieldDefinition" ADD CONSTRAINT "TicketFieldDefinition_applicableCategoryId_fkey" FOREIGN KEY ("applicableCategoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFieldDefinition" ADD CONSTRAINT "TicketFieldDefinition_ticketFieldGroupId_fkey" FOREIGN KEY ("ticketFieldGroupId") REFERENCES "TicketFieldGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFieldGroupCategory" ADD CONSTRAINT "TicketFieldGroupCategory_ticketFieldGroupId_fkey" FOREIGN KEY ("ticketFieldGroupId") REFERENCES "TicketFieldGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketFieldGroupCategory" ADD CONSTRAINT "TicketFieldGroupCategory_ticketCategoryId_fkey" FOREIGN KEY ("ticketCategoryId") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
