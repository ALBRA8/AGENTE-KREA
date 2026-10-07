# Factory Orchestrator, Factory Contract, Asset Manager, and Product Versioning

## Task ID: krea-v2.1-factory-modules

## Summary

Created 4 new modules for the KREA V2.1 factory layer:

### 1. `src/lib/factory-contract.ts` (9.7KB)
Common contract that ALL factories must implement.

**Types:**
- `FactoryStatus` — CREATED | QUEUED | RUNNING | QA | PASSED | FAILED | REPAIRING | COMPLETED | CANCELLED
- `EvidenceTag` — VERIFIED | INFERRED | ESTIMATED | NOT_VERIFIED | UNKNOWN
- `ArtifactSpec`, `QASpec`, `SuccessCriterion`, `FactoryError`
- `FactoryContract` — full contract interface
- `Blueprint` — input to contract creation

**Functions:**
- `createFactoryContract(factoryId, productId, blueprint)` → FactoryContract
- `transitionFactoryStatus(contract, newStatus)` → FactoryContract (valid transitions only)
- `addError(contract, step, message, recoverable)` → FactoryContract
- `isIdempotent(contract)` → boolean
- `isValidTransition(from, to)` → boolean
- `hasUnrecoverableErrors(contract)` → boolean
- `getStatusDescription(status)` → string
- `getContract(factoryId)`, `listContracts(productId?)`, `clearContracts()`

**Valid transitions:**
- CREATED→QUEUED→RUNNING→QA→PASSED/FAILED
- PASSED→COMPLETED
- FAILED→REPAIRING→RUNNING (retry)
- Any→CANCELLED (except terminal states)

### 2. `src/lib/product-factory-orchestrator.ts` (34KB)
Selects the right factory and executes the pipeline.

**Types:**
- `ProductType` — ebook | guide | manual | workbook | checklist | template_pack | digital_kit | resource_pack | software | saas | api | hybrid_content
- `FactoryType` — book_factory | document_factory | kit_factory | handoff_only
- `FactoryExecution`, `StepProgress`, `ArtifactRef`, `QAReport`, `QACheck`
- `ExecutionBlueprint`, `ProgressCallback`

**Functions:**
- `resolveFactory(productType)` → FactoryType
- `executeFactory(blueprint, onProgress?)` → FactoryExecution
- `getExecution(executionId)` → FactoryExecution | null
- `listExecutions(productId)` → FactoryExecution[]

**Factory dispatch:**
- ebook/guide/manual/workbook → book_factory (10-step pipeline)
- checklist/template_pack → document_factory (3-step: prep → PDF → final)
- digital_kit/resource_pack → kit_factory (3-step: assemble → package → final)
- software/saas/api → handoff_only (2-step: handoff → final)
- hybrid_content → book_factory (primary)

**QA execution:** Runs visual QA on PDF artifacts, file existence checks, structure QA, content QA, commercial QA, and delivery QA.

### 3. `src/lib/asset-manager.ts` (11KB)
Manages all assets produced by factories.

**Types:**
- `AssetType` — pdf | epub | image | cover | metadata | markdown | template | data
- `AssetStatus` — ACTIVE | ARCHIVED | DELETED
- `Asset`, `AssetTrace`

**Functions:**
- `registerAsset(productId, version, type, filename, mimeType, filePath, source, provider)` → Asset
- `computeChecksum(filePath)` → string (SHA-256 via crypto.createHash)
- `getAsset(assetId)` → Asset | null
- `listAssets(productId, version?)` → Asset[]
- `archiveAsset(assetId)` → Asset
- `getAssetTrace(productId, version, executionId?)` → AssetTrace
- `verifyAssetIntegrity(assetId)` → boolean (re-checks checksum)
- `verifyProductAssets(productId, version?)` → Map<string, boolean>
- `getTotalAssetSize(productId, version?)` → number
- `getAssetCountByType(productId, version)` → Record<string, number>
- `deleteAsset(assetId)` → Asset (soft delete)
- `registerArtifactRef(productId, version, artifact, source, provider)` → Asset
- `listAllAssets(filters?)` → Asset[]

### 4. `src/lib/product-versioning.ts` (15.8KB)
Product version management with full immutability.

**Types:**
- `VersionStatus` — DRAFT | PUBLISHED | ARCHIVED | SUPERSEDED
- `ProductVersion`, `VersionDiff`

**Functions:**
- `createProductVersion(productId, version, blueprintId, dossierId, parentId?)` → ProductVersion
- `publishVersion(productId, version)` → ProductVersion (DRAFT→PUBLISHED, previous→SUPERSEDED)
- `archiveVersion(productId, version)` → ProductVersion
- `getVersion(productId, version)` → ProductVersion | null
- `getLatestVersion(productId)` → ProductVersion | null
- `getLatestPublishedVersion(productId)` → ProductVersion | null
- `getVersionHistory(productId)` → ProductVersion[]
- `addFeedbackToVersion(productId, version, feedbackId)` → ProductVersion
- `addAssetToVersion(productId, version, assetId)` → ProductVersion
- `compareVersions(productId, v1, v2)` → VersionDiff
- `incrementVersion(currentVersion, type)` → string
- `isValidSemver(version)` → boolean
- `parseSemver(version)` → [major, minor, patch]
- `compareSemver(a, b)` → number
- `getNextVersion(productId, type?)` → string

**CRITICAL guarantees:**
- Never silently overwrites a previous version
- All versions are preserved (immutability)
- Semver validation enforced
- Publishing auto-supersedes previous published versions

## Lint & Type Check Results

- All 4 files pass ESLint with zero errors
- factory-contract.ts, asset-manager.ts, product-versioning.ts pass tsc --noEmit
- product-factory-orchestrator.ts depends on existing modules with pre-existing type issues (not introduced by our code)

## No files modified

Per instructions, only new files were created in src/lib/.
