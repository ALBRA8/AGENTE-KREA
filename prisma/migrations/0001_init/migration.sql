-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 50,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CampaignEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "investment" REAL NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL DEFAULT 'krea',
    "userId" TEXT,
    "domain" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "sourceType" TEXT,
    "evidence" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "truthLevel" TEXT NOT NULL DEFAULT 'ESTIMATED',
    "relevance" REAL NOT NULL DEFAULT 1.0,
    "utility" REAL NOT NULL DEFAULT 0.5,
    "decay" REAL NOT NULL DEFAULT 0.0,
    "scope" TEXT NOT NULL DEFAULT 'agent',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastVerified" DATETIME,
    CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL DEFAULT 'krea',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "trigger" TEXT,
    "prerequisites" TEXT,
    "procedure" TEXT NOT NULL,
    "toolsRequired" TEXT,
    "expectedResult" TEXT,
    "verification" TEXT,
    "pitfalls" TEXT,
    "evidence" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "successRate" REAL NOT NULL DEFAULT 0.0,
    "origin" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL DEFAULT 'krea',
    "userId" TEXT,
    "task" TEXT NOT NULL,
    "toolsUsed" TEXT,
    "skillsUsed" TEXT,
    "inputs" TEXT,
    "outputs" TEXT,
    "errors" TEXT,
    "evidence" TEXT,
    "approvals" TEXT,
    "cost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Execution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL DEFAULT 'krea',
    "userId" TEXT,
    "executionId" TEXT,
    "input" TEXT,
    "result" TEXT,
    "feedbackType" TEXT NOT NULL,
    "feedbackText" TEXT,
    "analysis" TEXT,
    "learning" TEXT,
    "evidence" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentInteraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterAgent" TEXT NOT NULL,
    "targetAgent" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "input" TEXT,
    "constraints" TEXT,
    "requestedOutput" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "evidence" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "executionId" TEXT,
    "correlationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL DEFAULT 'krea',
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "details" TEXT,
    "result" TEXT,
    "evidence" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductDossier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductDossier_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ProductOpportunity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Handoff_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ProductDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommercialProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "productName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "targetCustomer" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "jobToBeDone" TEXT NOT NULL,
    "desiredOutcome" TEXT NOT NULL,
    "valueProposition" TEXT NOT NULL,
    "differentiation" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "includedAssets" TEXT NOT NULL DEFAULT '[]',
    "excludedScope" TEXT NOT NULL DEFAULT '[]',
    "priceStrategy" TEXT NOT NULL,
    "priceRange" TEXT NOT NULL,
    "monetizationModel" TEXT NOT NULL,
    "distributionStrategy" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "keyBenefits" TEXT NOT NULL DEFAULT '[]',
    "objections" TEXT NOT NULL DEFAULT '[]',
    "proofRequirements" TEXT NOT NULL DEFAULT '[]',
    "commercialReadiness" TEXT,
    "launchRequirements" TEXT NOT NULL DEFAULT '[]',
    "assumptions" TEXT NOT NULL DEFAULT '[]',
    "risks" TEXT NOT NULL DEFAULT '[]',
    "evidence" TEXT NOT NULL DEFAULT 'INFERRED',
    "provenance" TEXT NOT NULL DEFAULT 'product_brain',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommercialProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommercialProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductBlueprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "type" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "jobToBeDone" TEXT NOT NULL,
    "desiredOutcome" TEXT NOT NULL,
    "valueProposition" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "contentRequirements" TEXT NOT NULL DEFAULT '[]',
    "designRequirements" TEXT NOT NULL DEFAULT '[]',
    "assetRequirements" TEXT NOT NULL DEFAULT '[]',
    "commercialRequirements" TEXT NOT NULL DEFAULT '[]',
    "qualityRequirements" TEXT NOT NULL DEFAULT '[]',
    "deliveryRequirements" TEXT NOT NULL DEFAULT '[]',
    "successCriteria" TEXT NOT NULL DEFAULT '[]',
    "assumptions" TEXT NOT NULL DEFAULT '[]',
    "risks" TEXT NOT NULL DEFAULT '[]',
    "evidence" TEXT NOT NULL DEFAULT 'INFERRED',
    "provenance" TEXT NOT NULL DEFAULT 'product_brain',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductBlueprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductBlueprint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductDossier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "evidence" TEXT NOT NULL DEFAULT 'VERIFIED',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FactoryExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "factoryType" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "progress" TEXT NOT NULL DEFAULT '[]',
    "artifacts" TEXT NOT NULL DEFAULT '[]',
    "qaReport" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FactoryExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductVersionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "blueprintId" TEXT,
    "dossierId" TEXT,
    "executionId" TEXT,
    "assets" TEXT NOT NULL DEFAULT '[]',
    "qaPassed" BOOLEAN NOT NULL DEFAULT false,
    "changes" TEXT NOT NULL DEFAULT '',
    "feedback" TEXT NOT NULL DEFAULT '[]',
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductVersionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaunchPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "product" TEXT NOT NULL,
    "offer" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "targetCustomer" TEXT NOT NULL,
    "corePromise" TEXT NOT NULL,
    "benefits" TEXT NOT NULL DEFAULT '[]',
    "included" TEXT NOT NULL DEFAULT '[]',
    "bonuses" TEXT NOT NULL DEFAULT '[]',
    "price" TEXT NOT NULL,
    "delivery" TEXT NOT NULL,
    "faq" TEXT NOT NULL DEFAULT '[]',
    "objections" TEXT NOT NULL DEFAULT '[]',
    "cta" TEXT NOT NULL,
    "assets" TEXT NOT NULL DEFAULT '[]',
    "proofStatus" TEXT NOT NULL DEFAULT '[]',
    "disclaimers" TEXT NOT NULL DEFAULT '[]',
    "integrityCheck" TEXT NOT NULL DEFAULT '{}',
    "evidence" TEXT NOT NULL DEFAULT 'INFERRED',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaunchPackage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommercialFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "feedbackType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "analysis" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommercialFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEntry_userId_date_key" ON "CampaignEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_agentId_name_version_key" ON "Skill"("agentId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDossier_opportunityId_key" ON "ProductDossier"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Handoff_dossierId_key" ON "Handoff"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialProduct_productId_key" ON "CommercialProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBlueprint_blueprintId_key" ON "ProductBlueprint"("blueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBlueprint_productId_key" ON "ProductBlueprint"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_assetId_key" ON "ProductAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryExecution_executionId_key" ON "FactoryExecution"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersionRecord_productId_version_key" ON "ProductVersionRecord"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchPackage_packageId_key" ON "LaunchPackage"("packageId");

