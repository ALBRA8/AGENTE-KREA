-- CreateTable
CREATE TABLE "ProductOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "alternatives" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EVALUATING',
    "fitScore" TEXT,
    "decision" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductDossier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "version" INTEGER NOT NULL DEFAULT 1,
    "architecture" TEXT,
    "specification" TEXT,
    "economics" TEXT,
    "handoffId" TEXT,
    "artifacts" TEXT,
    "timeline" TEXT,
    "parentDossierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Handoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dossierId" TEXT NOT NULL,
    "sourceAgent" TEXT NOT NULL DEFAULT 'KREA',
    "targetProvider" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "specification" TEXT,
    "constraints" TEXT,
    "acceptanceCriteria" TEXT,
    "dependencies" TEXT,
    "evidence" TEXT,
    "risk" TEXT,
    "autonomy" TEXT NOT NULL DEFAULT 'SUPERVISED',
    "approvals" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "externalSendStatus" TEXT DEFAULT 'NOT_VERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductDossier_opportunityId_key" ON "ProductDossier"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Handoff_dossierId_key" ON "Handoff"("dossierId");

-- AddForeignKey
ALTER TABLE "ProductOpportunity" ADD CONSTRAINT "ProductOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDossier" ADD CONSTRAINT "ProductDossier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDossier" ADD CONSTRAINT "ProductDossier_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ProductOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handoff" ADD CONSTRAINT "Handoff_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ProductDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
