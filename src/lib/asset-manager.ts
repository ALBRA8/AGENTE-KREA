/**
 * Asset Manager — KREA V2.1
 *
 * Manages all assets produced by factories.
 * Every asset is registered with a SHA-256 checksum for integrity
 * verification. Assets track their source factory and provider
 * for full provenance.
 *
 * CRITICAL:
 * - Asset checksums use crypto.createHash('sha256')
 * - File existence is verified on registration
 * - Integrity can be re-verified at any time
 * - Assets are never silently deleted — they are ARCHIVED
 */

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import * as fs from "fs/promises";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetType =
  | "pdf"
  | "epub"
  | "image"
  | "cover"
  | "metadata"
  | "markdown"
  | "template"
  | "data";

export type AssetStatus = "ACTIVE" | "ARCHIVED" | "DELETED";

export type EvidenceTag =
  | "VERIFIED"
  | "INFERRED"
  | "ESTIMATED"
  | "NOT_VERIFIED"
  | "UNKNOWN";

export interface Asset {
  assetId: string;
  productId: string;
  version: string;
  type: AssetType;
  filename: string;
  mimeType: string;
  path: string;
  size: number;
  checksum: string; // SHA-256
  source: string; // which factory produced it
  provider: string; // which provider generated it
  generatedAt: Date;
  status: AssetStatus;
  evidence: EvidenceTag;
}

export interface AssetTrace {
  productId: string;
  version: string;
  executionId: string;
  assets: Asset[];
}

// ─── MIME Type Map ────────────────────────────────────────────────────────────

const MIME_TYPE_MAP: Record<AssetType, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  image: "image/png",
  cover: "image/png",
  metadata: "application/json",
  markdown: "text/markdown",
  template: "application/json",
  data: "application/json",
};

// ─── Asset Store (In-Memory) ──────────────────────────────────────────────────

const assetStore = new Map<string, Asset>();

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Compute SHA-256 checksum of a file.
 *
 * Reads the entire file into memory and computes the hash.
 * For very large files, a streaming approach would be better,
 * but for typical product assets (PDFs, images, JSON) this is fine.
 */
export async function computeChecksum(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hash = createHash("sha256");
  hash.update(fileBuffer);
  return hash.digest("hex");
}

/**
 * Register a new asset in the asset manager.
 *
 * - Verifies the file exists on disk
 * - Computes SHA-256 checksum
 * - Gets file size from filesystem
 * - Returns Asset with VERIFIED evidence
 *
 * Throws if the file does not exist.
 */
export async function registerAsset(
  productId: string,
  version: string,
  type: AssetType,
  filename: string,
  mimeType: string,
  filePath: string,
  source: string,
  provider: string
): Promise<Asset> {
  // Verify file exists
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    throw new AssetManagerError(
      `File not found: ${filePath}`,
      "FILE_NOT_FOUND",
      ""
    );
  }

  if (!stat.isFile()) {
    throw new AssetManagerError(
      `Path is not a file: ${filePath}`,
      "NOT_A_FILE",
      ""
    );
  }

  if (stat.size === 0) {
    throw new AssetManagerError(
      `File is empty (0 bytes): ${filePath}`,
      "EMPTY_FILE",
      ""
    );
  }

  // Compute checksum
  const checksum = await computeChecksum(filePath);

  const asset: Asset = {
    assetId: generateAssetId(),
    productId,
    version,
    type,
    filename,
    mimeType: mimeType || MIME_TYPE_MAP[type],
    path: filePath,
    size: stat.size,
    checksum,
    source,
    provider,
    generatedAt: new Date(),
    status: "ACTIVE",
    evidence: "VERIFIED",
  };

  assetStore.set(asset.assetId, asset);
  return asset;
}

/**
 * Register an asset from an existing ArtifactRef (from orchestrator).
 *
 * Convenience function that wraps registerAsset with the artifact ref data.
 */
export async function registerArtifactRef(
  productId: string,
  version: string,
  artifact: {
    assetId?: string;
    type: string;
    filename: string;
    path: string;
    size: number;
    mimeType: string;
  },
  source: string,
  provider: string
): Promise<Asset> {
  const assetType = artifact.type as AssetType;
  return registerAsset(
    productId,
    version,
    assetType,
    artifact.filename,
    artifact.mimeType,
    artifact.path,
    source,
    provider
  );
}

/**
 * Get an asset by ID.
 */
export function getAsset(assetId: string): Asset | null {
  return assetStore.get(assetId) || null;
}

/**
 * List assets for a product, optionally filtered by version.
 */
