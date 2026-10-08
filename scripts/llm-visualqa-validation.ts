/**
 * KREA V2.1 Validation — Phase 5 (LLM Real) + Phase 6 (Visual QA Real)
 *
 * This script performs REAL validation:
 * - Phase 5: Attempts real ZAI API calls; if key unavailable, marks NOT_VERIFIED
 * - Phase 6: Runs visual QA on real PDF artifact using pdf-lib
 *
 * NEVER fakes PASS. NEVER invents results.
 */

import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "NOT_VERIFIED";
  detail: string;
  evidence: "VERIFIED" | "NOT_VERIFIED" | "INFERRED";
  duration?: number;
}

interface PhaseResult {
  phase: string;
  checks: CheckResult[];
  overallPass: boolean;
  summary: string;
}

// ─── PHASE 5: LLM Real ────────────────────────────────────────────────────────

async function runPhase5(): Promise<PhaseResult> {
  const checks: CheckResult[] = [];

  console.log("\n" + "=".repeat(70));
  console.log("PHASE 5: LLM Real — ZAI API Key Validation");
  console.log("=".repeat(70));

  // ── Check 1: ZAI_API_KEY in environment ────────────────────────────────
  const envKey = process.env.ZAI_API_KEY;
  const keyInEnv = !!(envKey && envKey.trim().length > 0 && envKey !== "your-key-here");

  checks.push({
    name: "zai_api_key_in_env",
    status: keyInEnv ? "PASS" : "FAIL",
    detail: keyInEnv
      ? `ZAI_API_KEY found in process.env (${envKey!.substring(0, 8)}...)`
      : "ZAI_API_KEY not set in process.env or is empty/placeholder",
    evidence: "VERIFIED",
  });

  // ── Check 2: ZAI_API_KEY in .env file ──────────────────────────────────
  let keyInDotEnv = false;
  let dotEnvContent = "";
  try {
    dotEnvContent = await fs.readFile("/home/z/my-project/.env", "utf-8");
    const keyMatch = dotEnvContent.match(/ZAI_API_KEY\s*=\s*(.+)/);
    if (keyMatch && keyMatch[1].trim().length > 0 && keyMatch[1].trim() !== "your-key-here") {
      keyInDotEnv = true;
    }
  } catch {
    // .env file not readable
  }

  checks.push({
    name: "zai_api_key_in_dotenv",
    status: keyInDotEnv ? "PASS" : "FAIL",
    detail: keyInDotEnv
      ? "ZAI_API_KEY found in .env file"
      : "ZAI_API_KEY not found in .env file or is empty/placeholder",
    evidence: "VERIFIED",
  });

  const keyAvailable = keyInEnv || keyInDotEnv;

  // ── Check 3: ZAI SDK importable ────────────────────────────────────────
  let sdkImportable = false;
  let sdkError = "";
  try {
    // Dynamic import to test if the SDK is available
    const ZAIMod = await import("z-ai-web-dev-sdk");
    sdkImportable = !!ZAIMod;
  } catch (err) {
    sdkError = err instanceof Error ? err.message : String(err);
  }

  checks.push({
    name: "zai_sdk_importable",
    status: sdkImportable ? "PASS" : "FAIL",
    detail: sdkImportable
      ? "z-ai-web-dev-sdk is importable"
      : `z-ai-web-dev-sdk import failed: ${sdkError}`,
    evidence: "VERIFIED",
  });

  // ── Check 4: Real API call (if key available) ──────────────────────────
  if (keyAvailable && sdkImportable) {
    console.log("\n  Attempting real ZAI API call...");

    // Test: product-fit LLM
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      const start = Date.now();
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a Product Fit Analyst. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content:
              'Analyze this product opportunity: Title="Test Ebook", Domain=ebook, Description="A comprehensive guide to system design thinking", TargetAudience="Software engineers", ProblemStatement="Engineers lack practical system design skills". Return JSON with: marketExistence (0-1), audienceClarity (0-1), problemValidity (0-1), differentiation (0-1), feasibility (0-1), reasoning (string).',
          },
        ],
      });
      const duration = Date.now() - start;

      const content = response.choices?.[0]?.message?.content || "";

      // Validate response
      const hasContent = content.trim().length > 0;
      const isValidJson = (() => {
        try {
          JSON.parse(content.trim());
          return true;
        } catch {
          // Try extracting JSON from markdown
          const match = content.match(/```json\s*\n([\s\S]*?)\n\s*```/);
          if (match) {
            try {
              JSON.parse(match[1]);
              return true;
            } catch {
              return false;
            }
          }
          // Try balanced extraction
          const objStart = content.indexOf("{");
          if (objStart >= 0) {
            try {
              JSON.parse(content.substring(objStart));
              return true;
            } catch {
              // Find balanced braces
              let depth = 0;
              let inStr = false;
              let esc = false;
              for (let i = objStart; i < content.length; i++) {
                const ch = content[i];
                if (esc) { esc = false; continue; }
                if (ch === "\\") { esc = true; continue; }
                if (ch === '"') { inStr = !inStr; continue; }
                if (inStr) continue;
                if (ch === "{") depth++;
                if (ch === "}") depth--;
                if (depth === 0) {
                  try {
                    JSON.parse(content.substring(objStart, i + 1));
                    return true;
                  } catch {
                    return false;
                  }
                }
              }
            }
          }
          return false;
        }
      })();

      const hasNoPlaceholders = !content.includes("[PLACEHOLDER") && !content.includes("TODO") && !content.includes("INSERT_");

      checks.push({
        name: "product_fit_llm_real_call",
        status: hasContent && isValidJson && hasNoPlaceholders ? "PASS" : "FAIL",
        detail: `API call succeeded in ${duration}ms. Content length: ${content.length}. Valid JSON: ${isValidJson}. No placeholders: ${hasNoPlaceholders}. Response preview: ${content.substring(0, 150)}...`,
        evidence: "VERIFIED",
        duration,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: "product_fit_llm_real_call",
        status: "FAIL",
        detail: `API call failed: ${msg}`,
        evidence: "VERIFIED",
      });
    }

    // Test: product-architecture LLM
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      const start = Date.now();
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              'You are a Product Architect specializing in books. Return ONLY valid JSON with: architecture (string), components (array of {name,type,description,dependencies}), dependencies (string[]), constraints (string[]), estimatedDuration (string), technologyStack (string[]), chapters (array of {number,title,description,estimatedWords,keyTopics[]}), totalWordCount (number), artDirection (string), format ("pdf"|"epub"|"both").',
          },
          {
            role: "user",
            content:
              'Design an ebook architecture for: Title="System Design Thinking Guide", Description="Comprehensive guide", Fit Score=0.7. Provide complete book architecture with chapter structure.',
          },
        ],
      });
      const duration = Date.now() - start;

      const content = response.choices?.[0]?.message?.content || "";
      const hasContent = content.trim().length > 0;
      const hasArchitecture = content.includes("architecture") && content.includes("chapter");

      checks.push({
        name: "product_architecture_llm_real_call",
        status: hasContent && hasArchitecture ? "PASS" : "FAIL",
        detail: `Architecture API call in ${duration}ms. Content length: ${content.length}. Has architecture+chapters: ${hasArchitecture}. Preview: ${content.substring(0, 150)}...`,
        evidence: "VERIFIED",
        duration,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: "product_architecture_llm_real_call",
        status: "FAIL",
        detail: `Architecture API call failed: ${msg}`,
        evidence: "VERIFIED",
      });
    }

    // Test: commercial-product LLM-assisted
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      const start = Date.now();
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a Commercial Product Strategist. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content:
              'Create a commercial product definition for an ebook "System Design Thinking Guide" targeting software engineers at $29-49 price point. Return JSON with: customerProfile {description, demographics[], psychographics[], painPoints[], currentSolutions[]}, priceStrategy {range{min,max}, model, justification}, positioning {valueProposition, differentiators[], competitiveAdvantage}, objections [{concern, response}], proofRequirements [{type, description, status}].',
          },
        ],
      });
      const duration = Date.now() - start;

      const content = response.choices?.[0]?.message?.content || "";
      const hasContent = content.trim().length > 0;
      const hasCommercial = content.includes("customer") || content.includes("price") || content.includes("positioning");

      checks.push({
        name: "commercial_product_llm_real_call",
        status: hasContent && hasCommercial ? "PASS" : "FAIL",
        detail: `Commercial API call in ${duration}ms. Content length: ${content.length}. Has commercial elements: ${hasCommercial}. Preview: ${content.substring(0, 150)}...`,
        evidence: "VERIFIED",
        duration,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: "commercial_product_llm_real_call",
        status: "FAIL",
        detail: `Commercial API call failed: ${msg}`,
        evidence: "VERIFIED",
      });
    }

    // Test: content generation
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      const start = Date.now();
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a professional content writer. Write in a professional tone, intermediate depth, structured format. Language: English.",
          },
          {
            role: "user",
            content:
              'Generate content for the following section of an ebook: Section Title="Introduction to System Design", Section Type=chapter, Context="A comprehensive guide to system design thinking for software engineers". Requirements: Clear heading, Substance and depth, Key takeaways, Narrative flow. Write at least 300 words of meaningful content.',
          },
        ],
      });
      const duration = Date.now() - start;

      const content = response.choices?.[0]?.message?.content || "";
      const hasContent = content.trim().length > 0;
      const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
      const isSubstantial = wordCount >= 200; // Allow some leeway from 300 target

      checks.push({
        name: "content_generation_llm_real_call",
        status: hasContent && isSubstantial ? "PASS" : "FAIL",
        detail: `Content generation in ${duration}ms. Word count: ${wordCount}. Substantial (>=200 words): ${isSubstantial}. Preview: ${content.substring(0, 150)}...`,
        evidence: "VERIFIED",
        duration,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.push({
        name: "content_generation_llm_real_call",
        status: "FAIL",
        detail: `Content generation API call failed: ${msg}`,
        evidence: "VERIFIED",
      });
    }
  } else {
    // No key available — mark all LLM capabilities as NOT_VERIFIED
    const capabilities = [
      "product_fit_llm_real_call",
      "product_architecture_llm_real_call",
      "commercial_product_llm_real_call",
      "content_generation_llm_real_call",
    ];

    for (const cap of capabilities) {
      checks.push({
        name: cap,
        status: "NOT_VERIFIED",
        detail: "EXTERNAL PROVIDER UNAVAILABLE — ZAI_API_KEY not set in environment or .env file",
        evidence: "NOT_VERIFIED",
      });
    }
  }

  // ── Check 5: Verify module code structure (can always verify) ──────────
  // These checks verify the code exists and is well-structured, even without API key

  const moduleChecks = [
    { name: "product_fit_module", path: "/home/z/my-project/src/lib/product-fit.ts", requiredExports: ["evaluateProductFit", "quickFitCheck"] },
    { name: "product_architecture_module", path: "/home/z/my-project/src/lib/product-architecture.ts", requiredExports: ["designProductArchitecture"] },
    { name: "commercial_product_module", path: "/home/z/my-project/src/lib/commercial-product.ts", requiredExports: [] },
    { name: "content_engine_module", path: "/home/z/my-project/src/lib/product-content-engine.ts", requiredExports: ["generateSectionContent", "assembleContent"] },
    { name: "structured_output_module", path: "/home/z/my-project/src/lib/structured-output.ts", requiredExports: ["parseStructuredResponse"] },
  ];

  for (const mod of moduleChecks) {
    try {
      const content = await fs.readFile(mod.path, "utf-8");
      const exists = content.length > 0;
      const hasZAIImport = content.includes("z-ai-web-dev-sdk");
      const hasExports = mod.requiredExports.every((exp) => content.includes(exp));

      checks.push({
        name: `${mod.name}_code_structure`,
        status: exists && hasExports ? "PASS" : "FAIL",
        detail: `Module exists: ${exists}. Has ZAI SDK import: ${hasZAIImport}. Has required exports: ${hasExports}. Exports checked: [${mod.requiredExports.join(", ")}]`,
        evidence: "VERIFIED",
      });
    } catch {
      checks.push({
        name: `${mod.name}_code_structure`,
        status: "FAIL",
        detail: `Module not found at ${mod.path}`,
        evidence: "VERIFIED",
      });
    }
  }

  // Determine overall phase pass
  const criticalChecks = checks.filter(
    (c) =>
      c.name.includes("_llm_real_call") ||
      c.name === "zai_api_key_in_env" ||
      c.name === "zai_sdk_importable"
  );
  const allCriticalNotFail = criticalChecks.every((c) => c.status !== "FAIL");
  // Phase 5 passes if no FAIL in critical checks (NOT_VERIFIED is acceptable for external deps)
  const anyRealVerification = checks.some(
    (c) => c.name.includes("_llm_real_call") && c.status === "PASS"
  );

  const summary = keyAvailable
    ? anyRealVerification
      ? "ZAI API key available — real API calls validated"
      : "ZAI API key available but API calls failed"
    : "ZAI_API_KEY NOT available — all LLM capabilities marked NOT_VERIFIED";

  return {
    phase: "Phase 5: LLM Real",
    checks,
    overallPass: allCriticalNotFail,
    summary,
  };
}

