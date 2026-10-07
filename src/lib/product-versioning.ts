/**
 * Product Versioning — KREA V2.1
 *
 * Product version management with full immutability guarantees.
 * Every version is preserved — no version is ever silently overwritten.
 *
 * Semver rules:
 *   major: breaking changes → 1.0.0 → 2.0.0
 *   minor: new features     → 1.0.0 → 1.1.0
 *   patch: bug fixes        → 1.1.0 → 1.1.1
 *
 * Lifecycle:
 *   DRAFT → PUBLISHED → ARCHIVED / SUPERSEDED
 *   When a new version is PUBLISHED, the previous version is SUPERSEDED.
 */

import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SUPERSEDED";

export interface ProductVersion {
  productId: string;
  version: string; // semver: "1.0.0", "1.1.0", "2.0.0"
  blueprintId: string;
  dossierId: string;
  executionId: string | null;
  assets: string[]; // asset IDs
  qaPassed: boolean;
  changes: string; // changelog
  feedback: string[]; // feedback IDs
  parentId: string | null; // previous version's productId
  status: VersionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionDiff {
  fromVersion: string;
  toVersion: string;
  changes: string[];
  assetsAdded: string[];
  assetsRemoved: string[];
  assetsModified: string[];
}

// ─── Version Store (In-Memory) ────────────────────────────────────────────────

/**
 * Key: `${productId}::${version}`
 * This ensures that the same productId+version combination always
 * maps to the same entry, but we NEVER overwrite — we only insert
 * if the key doesn't exist.
 */
const versionStore = new Map<string, ProductVersion>();

function versionKey(productId: string, version: string): string {
  return `${productId}::${version}`;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a new product version.
 *
 * CRITICAL: Never silently overwrite a previous version.
 * If a version with the same productId+version already exists,
 * throws a VersioningError.
 *
 * @param productId - Unique product identifier
 * @param version - Semver string (e.g., "1.0.0")
 * @param blueprintId - Blueprint used for this version
 * @param dossierId - Dossier associated with this version
 * @param parentId - Previous version's productId (for lineage)
 */
export function createProductVersion(
  productId: string,
  version: string,
  blueprintId: string,
  dossierId: string,
  parentId?: string
): ProductVersion {
  const key = versionKey(productId, version);

  // CRITICAL: Never overwrite an existing version
  if (versionStore.has(key)) {
    throw new VersioningError(
      `Version ${version} already exists for product ${productId}. Versions are immutable and cannot be overwritten.`,
      "VERSION_EXISTS",
      productId,
      version
    );
  }

  // Validate semver format
  if (!isValidSemver(version)) {
    throw new VersioningError(
      `Invalid semver format: "${version}". Expected format: "MAJOR.MINOR.PATCH" (e.g., "1.0.0")`,
      "INVALID_SEMVER",
      productId,
      version
    );
  }

  const now = new Date();
  const productVersion: ProductVersion = {
    productId,
    version,
    blueprintId,
    dossierId,
    executionId: null,
    assets: [],
    qaPassed: false,
    changes: "",
    feedback: [],
    parentId: parentId || null,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };

  versionStore.set(key, productVersion);
  return productVersion;
}

/**
 * Publish a product version.
 *
 * Transitions the version from DRAFT → PUBLISHED.
 * If there is a previous published version for this product,
 * it is automatically transitioned to SUPERSEDED.
 *
 * CRITICAL: Previous versions are preserved (SUPERSEDED), not deleted.
 *
 * @param productId - Product identifier
 * @param version - Version to publish
 * @returns The published ProductVersion
 */
export function publishVersion(
  productId: string,
  version: string
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  if (pv.status !== "DRAFT") {
    throw new VersioningError(
      `Cannot publish version ${version}: current status is ${pv.status}, expected DRAFT`,
      "INVALID_STATUS",
      productId,
      version
    );
  }

  const now = new Date();

  // Supersede any previously published versions for this product
  const allVersions = getVersionHistory(productId);
  for (const existing of allVersions) {
    if (
      existing.status === "PUBLISHED" &&
      existing.version !== version
    ) {
      const existingKey = versionKey(productId, existing.version);
      const superseded: ProductVersion = {
        ...existing,
        status: "SUPERSEDED",
        updatedAt: now,
      };
      versionStore.set(existingKey, superseded);
    }
  }

  // Publish this version
  const published: ProductVersion = {
    ...pv,
    status: "PUBLISHED",
    updatedAt: now,
  };

  versionStore.set(key, published);
  return published;
}

/**
 * Archive a product version.
 *
 * Transitions the version to ARCHIVED status.
 * Archived versions are retained for audit but are no longer active.
 *
 * @param productId - Product identifier
 * @param version - Version to archive
 * @returns The archived ProductVersion
 */
export function archiveVersion(
  productId: string,
  version: string
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  if (pv.status === "ARCHIVED") {
    throw new VersioningError(
      `Version ${version} is already archived`,
      "ALREADY_ARCHIVED",
      productId,
      version
    );
  }

  const archived: ProductVersion = {
    ...pv,
    status: "ARCHIVED",
    updatedAt: new Date(),
  };

  versionStore.set(key, archived);
  return archived;
}

/**
 * Get a specific product version.
 */
export function getVersion(
  productId: string,
  version: string
): ProductVersion | null {
  return versionStore.get(versionKey(productId, version)) || null;
}

/**
 * Get the latest version for a product.
 *
 * Returns the most recently created version regardless of status.
 * If multiple versions exist, returns the one with the highest semver.
 */
export function getLatestVersion(productId: string): ProductVersion | null {
  const versions = getVersionHistory(productId);
  if (versions.length === 0) return null;

  // Sort by semver (descending) and return the highest
  return versions.sort((a, b) => compareSemver(b.version, a.version))[0];
}

/**
 * Get the latest published version for a product.
 */
export function getLatestPublishedVersion(
  productId: string
): ProductVersion | null {
  const versions = getVersionHistory(productId).filter(
    (v) => v.status === "PUBLISHED"
  );
  if (versions.length === 0) return null;

  return versions.sort((a, b) => compareSemver(b.version, a.version))[0];
}

/**
 * Get the full version history for a product.
 *
 * Returns all versions sorted by creation date (newest first).
 * Version history is immutable — all versions are preserved.
 */
export function getVersionHistory(productId: string): ProductVersion[] {
  return Array.from(versionStore.values())
    .filter((v) => v.productId === productId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Add a feedback ID to a product version.
 *
 * Feedback IDs are appended (never removed) for full audit trail.
 */
export function addFeedbackToVersion(
  productId: string,
  version: string,
  feedbackId: string
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  const updated: ProductVersion = {
    ...pv,
    feedback: [...pv.feedback, feedbackId],
    updatedAt: new Date(),
  };

  versionStore.set(key, updated);
  return updated;
}

/**
 * Add an asset ID to a product version.
 *
 * Asset IDs are appended (never removed) for full audit trail.
 */
export function addAssetToVersion(
  productId: string,
  version: string,
  assetId: string
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  const updated: ProductVersion = {
    ...pv,
    assets: [...pv.assets, assetId],
    updatedAt: new Date(),
  };

  versionStore.set(key, updated);
  return updated;
}

/**
 * Set the execution ID for a product version.
 */
export function setExecutionId(
  productId: string,
  version: string,
  executionId: string
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  const updated: ProductVersion = {
    ...pv,
    executionId,
    updatedAt: new Date(),
  };

  versionStore.set(key, updated);
  return updated;
}

/**
 * Mark a version as QA passed/failed.
 */
export function setQaStatus(
  productId: string,
  version: string,
  passed: boolean
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  const updated: ProductVersion = {
    ...pv,
    qaPassed: passed,
    updatedAt: new Date(),
  };

  versionStore.set(key, updated);
  return updated;
}

/**
 * Update the changelog for a product version.
 */
export function updateChangelog(
  productId: string,
  version: string,
  changes: string
): ProductVersion {
  const key = versionKey(productId, version);
  const pv = versionStore.get(key);

  if (!pv) {
    throw new VersioningError(
      `Version ${version} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      version
    );
  }

  const updated: ProductVersion = {
    ...pv,
    changes,
    updatedAt: new Date(),
  };

  versionStore.set(key, updated);
  return updated;
}

/**
 * Compare two product versions.
 *
 * Returns a VersionDiff showing the differences between v1 and v2.
 * Assets in v2 but not in v1 are "added".
 * Assets in v1 but not in v2 are "removed".
 * Changes are derived from the changelogs.
 */
export function compareVersions(
  productId: string,
  v1: string,
  v2: string
): VersionDiff {
  const version1 = versionStore.get(versionKey(productId, v1));
  const version2 = versionStore.get(versionKey(productId, v2));

  if (!version1) {
    throw new VersioningError(
      `Version ${v1} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      v1
    );
  }
  if (!version2) {
    throw new VersioningError(
      `Version ${v2} not found for product ${productId}`,
      "NOT_FOUND",
      productId,
      v2
    );
  }

  const v1Assets = new Set(version1.assets);
  const v2Assets = new Set(version2.assets);

  const assetsAdded = version2.assets.filter((a) => !v1Assets.has(a));
  const assetsRemoved = version1.assets.filter((a) => !v2Assets.has(a));
  const assetsModified: string[] = []; // Would need file checksums to detect modifications

  const changes: string[] = [];
  if (version1.changes) changes.push(`v${v1}: ${version1.changes}`);
  if (version2.changes) changes.push(`v${v2}: ${version2.changes}`);

  return {
    fromVersion: v1,
    toVersion: v2,
    changes,
    assetsAdded,
    assetsRemoved,
    assetsModified,
  };
}

// ─── Semver Utilities ─────────────────────────────────────────────────────────

/**
 * Increment a semver version.
 *
 * @param currentVersion - Current version string (e.g., "1.0.0")
 * @param type - Type of increment: "major", "minor", or "patch"
 * @returns New version string
 *
 * Examples:
 *   incrementVersion("1.0.0", "minor") → "1.1.0"
 *   incrementVersion("1.1.0", "major")  → "2.0.0"
 *   incrementVersion("1.1.0", "patch")  → "1.1.1"
 */
export function incrementVersion(
  currentVersion: string,
  type: "major" | "minor" | "patch"
): string {
  if (!isValidSemver(currentVersion)) {
    throw new VersioningError(
      `Invalid semver format: "${currentVersion}"`,
      "INVALID_SEMVER",
      "",
      currentVersion
    );
  }

  const [major, minor, patch] = parseSemver(currentVersion);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Validate a semver string.
 *
 * Accepts format: MAJOR.MINOR.PATCH where each component is a non-negative integer.
 */
export function isValidSemver(version: string): boolean {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  if (!semverRegex.test(version)) return false;

  const [major, minor, patch] = version.split(".").map(Number);
  return (
    Number.isInteger(major) &&
    major >= 0 &&
    Number.isInteger(minor) &&
    minor >= 0 &&
    Number.isInteger(patch) &&
    patch >= 0
  );
}

/**
 * Parse a semver string into its components.
 */
export function parseSemver(version: string): [number, number, number] {
  const parts = version.split(".").map(Number);
  return [parts[0], parts[1], parts[2]];
}

/**
 * Compare two semver strings.
 *
 * Returns:
 *   positive if a > b
 *   negative if a < b
 *   0 if a === b
 */
export function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

/**
 * Get the next version for a product based on existing versions.
 *
 * If no versions exist, returns "1.0.0".
 * If versions exist, increments the latest version by the given type.
 */
export function getNextVersion(
  productId: string,
  type: "major" | "minor" | "patch" = "minor"
): string {
  const latest = getLatestVersion(productId);
  if (!latest) return "1.0.0";
  return incrementVersion(latest.version, type);
}

/**
 * Clear all versions (for testing only).
 */
export function clearVersions(): void {
  versionStore.clear();
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class VersioningError extends Error {
  readonly code: string;
  readonly productId: string;
  readonly version: string;

  constructor(
    message: string,
    code: string,
    productId: string,
    version: string
  ) {
    super(message);
    this.name = "VersioningError";
    this.code = code;
    this.productId = productId;
    this.version = version;
  }
}