export function listAssets(productId: string, version?: string): Asset[] {
  let results = Array.from(assetStore.values()).filter(
    (a) => a.productId === productId && a.status !== "DELETED"
  );

  if (version) {
    results = results.filter((a) => a.version === version);
  }

  return results.sort(
    (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
  );
}

/**
 * List all assets, optionally filtered by type and/or status.
 */
export function listAllAssets(filters?: {
  type?: AssetType;
  status?: AssetStatus;
  source?: string;
}): Asset[] {
  let results = Array.from(assetStore.values());

  if (filters?.type) {
    results = results.filter((a) => a.type === filters.type);
  }
  if (filters?.status) {
    results = results.filter((a) => a.status === filters.status);
  }
  if (filters?.source) {
    results = results.filter((a) => a.source === filters.source);
  }

  return results.sort(
    (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
  );
}

/**
 * Archive an asset.
 *
 * Archived assets are retained for audit but are not considered active.
 * Returns the updated asset.
 */
export function archiveAsset(assetId: string): Asset {
  const asset = assetStore.get(assetId);
  if (!asset) {
    throw new AssetManagerError(
      `Asset not found: ${assetId}`,
      "NOT_FOUND",
      assetId
    );
  }

  if (asset.status === "DELETED") {
    throw new AssetManagerError(
      `Cannot archive a deleted asset: ${assetId}`,
      "INVALID_STATUS",
      assetId
    );
  }

  const updated: Asset = {
    ...asset,
    status: "ARCHIVED",
  };

  assetStore.set(assetId, updated);
  return updated;
}

/**
 * Delete an asset (soft delete).
 *
 * The asset record is retained for audit but marked as DELETED.
 * The actual file on disk is NOT removed — that must be done
 * explicitly if desired.
 */
export function deleteAsset(assetId: string): Asset {
  const asset = assetStore.get(assetId);
  if (!asset) {
    throw new AssetManagerError(
      `Asset not found: ${assetId}`,
      "NOT_FOUND",
      assetId
    );
  }

  const updated: Asset = {
    ...asset,
    status: "DELETED",
  };

  assetStore.set(assetId, updated);
  return updated;
}

/**
 * Get a full asset trace for a product version.
 *
 * Returns all assets associated with a specific product version,
 * along with their provenance information.
 */
export function getAssetTrace(
  productId: string,
  version: string,
  executionId?: string
): AssetTrace {
  const assets = Array.from(assetStore.values())
    .filter(
      (a) =>
        a.productId === productId &&
        a.version === version &&
        a.status !== "DELETED"
    )
    .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

  return {
    productId,
    version,
    executionId: executionId || "",
    assets,
  };
}

/**
 * Verify asset integrity by re-checking the checksum.
 *
 * Reads the file from disk, computes the SHA-256 checksum,
 * and compares it to the stored checksum.
 *
 * Returns true if the checksums match, false otherwise.
 * Returns false if the file no longer exists.
 */
export async function verifyAssetIntegrity(assetId: string): Promise<boolean> {
  const asset = assetStore.get(assetId);
  if (!asset) {
    throw new AssetManagerError(
      `Asset not found: ${assetId}`,
      "NOT_FOUND",
      assetId
    );
  }

  try {
    const currentChecksum = await computeChecksum(asset.path);
    return currentChecksum === asset.checksum;
  } catch {
    // File no longer exists or can't be read
    return false;
  }
}

/**
 * Verify integrity of all active assets for a product.
 *
 * Returns a map of assetId → boolean (true if integrity verified).
 */
export async function verifyProductAssets(
  productId: string,
  version?: string
): Promise<Map<string, boolean>> {
  const assets = listAssets(productId, version);
  const results = new Map<string, boolean>();

  for (const asset of assets) {
    if (asset.status === "ACTIVE") {
      const valid = await verifyAssetIntegrity(asset.assetId);
      results.set(asset.assetId, valid);
    }
  }

  return results;
}

/**
 * Get total size of all active assets for a product version.
 */
export function getTotalAssetSize(
  productId: string,
  version?: string
): number {
  return listAssets(productId, version)
    .filter((a) => a.status === "ACTIVE")
    .reduce((sum, a) => sum + a.size, 0);
}

/**
 * Get asset count by type for a product version.
 */
export function getAssetCountByType(
  productId: string,
  version: string
): Record<string, number> {
  const assets = listAssets(productId, version);
  const counts: Record<string, number> = {};

  for (const asset of assets) {
    if (asset.status === "ACTIVE") {
      counts[asset.type] = (counts[asset.type] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Clear all assets (for testing only).
 */
export function clearAssets(): void {
  assetStore.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAssetId(): string {
  return `asset_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class AssetManagerError extends Error {
  readonly code: string;
  readonly assetId: string;

  constructor(message: string, code: string, assetId: string) {
    super(message);
    this.name = "AssetManagerError";
    this.code = code;
    this.assetId = assetId;
  }
}
