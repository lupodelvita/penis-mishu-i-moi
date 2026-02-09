/*
  Warnings:

  - You are about to drop the column `created` on the `Entity` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Entity` table without a default value. This is not possible if the table is not empty.
  - Made the column `properties` on table `Entity` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "created",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "noteAuthor" TEXT,
ADD COLUMN     "noteColor" TEXT DEFAULT '#FFEB3B',
ADD COLUMN     "noteDate" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "properties" SET NOT NULL;
