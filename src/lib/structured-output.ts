import { z } from "zod";
import type { ZodType } from "zod";

export interface ParseSuccess<T> {
  success: true;
  data: T;
  evidence: "VERIFIED";
}

export interface ParseFailure {
  success: false;
  error: string;
  raw: string;
  errorType: "INVALID_JSON" | "SCHEMA_VALIDATION" | "EMPTY_RESPONSE" | "CONTAMINATED";
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/**
 * Safely parse a structured LLM response.
 *
 * Strategy:
 * 1. Try direct JSON.parse on full response
 * 2. If fails, try extracting JSON from markdown code blocks (```json ... ```)
 * 3. Validate against Zod schema
 * 4. Return structured success or failure
 *
 * NEVER uses regex to extract JSON from mixed text.
 */
export function parseStructuredResponse<T>(
  response: string,
  schema: ZodType<T>
): ParseResult<T> {
  // Step 0: Empty check
  if (!response || response.trim().length === 0) {
    return {
      success: false,
      error: "Empty response from LLM",
      raw: response,
      errorType: "EMPTY_RESPONSE",
    };
  }

  // Step 1: Try direct parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.trim());
  } catch {
    // Step 2: Try extracting from code blocks
    const codeBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n\s*```/);
    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1]);
      } catch (e2) {
        return {
          success: false,
          error: `JSON parse failed even within code block: ${e2 instanceof Error ? e2.message : String(e2)}`,
          raw: response,
          errorType: "INVALID_JSON",
        };
      }
    } else {
      // Step 3: Try to find the first { ... } or [ ... ] that parses
      // This is NOT regex-based JSON extraction — it's finding balanced braces
      const jsonCandidate = extractBalancedJson(response);
      if (jsonCandidate) {
        try {
          parsed = JSON.parse(jsonCandidate);
        } catch (e3) {
          return {
            success: false,
            error: `Could not parse JSON from response: ${e3 instanceof Error ? e3.message : String(e3)}`,
            raw: response,
            errorType: "CONTAMINATED",
          };
        }
      } else {
        return {
          success: false,
          error: "Response does not contain valid JSON",
          raw: response,
          errorType: "CONTAMINATED",
        };
      }
    }
  }

  // Step 4: Validate against Zod schema
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return {
      success: false,
      error: `Schema validation failed: ${errors}`,
      raw: response,
      errorType: "SCHEMA_VALIDATION",
    };
  }

  return {
    success: true,
    data: result.data,
    evidence: "VERIFIED",
  };
}

/**
 * Extract balanced JSON from a string that may contain surrounding text.
 * Uses character counting, NOT regex.
 */
function extractBalancedJson(text: string): string | null {
  // Find first { or [
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");

  let startIdx: number;
  let openChar: string;
  let closeChar: string;

  if (objStart === -1 && arrStart === -1) return null;

  if (objStart === -1) {
    startIdx = arrStart;
    openChar = "[";
    closeChar = "]";
  } else if (arrStart === -1) {
    startIdx = objStart;
    openChar = "{";
    closeChar = "}";
  } else {
    startIdx = Math.min(objStart, arrStart);
    openChar = startIdx === objStart ? "{" : "[";
    closeChar = openChar === "{" ? "}" : "]";
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth++;
    if (ch === closeChar) depth--;

    if (depth === 0) {
      return text.substring(startIdx, i + 1);
    }
  }

  return null; // Unbalanced
}

/**
 * Attempt to parse with retry logic.
 * Calls the LLM function again if parsing fails, up to maxRetries times.
 */
export async function parseWithRetry<T>(
  llmFn: () => Promise<string>,
  schema: ZodType<T>,
  maxRetries: number = 2,
  onRetry?: (attempt: number, error: string) => void
): Promise<ParseResult<T>> {
  let lastResult: ParseResult<T>;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await llmFn();
    lastResult = parseStructuredResponse(response, schema);

    if (lastResult.success) return lastResult;

    if (attempt < maxRetries && onRetry && !lastResult.success) {
      onRetry(attempt + 1, lastResult.error);
    }
  }

  return lastResult!;
}
