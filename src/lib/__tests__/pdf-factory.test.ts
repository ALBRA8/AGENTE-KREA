// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generatePdf, inspectPdf, defaultPdfConfig } from '@/lib/pdf-factory';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const tmpDir = path.join(os.tmpdir(), 'krea-pdf-test');

describe('PDF Factory', () => {
  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should generate a real PDF file', async () => {
    const config = {
      ...defaultPdfConfig('Test Book', 'Test Author'),
      pageSize: 'A4' as const,
      orientation: 'portrait' as const,
    };

    const chapters = [
      { title: 'Chapter 1', content: 'This is the content of chapter 1. It has multiple words and sentences to test text wrapping and layout. We need enough content to ensure the PDF is generated correctly with proper formatting and page layout.' },
      { title: 'Chapter 2', content: 'This is the content of chapter 2. More content here to ensure the PDF has multiple pages. Each chapter should have a heading and body text rendered correctly.' },
    ];

    const result = await generatePdf(config, chapters, undefined, tmpDir);

    expect(result.success).toBe(true);
    expect(result.filePath).toBeTruthy();
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.evidence).toBe('VERIFIED');

    // Verify file actually exists on disk
    const stat = await fs.stat(result.filePath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('should generate PDF with single chapter', async () => {
    const config = defaultPdfConfig('Single Chapter Book', 'Author');
    const chapters = [{ title: 'Only Chapter', content: 'Just one chapter of content here. Testing that a single chapter generates correctly.' }];

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
    expect(result.pageCount).toBeGreaterThan(0);
    expect(result.fileName).toBeTruthy();
    expect(result.fileName).toMatch(/\.pdf$/);
  });

  it('should set correct metadata', async () => {
    const config = defaultPdfConfig('My Great Book', 'Jane Doe');
    const chapters = [{ title: 'Chapter 1', content: 'Content here.' }];

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
    expect(result.metadata.title).toBe('My Great Book');
    expect(result.metadata.author).toBe('Jane Doe');
    expect(result.metadata.creator).toBe('KREA V2 — Book Factory');
    expect(result.metadata.producer).toBe('pdf-lib / KREA V2');
  });

  it('should generate landscape PDF', async () => {
    const config = {
      ...defaultPdfConfig('Landscape Book', 'Author'),
      orientation: 'landscape' as const,
    };
    const chapters = [{ title: 'Chapter 1', content: 'Landscape content.' }];

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
    expect(result.pageCount).toBeGreaterThan(0);
  });

  it('should generate Letter size PDF', async () => {
    const config = {
      ...defaultPdfConfig('Letter Size Book', 'Author'),
      pageSize: 'Letter' as const,
    };
    const chapters = [{ title: 'Chapter 1', content: 'Letter size content.' }];

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
  });

  it('should handle markdown in content', async () => {
    const config = defaultPdfConfig('Markdown Book', 'Author');
    const chapters = [{
      title: 'Chapter 1',
      content: '# Heading\n\nThis is **bold** and *italic* text.\n\n- List item 1\n- List item 2\n\n[Link text](https://example.com)',
    }];

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
    expect(result.pageCount).toBeGreaterThan(0);
  });

  it('should handle empty chapter content', async () => {
    const config = defaultPdfConfig('Empty Chapter Book', 'Author');
    const chapters = [{ title: 'Empty Chapter', content: '' }];

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
  });

  it('should handle many chapters', async () => {
    const config = defaultPdfConfig('Many Chapters Book', 'Author');
    const chapters = Array.from({ length: 10 }, (_, i) => ({
      title: `Chapter ${i + 1}`,
      content: `Content for chapter ${i + 1}. This is some text to fill the page.`,
    }));

    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
    expect(result.pageCount).toBeGreaterThan(5);
  });
});

describe('inspectPdf', () => {
  const inspectTmpDir = path.join(os.tmpdir(), 'krea-pdf-inspect-test');
  let pdfPath: string;

  beforeAll(async () => {
    await fs.mkdir(inspectTmpDir, { recursive: true });
    const config = defaultPdfConfig('Inspect Test', 'Author');
    const chapters = [{ title: 'Chapter 1', content: 'Content for inspection test.' }];
    const result = await generatePdf(config, chapters, undefined, inspectTmpDir);
    pdfPath = result.filePath;
  });

  afterAll(async () => {
    await fs.rm(inspectTmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should inspect a generated PDF', async () => {
    const inspection = await inspectPdf(pdfPath);
    expect(inspection).toBeTruthy();
    expect(inspection.exists).toBe(true);
    expect(inspection.pageCount).toBeGreaterThan(0);
    expect(inspection.fileSize).toBeGreaterThan(0);
    expect(inspection.evidence).toBe('VERIFIED');
  });

  it('should read metadata from PDF', async () => {
    const inspection = await inspectPdf(pdfPath);
    expect(inspection.metadata.title).toBe('Inspect Test');
    expect(inspection.metadata.author).toBe('Author');
  });

  it('should return not found for non-existent file', async () => {
    const inspection = await inspectPdf('/nonexistent/path/file.pdf');
    expect(inspection.exists).toBe(false);
    expect(inspection.evidence).toBe('NOT_VERIFIED');
  });

  it('should handle empty file', async () => {
    const emptyPath = path.join(inspectTmpDir, 'empty.pdf');
    await fs.writeFile(emptyPath, '');
    const inspection = await inspectPdf(emptyPath);
    expect(inspection.exists).toBe(true);
    expect(inspection.fileSize).toBe(0);
    expect(inspection.evidence).toBe('NOT_VERIFIED');
  });

  it('should handle corrupted file', async () => {
    const corruptPath = path.join(inspectTmpDir, 'corrupt.pdf');
    await fs.writeFile(corruptPath, 'this is not a valid pdf content');
    const inspection = await inspectPdf(corruptPath);
    expect(inspection.exists).toBe(true);
    expect(inspection.evidence).toBe('NOT_VERIFIED');
    expect(inspection.pageCount).toBe(0);
  });
});

describe('defaultPdfConfig', () => {
  it('should create config with defaults', () => {
    const config = defaultPdfConfig('Test', 'Author');
    expect(config.title).toBe('Test');
    expect(config.author).toBe('Author');
    expect(config.pageSize).toBe('A4');
    expect(config.orientation).toBe('portrait');
    expect(config.defaultFont).toBe('Helvetica');
    expect(config.defaultFontSize).toBe(11);
    expect(config.lineHeight).toBe(1.5);
    expect(config.margins.top).toBe(72);
  });
});