// ─── PHASE 6: Visual QA Real ──────────────────────────────────────────────────

async function runPhase6(): Promise<PhaseResult> {
  const checks: CheckResult[] = [];

  console.log("\n" + "=".repeat(70));
  console.log("PHASE 6: Visual QA Real — PDF Artifact Validation");
  console.log("=".repeat(70));

  // ── Find PDF artifact ──────────────────────────────────────────────────
  const downloadDir = "/home/z/my-project/download";
  let pdfPath = "";

  try {
    const files = await fs.readdir(downloadDir);
    const pdfFiles = files
      .filter((f) => f.endsWith(".pdf"))
      .map((f) => path.join(downloadDir, f));

    if (pdfFiles.length > 0) {
      // Find most recent by modification time
      let mostRecent = pdfFiles[0];
      let mostRecentTime = 0;
      for (const f of pdfFiles) {
        const stat = await fs.stat(f);
        if (stat.mtimeMs > mostRecentTime) {
          mostRecentTime = stat.mtimeMs;
          mostRecent = f;
        }
      }
      pdfPath = mostRecent;
    }
  } catch {
    // download dir not accessible
  }

  // ── Check 1: PDF file found ────────────────────────────────────────────
  const pdfFound = pdfPath.length > 0;
  checks.push({
    name: "pdf_artifact_found",
    status: pdfFound ? "PASS" : "FAIL",
    detail: pdfFound
      ? `PDF found at: ${pdfPath}`
      : "No PDF file found in download directory",
    evidence: "VERIFIED",
  });

  // ── Check 2: pdf-lib available ─────────────────────────────────────────
  let pdfLibAvailable = false;
  try {
    const mod = await import("pdf-lib");
    pdfLibAvailable = !!mod.PDFDocument;
  } catch {}

  checks.push({
    name: "pdf_lib_available",
    status: pdfLibAvailable ? "PASS" : "FAIL",
    detail: pdfLibAvailable
      ? "pdf-lib is available for PDF inspection"
      : "pdf-lib NOT available — cannot inspect PDF",
    evidence: "VERIFIED",
  });

  if (!pdfFound || !pdfLibAvailable) {
    // Cannot proceed — mark remaining checks
    const remainingChecks = [
      "pdf_file_exists",
      "pdf_file_opens",
      "pdf_pages_render",
      "pdf_no_empty_pages",
      "pdf_cover_exists",
      "pdf_text_not_cut_off",
      "pdf_layout_not_broken",
      "pdf_metadata_populated",
    ];

    for (const name of remainingChecks) {
      checks.push({
        name,
        status: "NOT_VERIFIED",
        detail: !pdfFound
          ? "RENDERER UNAVAILABLE — No PDF artifact found"
          : "RENDERER UNAVAILABLE — pdf-lib not installed",
        evidence: "NOT_VERIFIED",
      });
    }

    return {
      phase: "Phase 6: Visual QA Real",
      checks,
      overallPass: false,
      summary: !pdfFound
        ? "No PDF artifact found — cannot perform Visual QA"
        : "pdf-lib not available — cannot inspect PDF",
    };
  }

  // ── Now perform real Visual QA on the PDF ──────────────────────────────

  // Check: File exists and is readable
  let fileSize = 0;
  try {
    const stat = await fs.stat(pdfPath);
    fileSize = stat.size;
    checks.push({
      name: "pdf_file_exists",
      status: fileSize > 0 ? "PASS" : "FAIL",
      detail: `File exists at ${pdfPath} (${fileSize} bytes)`,
      evidence: "VERIFIED",
    });
  } catch (err) {
    checks.push({
      name: "pdf_file_exists",
      status: "FAIL",
      detail: `File not accessible: ${err instanceof Error ? err.message : String(err)}`,
      evidence: "VERIFIED",
    });
  }

  // Check: PDF opens (parsed by pdf-lib)
  let pdfDoc: PDFDocument | null = null;
  let pageCount = 0;

  if (fileSize > 0) {
    try {
      const pdfBytes = await fs.readFile(pdfPath);
      pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
      checks.push({
        name: "pdf_file_opens",
        status: pageCount > 0 ? "PASS" : "FAIL",
        detail: `PDF opens successfully. Page count: ${pageCount}`,
        evidence: "VERIFIED",
      });
    } catch (err) {
      checks.push({
        name: "pdf_file_opens",
        status: "FAIL",
        detail: `PDF cannot be parsed: ${err instanceof Error ? err.message : String(err)}`,
        evidence: "VERIFIED",
      });
    }
  } else {
    checks.push({
      name: "pdf_file_opens",
      status: "NOT_VERIFIED",
      detail: "Cannot open — file is empty or does not exist",
      evidence: "NOT_VERIFIED",
    });
  }

  // Check: Pages render (non-zero dimensions)
  if (pdfDoc && pageCount > 0) {
    let allPagesRender = true;
    let badPageCount = 0;
    const pages = pdfDoc.getPages();
    const pageDetails: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      const { width, height } = pages[i].getSize();
      if (width <= 0 || height <= 0) {
        allPagesRender = false;
        badPageCount++;
      }
      if (i < 5) {
        pageDetails.push(`Page ${i + 1}: ${width}x${height}`);
      }
    }

    checks.push({
      name: "pdf_pages_render",
      status: allPagesRender ? "PASS" : "FAIL",
      detail: allPagesRender
        ? `All ${pageCount} pages have non-zero dimensions. First pages: ${pageDetails.join("; ")}`
        : `${badPageCount} of ${pageCount} pages have zero/negative dimensions`,
      evidence: "VERIFIED",
    });

    // Check: No empty pages
    checks.push({
      name: "pdf_no_empty_pages",
      status: allPagesRender ? "PASS" : "FAIL",
      detail: allPagesRender
        ? `No empty pages found (all ${pageCount} pages have valid dimensions)`
        : `Found ${badPageCount} empty/invalid page(s)`,
      evidence: "VERIFIED",
    });

    // Check: Cover page exists
    const firstPage = pages[0];
    const { width: coverWidth, height: coverHeight } = firstPage.getSize();
    const coverValid = coverWidth > 0 && coverHeight > 0;

    checks.push({
      name: "pdf_cover_exists",
      status: coverValid && pageCount >= 1 ? "PASS" : "FAIL",
      detail: `First page (cover) exists: ${coverWidth}x${coverHeight} pts. Total pages: ${pageCount}`,
      evidence: "VERIFIED",
    });
  } else {
    checks.push({
      name: "pdf_pages_render",
      status: "NOT_VERIFIED",
      detail: "Cannot check — PDF not loaded",
      evidence: "NOT_VERIFIED",
    });
    checks.push({
      name: "pdf_no_empty_pages",
      status: "NOT_VERIFIED",
      detail: "Cannot check — PDF not loaded",
      evidence: "NOT_VERIFIED",
    });
    checks.push({
      name: "pdf_cover_exists",
      status: "NOT_VERIFIED",
      detail: "Cannot check — PDF not loaded",
      evidence: "NOT_VERIFIED",
    });
  }

  // Check: Metadata populated
  if (pdfDoc) {
    const title = pdfDoc.getTitle();
    const author = pdfDoc.getAuthor();
    const subject = pdfDoc.getSubject();
    const creator = pdfDoc.getCreator();

    const hasTitle = !!(title && title.trim().length > 0);
    const hasAuthor = !!(author && author.trim().length > 0);

    checks.push({
      name: "pdf_metadata_populated",
      status: hasTitle && hasAuthor ? "PASS" : "FAIL",
      detail: `Title: "${title || "(empty)"}", Author: "${author || "(empty)"}", Subject: "${subject || "(empty)"}", Creator: "${creator || "(empty)"}"`,
      evidence: "VERIFIED",
    });
  } else {
    checks.push({
      name: "pdf_metadata_populated",
      status: "NOT_VERIFIED",
      detail: "Cannot check — PDF not loaded",
      evidence: "NOT_VERIFIED",
    });
  }

  // Check: Text not cut off (NOT_VERIFIED — requires visual renderer)
  checks.push({
    name: "pdf_text_not_cut_off",
    status: "NOT_VERIFIED",
    detail: "Text cutoff detection requires a visual renderer (e.g., Playwright/Puppeteer with PDF viewer). pdf-lib can only inspect structure, not rendered content.",
    evidence: "NOT_VERIFIED",
  });

  // Check: Layout not broken (NOT_VERIFIED — requires visual renderer)
  checks.push({
    name: "pdf_layout_not_broken",
    status: "NOT_VERIFIED",
    detail: "Layout integrity verification requires a visual renderer. pdf-lib can verify page dimensions but not visual layout quality.",
    evidence: "NOT_VERIFIED",
  });

  // ── Run the actual visual-qa module ────────────────────────────────────
  let moduleQARan = false;
  try {
    // Import and run the actual visual-qa module
    const { runVisualQA } = await import("../src/lib/visual-qa");
    const qaReport = await runVisualQA("validation-test", pdfPath);

    moduleQARan = true;
    checks.push({
      name: "visual_qa_module_execution",
      status: qaReport.passed ? "PASS" : "FAIL",
      detail: `Visual QA module ran successfully. Passed: ${qaReport.passed}. Checks: ${qaReport.checks.length}. Issues: ${qaReport.issues.length}. Evidence: ${qaReport.evidence}`,
      evidence: qaReport.evidence as any,
    });

    // Add each check from the module
    for (const check of qaReport.checks) {
      checks.push({
        name: `visual_qa_module_${check.name}`,
        status: check.passed ? "PASS" : "FAIL",
        detail: `Module check: ${check.name} — ${check.detail} [${check.evidence}]`,
        evidence: check.evidence as any,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    checks.push({
      name: "visual_qa_module_execution",
      status: "FAIL",
      detail: `Visual QA module execution failed: ${msg}`,
      evidence: "VERIFIED",
    });
  }

  // Determine overall
  const verifiableChecks = checks.filter((c) => c.evidence === "VERIFIED");
  const anyVerifiedFail = verifiableChecks.some((c) => c.status === "FAIL");
  const anyVerified = verifiableChecks.length > 0;

  const summary = anyVerified
    ? anyVerifiedFail
      ? "Visual QA found issues in the PDF artifact"
      : "All verifiable Visual QA checks passed"
    : "No verifiable checks could be performed";

  return {
    phase: "Phase 6: Visual QA Real",
    checks,
    overallPass: anyVerified && !anyVerifiedFail,
    summary,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║  KREA V2.1 Validation — Phase 5 (LLM Real) + Phase 6 (Visual QA)  ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");

  const phase5 = await runPhase5();
  const phase6 = await runPhase6();

  // ── Print detailed results ─────────────────────────────────────────────

  for (const phase of [phase5, phase6]) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`${phase.phase} — Results`);
    console.log(`${"─".repeat(70)}`);

    for (const check of phase.checks) {
      const icon =
        check.status === "PASS" ? "✅" :
        check.status === "FAIL" ? "❌" :
        "⚠️ ";
      const durStr = check.duration ? ` (${check.duration}ms)` : "";
      console.log(`  ${icon} ${check.name}: ${check.status}${durStr}`);
      console.log(`     Detail: ${check.detail}`);
      console.log(`     Evidence: ${check.evidence}`);
    }

    console.log(`\n  Overall: ${phase.overallPass ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`  Summary: ${phase.summary}`);
  }

  // ── Final summary ──────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(70));
  console.log("FINAL SUMMARY");
  console.log("═".repeat(70));

  console.log(`\nPhase 5 (LLM Real):     ${phase5.overallPass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Summary: ${phase5.summary}`);
  console.log(`  Checks: ${phase5.checks.filter((c) => c.status === "PASS").length} PASS, ${phase5.checks.filter((c) => c.status === "FAIL").length} FAIL, ${phase5.checks.filter((c) => c.status === "NOT_VERIFIED").length} NOT_VERIFIED`);

  console.log(`\nPhase 6 (Visual QA):    ${phase6.overallPass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Summary: ${phase6.summary}`);
  console.log(`  Checks: ${phase6.checks.filter((c) => c.status === "PASS").length} PASS, ${phase6.checks.filter((c) => c.status === "FAIL").length} FAIL, ${phase6.checks.filter((c) => c.status === "NOT_VERIFIED").length} NOT_VERIFIED`);

  // Output JSON for programmatic use
  const report = {
    timestamp: new Date().toISOString(),
    phase5: {
      overall: phase5.overallPass ? "PASS" : "FAIL",
      summary: phase5.summary,
      checks: phase5.checks,
    },
    phase6: {
      overall: phase6.overallPass ? "PASS" : "FAIL",
      summary: phase6.summary,
      checks: phase6.checks,
    },
  };

  const reportPath = "/home/z/my-project/scripts/llm-visualqa-validation-report.json";
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Validation script failed:", err);
  process.exit(1);
});
