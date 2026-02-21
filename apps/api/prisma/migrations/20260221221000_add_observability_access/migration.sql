-- CreateEnum
CREATE TYPE "ObservabilityScope" AS ENUM ('VIEW_DASHBOARDS', 'VIEW_ERRORS', 'MANAGE_ALERTS', 'RECEIVE_TELEGRAM_ALERTS', 'MANAGE_INTEGRATIONS');

-- CreateEnum
CREATE TYPE "ObservabilityInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ObservabilityAuditAction" AS ENUM ('INVITE_CREATED', 'INVITE_ACCEPTED', 'INVITE_REVOKED', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'TELEGRAM_CHAT_LINKED', 'TELEGRAM_CHAT_UNLINKED', 'SCOPES_UPDATED');

-- CreateTable
CREATE TABLE "ObservabilityInvite" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "ObservabilityInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedUserId" TEXT,
    "invitedUsername" TEXT,
    "invitedById" TEXT NOT NULL,
    "scopes" "ObservabilityScope"[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservabilityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservabilityAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "inviteId" TEXT,
    "scopes" "ObservabilityScope"[],
    "telegramChatId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservabilityAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservabilityAuditLog" (
    "id" TEXT NOT NULL,
    "action" "ObservabilityAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "subjectUserId" TEXT,
    "accessId" TEXT,
    "inviteId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservabilityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObservabilityInvite_tokenHash_key" ON "ObservabilityInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ObservabilityInvite_status_idx" ON "ObservabilityInvite"("status");

-- CreateIndex
CREATE INDEX "ObservabilityInvite_invitedUserId_idx" ON "ObservabilityInvite"("invitedUserId");

-- CreateIndex
CREATE INDEX "ObservabilityInvite_expiresAt_idx" ON "ObservabilityInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObservabilityAccess_userId_key" ON "ObservabilityAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservabilityAccess_inviteId_key" ON "ObservabilityAccess"("inviteId");

-- CreateIndex
CREATE INDEX "ObservabilityAccess_isActive_idx" ON "ObservabilityAccess"("isActive");

-- CreateIndex
CREATE INDEX "ObservabilityAccess_telegramChatId_idx" ON "ObservabilityAccess"("telegramChatId");

-- CreateIndex
CREATE INDEX "ObservabilityAccess_expiresAt_idx" ON "ObservabilityAccess"("expiresAt");

-- CreateIndex
CREATE INDEX "ObservabilityAuditLog_action_idx" ON "ObservabilityAuditLog"("action");

-- CreateIndex
CREATE INDEX "ObservabilityAuditLog_createdAt_idx" ON "ObservabilityAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ObservabilityAuditLog_actorUserId_idx" ON "ObservabilityAuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "ObservabilityAuditLog_subjectUserId_idx" ON "ObservabilityAuditLog"("subjectUserId");

-- AddForeignKey
ALTER TABLE "ObservabilityInvite" ADD CONSTRAINT "ObservabilityInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityInvite" ADD CONSTRAINT "ObservabilityInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAccess" ADD CONSTRAINT "ObservabilityAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAccess" ADD CONSTRAINT "ObservabilityAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAccess" ADD CONSTRAINT "ObservabilityAccess_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ObservabilityInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAuditLog" ADD CONSTRAINT "ObservabilityAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAuditLog" ADD CONSTRAINT "ObservabilityAuditLog_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAuditLog" ADD CONSTRAINT "ObservabilityAuditLog_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "ObservabilityAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityAuditLog" ADD CONSTRAINT "ObservabilityAuditLog_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ObservabilityInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
