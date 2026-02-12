-- CreateTable
CREATE TABLE "GraphCommand" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GraphCommand_graphId_idx" ON "GraphCommand"("graphId");

-- CreateIndex
CREATE INDEX "GraphCommand_timestamp_idx" ON "GraphCommand"("timestamp");

-- AddForeignKey
ALTER TABLE "GraphCommand" ADD CONSTRAINT "GraphCommand_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "Graph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
