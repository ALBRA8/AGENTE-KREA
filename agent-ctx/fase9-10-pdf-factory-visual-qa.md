# FASE 9 & 10: PDF Factory + Visual QA Hardening

## Agent: main
## Date: 2025-10-07

## Summary
Hardened KREA V2's PDF Factory and Visual QA modules to generate REAL PDF files and mark unverifiable checks honestly instead of faking PASS.

## FASE 9: PDF Factory — Real PDF Generation

### Problem
- `PDFFactory.generatePDF()` always returned `filePath: null` — no actual PDF bytes generated
- `verify()` had hardcoded `imagesOk = true` and `indexOk = true` — fake passes

### Changes Made

#### 1. Created `scripts/render-pdf.py`
- Python script that reads JSON PDFRenderSpec from stdin
- Uses **ReportLab** (v4.4.9 confirmed available) to generate real PDF files
- Supports: cover page, TOC, headings (h1/h2/h3), paragraphs, quotes, lists, tables, images (placeholder), captions, decorations, drop caps
- Outputs JSON result: `{ success, pageCount, sizeBytes, filePath, error? }`
- **Tested successfully**: generated a 3804-byte valid PDF with %PDF header and %%EOF trailer

#### 2. Added `renderToPDF()` method to `PDFFactory`
- Writes the PDFRenderSpec as JSON to a temp file
- Calls `python3 scripts/render-pdf.py` via `execSync`
- Parses JSON result from Python subprocess
- Returns `RenderToPDFResult` with actual filePath, pageCount, sizeBytes
- Handles errors with 60s timeout and temp file cleanup

#### 3. Fixed `verify()` method — honest verification
- **When filePath exists and is a valid PDF** (`%PDF` header check):
  - `opens`: true/false based on actual file inspection
  - `structure_ok`: true if spec has pages AND file is valid PDF
- **When filePath is null or file doesn't exist**:
  - `opens`: `"NOT_VERIFIED"` — explicit reason: "renderToPDF() has not been called"
  - `structure_ok`: `"NOT_VERIFIED"` — cannot verify without file
- **Removed hardcoded `imagesOk = true`** → now `"NOT_VERIFIED"` with reason
- **Removed hardcoded `indexOk = true`** → now `"NOT_VERIFIED"` with reason
- **When no QA result provided**: `no_cut_content` and `no_overflow` are `"NOT_VERIFIED"` instead of `true`
- **Overall logic**: If any critical check is false → overall=false. If any critical check is NOT_VERIFIED → overall="NOT_VERIFIED". Only all-critical-pass → overall=true

#### 4. Updated `PDFVerification` interface
- All fields now use `VerificationStatus = boolean | "NOT_VERIFIED"`
- `PDFVerificationDetail.passed` also uses `VerificationStatus`
- Added `RenderToPDFResult` interface

#### 5. Updated `book-factory.ts` for compatibility
- `pdfVerification.overall` now coerced to boolean via `=== true`
- Added `VerificationStatus` import

## FASE 10: Visual QA — Honest Not-Verified Statuses

### Problem
- `inspect()` only checked layout JSON, not real PDF — cannot detect rendering defects
- `repairBadHierarchy()` returned `repaired: false` even though it was supposed to be auto-repairable

### Changes Made

#### 1. Added `QAStatus = "PASS" | "FAIL" | "NOT_VERIFIED"` type
- New tri-state alongside boolean pass/fail
- Every `QAIssue` now has optional `status` and `not_verified_reason` fields

#### 2. Added `inspectPDF(filePath, expectedPageCount?)` method
- **If file doesn't exist**: ALL checks = `"NOT_VERIFIED"`, reason = "No PDF file to inspect"
- **If file exists but is empty**: `valid_pdf = "FAIL"`
- **If file has invalid header**: `valid_pdf = "FAIL"`
- **Page count check**: Scans for `/Type /Page` objects (not `/Type /Pages`)
- **Text extractability**: Checks for `BT` (begin text) operators in PDF streams
- **Rendering defects**: Checks for xref and trailer/root — if present, marks `"NOT_VERIFIED"` since visual inspection needed
- Returns `PDFInspectionResult` with structured check results

#### 3. Added `PDFInspectionResult` interface
- `inspected`: boolean
- `not_inspected_reason`: string
- `checks`: `{ file_exists, valid_pdf, page_count_matches, text_extractable, no_rendering_defects }` — all `QAStatus`
- `issues`: QAIssue[] found at PDF level
- `pageCount`, `sizeBytes`, `validHeader`, `extractedText`

#### 4. Updated `inspect()` to mark scope honestly
- Added `layout_level_only: true` to QAResult
- Added `qa_scope_note: "Layout-level QA only. PDF-level QA requires renderToPDF + inspectPDF."`
- All detected issues now have `status: "FAIL"` explicitly

#### 5. Fixed `repairBadHierarchy()` — now applies REAL repair
- **Before**: Always returned `repaired: false`
- **After**: Inserts intermediate `SectionContent` objects to fill hierarchy gaps
- Example: H1 → H3 gap gets an H2 section inserted with heading `"Section 2"`
- Returns `repaired: true` with `updated_content`

#### 6. Updated `QAResult` interface
- Added `layout_level_only?: boolean`
- Added `qa_scope_note?: string`

## Files Modified
- `/home/z/my-project/src/lib/pdf-factory.ts` — Complete overhaul
- `/home/z/my-project/src/lib/visual-qa.ts` — Complete overhaul
- `/home/z/my-project/src/lib/book-factory.ts` — Compatibility fixes
- `/home/z/my-project/scripts/render-pdf.py` — New file

## API Compatibility
- All existing public methods preserved
- New methods are additions (renderToPDF, inspectPDF)
- PDFVerification fields widen from `boolean` to `boolean | "NOT_VERIFIED"` — callers must handle
- QAResult gets optional fields — backward compatible
- QAIssue gets optional fields — backward compatible

## Verification
- TypeScript type check: 0 errors in modified files
- ESLint: 0 new errors in modified files
- Python script: generates valid PDF (3804 bytes, %PDF header, %%EOF trailer)
- render-pdf.py tested with multi-chapter, multi-element spec
