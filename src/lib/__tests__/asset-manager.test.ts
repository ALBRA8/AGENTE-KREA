// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeChecksum } from '@/lib/asset-manager';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const tmpDir = path.join(os.tmpdir(), 'krea-asset-test');

describe('AssetManager', () => {
  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should compute SHA-256 checksum for a file', async () => {
    const testFile = path.join(tmpDir, 'test.txt');
    await fs.writeFile(testFile, 'hello world');
    const checksum = await computeChecksum(testFile);
    expect(checksum).toBeTruthy();
    expect(checksum).toHaveLength(64); // SHA-256 hex
    // Same content → same checksum
    const checksum2 = await computeChecksum(testFile);
    expect(checksum2).toBe(checksum);
  });

  it('should produce different checksums for different content', async () => {
    const file1 = path.join(tmpDir, 'file1.txt');
    const file2 = path.join(tmpDir, 'file2.txt');
    await fs.writeFile(file1, 'content A');
    await fs.writeFile(file2, 'content B');
    const cs1 = await computeChecksum(file1);
    const cs2 = await computeChecksum(file2);
    expect(cs1).not.toBe(cs2);
  });
});
