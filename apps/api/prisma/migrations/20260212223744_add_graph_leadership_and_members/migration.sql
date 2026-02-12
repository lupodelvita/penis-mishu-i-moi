/*
  Warnings:

  - You are about to drop the column `userId` on the `Graph` table. All the data in the column will be lost.
  - Added the required column `ownerId` to the `Graph` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GraphMemberRole" AS ENUM ('LEADER', 'MEMBER');

-- DropForeignKey
ALTER TABLE "Graph" DROP CONSTRAINT "Graph_userId_fkey";

-- AlterTable
ALTER TABLE "Graph" DROP COLUMN "userId",
ADD COLUMN     "leaderId" TEXT,
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "GraphMember" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GraphMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraphMember_graphId_userId_key" ON "GraphMember"("graphId", "userId");

-- AddForeignKey
ALTER TABLE "Graph" ADD CONSTRAINT "Graph_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Graph" ADD CONSTRAINT "Graph_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMember" ADD CONSTRAINT "GraphMember_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "Graph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphMember" ADD CONSTRAINT "GraphMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
