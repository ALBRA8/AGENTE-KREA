# Task: KREA V2 Book Factory, PDF Factory, and Visual QA Modules

## Task ID: book-factory-modules
## Agent: main
## Status: COMPLETED

## Summary

Created three core modules for KREA V2 eBook production pipeline:

### 1. `src/lib/pdf-factory.ts` — Real PDF Generation
- Uses `pdf-lib` to generate REAL PDF files on disk
- `generatePdf(config, chapters, coverImagePath?, outputDir?)` — Full PDF generation with:
  - Cover image embedding (JPG/PNG)
  - Title page
  - Table of Contents
  - Chapter formatting with proper typography
  - Page numbers on every page
  - Markdown stripping to plain text
  - Text wrapping to fit page width
  - File existence verification after writing
  - Returns `PdfResult` with `evidence: VERIFIED`
- `inspectPdf(filePath)` — Reads and validates a PDF file, returns metadata
- `defaultPdfConfig(title, author)` — Default configuration builder
- Configurable output directory via `KREA_PDF_OUTPUT_DIR` env var
- Default output: `/home/z/my-project/download/`

### 2. `src/lib/visual-qa.ts` — Visual QA Inspection
- `runVisualQA(productId, artifactPath)` — Runs 9 checks:
  1. File exists and is readable (VERIFIED)
  2. File size > 0 (VERIFIED)
  3. PDF is valid — can be opened by pdf-lib (VERIFIED)
  4. Page count > 0 (VERIFIED)
  5. No empty pages — zero dimensions detected (VERIFIED)
  6. Metadata populated — title/author (VERIFIED)
  7. Cover page exists — first page present (VERIFIED)
  8. Visual rendering quality (NOT_VERIFIED — requires renderer)
  9. Image quality (NOT_VERIFIED — requires renderer)
- `repairIssue(issue, artifactPath, metadata?)` — Repairs:
  - `remove_empty_pages` — removes zero-dimension pages, re-saves
  - `update_metadata` — sets title/author metadata
  - `add_cover_page` — NOT_VERIFIED (requires pipeline Step 4)
  - `regenerate_pdf` — NOT_VERIFIED (requires pipeline Step 7)
- Honest evidence tagging: VERIFIED only for actual inspections, NOT_VERIFIED for skipped/unsupported

### 3. `src/lib/book-factory.ts` — 10-Step Pipeline Orchestrator
- `createBookProject(input)` — Creates project with PENDING status
- `runPipeline(projectId, onProgress?)` — Executes all 10 steps:
  1. ARCHITECTURE — Generate/validate chapter structure via ZAI
  2. CONTENT GENERATION — Generate chapter content via ZAI
  3. ART DIRECTION — Determine visual style via ZAI
  4. COVER DESIGN — Generate cover image via ZAI (non-fatal if fails)
  5. EDITORIAL DESIGN — Review/refine content via ZAI
  6. LAYOUT — Prepare PdfConfig from project style
  7. PDF GENERATION — Call pdf-factory to generate REAL PDF
  8. VISUAL QA — Call visual-qa to inspect PDF
  9. REPAIR — Fix issues found in QA, re-run QA
  10. FINAL — Write metadata JSON, verify PDF still exists
- `createAndRun(input, onProgress?)` — Convenience: create + run
- Progress callback for real-time status updates
- Error handling: critical errors stop pipeline, non-critical are logged

## Evidence Tags Used
- VERIFIED: File physically inspected/created/validated on disk
- NOT_VERIFIED: Check skipped or cannot be performed programmatically
- INFERRED: Result derived from other VERIFIED checks
- ESTIMATED/UNKNOWN: Available for downstream use

## Dependencies Added
- `pdf-lib@1.17.1`

## Files Created (3 new files, 0 modified)
- `src/lib/pdf-factory.ts`
- `src/lib/visual-qa.ts`
- `src/lib/book-factory.ts`

## Validation
- TypeScript: No errors in new files
- ESLint: No errors in new files
- Next.js dev server: Starts successfully (Ready in 365ms)
