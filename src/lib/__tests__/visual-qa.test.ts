// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runVisualQA, repairIssue } from '@/lib/visual-qa';
import { generatePdf, defaultPdfConfig } from '@/lib/pdf-factory';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const tmpDir = path.join(os.tmpdir(), 'krea-qa-test');

describe('Visual QA', () => {
  let pdfPath: string;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const config = defaultPdfConfig('QA Test Book', 'Test Author');
    const chapters = [
      { title: 'Chapter 1', content: 'Content for QA testing. This needs enough text to be a proper PDF.' },
      { title: 'Chapter 2', content: 'More content for QA testing. Second chapter with additional text to ensure multi-page output.' },
    ];
    const result = await generatePdf(config, chapters, undefined, tmpDir);
    expect(result.success).toBe(true);
    pdfPath = result.filePath;
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should run QA on a real PDF and pass', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    expect(report).toBeTruthy();
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.inspectedAt).toBeTruthy();
    expect(report.productId).toBe('test-product');
    expect(report.artifactPath).toBe(pdfPath);
  });

  it('should mark verifiable checks as VERIFIED', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const verifiedChecks = report.checks.filter(c => c.evidence === 'VERIFIED');
    expect(verifiedChecks.length).toBeGreaterThan(0);
  });

  it('should mark rendering checks as NOT_VERIFIED', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const notVerifiedChecks = report.checks.filter(c => c.evidence === 'NOT_VERIFIED');
    expect(notVerifiedChecks.length).toBeGreaterThan(0);
  });

  it('should have no critical issues for a valid PDF', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const criticalIssues = report.issues.filter(i => i.severity === 'CRITICAL');
    expect(criticalIssues.length).toBe(0);
    expect(report.passed).toBe(true);
  });

  it('should check file_exists', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const fileExistsCheck = report.checks.find(c => c.name === 'file_exists');
    expect(fileExistsCheck).toBeTruthy();
    expect(fileExistsCheck!.passed).toBe(true);
    expect(fileExistsCheck!.evidence).toBe('VERIFIED');
  });

  it('should check pdf_valid', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const pdfValidCheck = report.checks.find(c => c.name === 'pdf_valid');
    expect(pdfValidCheck).toBeTruthy();
    expect(pdfValidCheck!.passed).toBe(true);
  });

  it('should check page_count', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const pageCountCheck = report.checks.find(c => c.name === 'page_count');
    expect(pageCountCheck).toBeTruthy();
    expect(pageCountCheck!.passed).toBe(true);
  });

  it('should check metadata_populated', async () => {
    const report = await runVisualQA('test-product', pdfPath);
    const metadataCheck = report.checks.find(c => c.name === 'metadata_populated');
    expect(metadataCheck).toBeTruthy();
    expect(metadataCheck!.passed).toBe(true);
  });

  it('should fail QA for non-existent file', async () => {
    const report = await runVisualQA('test-product', '/nonexistent/path.pdf');
    expect(report.passed).toBe(false);
    const criticalIssues = report.issues.filter(i => i.severity === 'CRITICAL');
    expect(criticalIssues.length).toBeGreaterThan(0);
  });

  it('should detect file_exists failure for non-existent file', async () => {
    const report = await runVisualQA('test-product', '/nonexistent/path.pdf');
    const fileExistsCheck = report.checks.find(c => c.name === 'file_exists');
    expect(fileExistsCheck).toBeTruthy();
    expect(fileExistsCheck!.passed).toBe(false);
  });
});

describe('Visual QA - empty file', () => {
  const emptyTmpDir = path.join(os.tmpdir(), 'krea-qa-empty-test');
  let emptyPath: string;

  beforeAll(async () => {
    await fs.mkdir(emptyTmpDir, { recursive: true });
    emptyPath = path.join(emptyTmpDir, 'empty.pdf');
    await fs.writeFile(emptyPath, '');
  });

  afterAll(async () => {
    await fs.rm(emptyTmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should fail QA for empty file', async () => {
    const report = await runVisualQA('test-product', emptyPath);
    expect(report.passed).toBe(false);
  });

  it('should detect file_size failure', async () => {
    const report = await runVisualQA('test-product', emptyPath);
    const fileSizeCheck = report.checks.find(c => c.name === 'file_size');
    expect(fileSizeCheck).toBeTruthy();
    expect(fileSizeCheck!.passed).toBe(false);
  });
});

describe('repairIssue', () => {
  it('should handle unknown repair action', async () => {
    const issue = {
      severity: 'MINOR' as const,
      category: 'test',
      description: 'Test issue',
      repairable: true,
      repairAction: 'unknown_action',
    };

    const result = await repairIssue(issue, '/some/path.pdf');
    expect(result.repaired).toBe(false);
    expect(result.evidence).toBe('NOT_VERIFIED');
  });

  it('should handle regenerate_pdf repair action', async () => {
    const issue = {
      severity: 'CRITICAL' as const,
      category: 'pdf_integrity',
      description: 'PDF is corrupt',
      repairable: true,
      repairAction: 'regenerate_pdf',
    };

    const result = await repairIssue(issue, '/some/path.pdf');
    expect(result.repaired).toBe(false);
    expect(result.evidence).toBe('NOT_VERIFIED');
  });

  it('should handle add_cover_page repair action', async () => {
    const issue = {
      severity: 'MAJOR' as const,
      category: 'pdf_structure',
      description: 'No cover page',
      repairable: true,
      repairAction: 'add_cover_page',
    };

    const result = await repairIssue(issue, '/some/path.pdf');
    expect(result.repaired).toBe(false);
    expect(result.evidence).toBe('NOT_VERIFIED');
  });
});
