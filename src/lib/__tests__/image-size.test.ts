// @vitest-environment node
/**
 * Unit tests for normalizeImageSize (zai.adapter) — P2 smoke root cause:
 * the image API rejects sizes that are not multiples of 32 within 512–2880
 * px with <= 2^22 total pixels (error 1214). The adapter maps any requested
 * creative dimension to the closest valid preset by aspect ratio.
 */
import { describe, it, expect } from 'vitest';
import { normalizeImageSize } from '@/contracts/zai.adapter';

describe('normalizeImageSize', () => {
  it('passes through already-valid sizes untouched', () => {
    expect(normalizeImageSize('1024x1024')).toBe('1024x1024');
    expect(normalizeImageSize('1792x1024')).toBe('1792x1024');
    expect(normalizeImageSize('1152x896')).toBe('1152x896');
    expect(normalizeImageSize('576x1024')).toBe('576x1024');
  });

  it('maps non-multiple-of-32 square sizes to the square preset (error 1214 regression)', () => {
    // 1080x1080 was rejected by the API during the P2 smoke run
    expect(normalizeImageSize('1080x1080')).toBe('1024x1024');
  });

  it('maps portrait sizes to the portrait preset', () => {
    expect(normalizeImageSize('1080x1920')).toBe('576x1024');
  });

  it('maps wide/short sizes to the closest wide preset', () => {
    // 600x200 (ratio 3.0) → closest preset ratio is 1024x576 (1.78)
    expect(normalizeImageSize('600x200')).toBe('1024x576');
  });

  it('clamps oversized dimensions by aspect ratio', () => {
    // 4096x4096 exceeds the 2880px cap → square preset
    expect(normalizeImageSize('4096x4096')).toBe('1024x1024');
  });

  it('falls back to 1024x1024 for garbage input', () => {
    expect(normalizeImageSize(undefined)).toBe('1024x1024');
    expect(normalizeImageSize('')).toBe('1024x1024');
    expect(normalizeImageSize('big')).toBe('1024x1024');
    expect(normalizeImageSize('1920x')).toBe('1024x1024');
  });
});
