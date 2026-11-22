// @vitest-environment node
/**
 * Cover embedding regression suite (INFORME-ESTADO.md P1).
 *
 * FASE D E2E finding: the AI image provider returned JPEG bytes even though
 * the pipeline saved them as `.png`; pdf-factory picked the embed method by
 * file extension, called embedPng on JPEG bytes, failed with
 * "The input is not a PNG file!" and silently dropped the cover page.
 *
 * Fix: format is detected from REAL bytes (magic numbers) first; the file
 * extension is only a fallback. The producer (book-factory) also names the
 * file after the real bytes via imageExtensionFor.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generatePdf, defaultPdfConfig } from '@/lib/pdf-factory';
import { detectImageFormat, imageExtensionFor } from '@/lib/image-format';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const tmpDir = path.join(os.tmpdir(), 'krea-pdf-cover-test');
const fixturesDir = path.resolve(
  process.cwd(),
  'src/lib/__tests__/fixtures'
);

const CH: { title: string; content: string }[] = [
  {
    title: 'Chapter 1',
    content:
      'Cover regression chapter. Enough content to guarantee a multi-page PDF so the cover adds exactly one page.',
  },
];

async function copyFixture(src: string, destName: string): Promise<string> {
  const bytes = await fs.readFile(path.join(fixturesDir, src));
  const dest = path.join(tmpDir, destName);
  await fs.writeFile(dest, bytes);
  return dest;
}

describe('image-format (magic bytes)', () => {
  it('detects JPEG bytes regardless of the file name', async () => {
    const bytes = await fs.readFile(path.join(fixturesDir, 'tiny.jpg'));
    expect(detectImageFormat(bytes)).toBe('jpg');
    expect(imageExtensionFor(bytes)).toBe('.jpg');
  });

  it('detects PNG bytes regardless of the file name', async () => {
    const bytes = await fs.readFile(path.join(fixturesDir, 'tiny.png'));
    expect(detectImageFormat(bytes)).toBe('png');
    expect(imageExtensionFor(bytes)).toBe('.png');
  });

  it('returns null for unknown bytes and keeps .png default', async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    expect(detectImageFormat(bytes)).toBeNull();
    expect(imageExtensionFor(bytes)).toBe('.png');
  });
});

describe('generatePdf cover embedding (P1 regression)', () => {
  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('embeds a cover when JPEG bytes are saved with a .png name', async () => {
    // Baseline: same book without cover
    const baseline = await generatePdf(
      defaultPdfConfig('Cover Jpeg As Png', 'Author'),
      CH,
      undefined,
      tmpDir
    );
    expect(baseline.success).toBe(true);

    // The exact FASE D E2E scenario: real JPEG bytes, .png extension
    const coverPath = await copyFixture('tiny.jpg', 'jpeg-as-png.png');
    const withCover = await generatePdf(
      defaultPdfConfig('Cover Jpeg As Png', 'Author'),
      CH,
      coverPath,
      tmpDir
    );

    expect(withCover.success).toBe(true);
    expect(withCover.pageCount).toBe(baseline.pageCount + 1);
  });

  it('embeds a correctly-named PNG cover', async () => {
    const baseline = await generatePdf(
      defaultPdfConfig('Cover Png Ok', 'Author'),
      CH,
      undefined,
      tmpDir
    );
    const coverPath = await copyFixture('tiny.png', 'ok-cover.png');
    const withCover = await generatePdf(
      defaultPdfConfig('Cover Png Ok', 'Author'),
      CH,
      coverPath,
      tmpDir
    );

    expect(withCover.success).toBe(true);
    expect(withCover.pageCount).toBe(baseline.pageCount + 1);
  });

  it('uses bytes-first detection for unknown extensions (fallback path)', async () => {
    const baseline = await generatePdf(
      defaultPdfConfig('Cover Unknown Ext', 'Author'),
      CH,
      undefined,
      tmpDir
    );
    // JPEG bytes behind an extension imageTypeFromPath does not know
    const coverPath = await copyFixture('tiny.jpg', 'cover.webp');
    const withCover = await generatePdf(
      defaultPdfConfig('Cover Unknown Ext', 'Author'),
      CH,
      coverPath,
      tmpDir
    );

    expect(withCover.success).toBe(true);
    expect(withCover.pageCount).toBe(baseline.pageCount + 1);
  });

  it('still skips an unrecognizable cover without crashing', async () => {
    const baseline = await generatePdf(
      defaultPdfConfig('Cover Garbage', 'Author'),
      CH,
      undefined,
      tmpDir
    );
    const badPath = path.join(tmpDir, 'garbage.png');
    await fs.writeFile(badPath, Buffer.from('definitely not an image'));
    const withCover = await generatePdf(
      defaultPdfConfig('Cover Garbage', 'Author'),
      CH,
      badPath,
      tmpDir
    );

    expect(withCover.success).toBe(true);
    expect(withCover.pageCount).toBe(baseline.pageCount);
  });
});
