/**
 * Commercial Feedback Classification System for KREA V2.1
 *
 * Classifies and analyzes commercial feedback from customers and the market.
 * Uses heuristic analysis (no LLM required) for fast, deterministic processing.
 *
 * Feedback types cover the full commercial spectrum:
 *   POSITIVE, NEGATIVE, OBJECTION, FEATURE_REQUEST, CONTENT_GAP,
 *   USABILITY, PURCHASE_BARRIER
 *
 * Categories: PRODUCT, CONTENT, DESIGN, PRICE, POSITIONING, DELIVERY, MARKETING, OTHER
 *
 * All analysis is rule-based and transparent — no hidden inference.
 */

// ─── Type Definitions ────────────────────────────────────────────────

export type CommercialFeedbackType =
  | "POSITIVE"
  | "NEGATIVE"
  | "OBJECTION"
  | "FEATURE_REQUEST"
  | "CONTENT_GAP"
  | "USABILITY"
  | "PURCHASE_BARRIER";

export type CommercialFeedbackCategory =
  | "PRODUCT"
  | "CONTENT"
  | "DESIGN"
  | "PRICE"
  | "POSITIONING"
  | "DELIVERY"
  | "MARKETING"
  | "OTHER";

export interface CommercialFeedbackItem {
  feedbackId: string;
  productId: string;
  version: string;
  feedbackType: CommercialFeedbackType;
  category: CommercialFeedbackCategory;
  content: string;
  source: string;
  analyzed: boolean;
  analysis: FeedbackAnalysis | null;
  createdAt: Date;
}

export interface FeedbackAnalysis {
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  themes: string[];
  actionable: boolean;
  suggestedAction: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface FeedbackSummary {
  positive: number;
  negative: number;
  byCategory: Record<string, number>;
  topObjections: string[];
}

// ─── In-Memory Store ──────────────────────────────────────────────────

const feedbackStore = new Map<string, CommercialFeedbackItem>();

// ─── Heuristic Analysis Rules ─────────────────────────────────────────

/**
 * Heuristic rules for mapping feedback type to analysis.
 * Deterministic — no LLM involved.
 */
const HEURISTIC_RULES: Record<
  CommercialFeedbackType,
  {
    sentiment: FeedbackAnalysis["sentiment"];
    actionable: boolean;
    priority: FeedbackAnalysis["priority"];
    suggestedAction: string;
  }
> = {
  POSITIVE: {
    sentiment: "POSITIVE",
    actionable: false,
    priority: "LOW",
    suggestedAction: "Acknowledge and reinforce; consider for testimonials",
  },
  NEGATIVE: {
    sentiment: "NEGATIVE",
    actionable: true,
    priority: "MEDIUM",
    suggestedAction: "Investigate root cause and address in next version",
  },
  OBJECTION: {
    sentiment: "NEUTRAL",
    actionable: true,
    priority: "HIGH",
    suggestedAction: "Address objection in positioning/marketing or product changes",
  },
  FEATURE_REQUEST: {
    sentiment: "NEUTRAL",
    actionable: true,
    priority: "MEDIUM",
    suggestedAction: "Evaluate for roadmap inclusion based on demand signals",
  },
  CONTENT_GAP: {
    sentiment: "NEGATIVE",
    actionable: true,
    priority: "HIGH",
    suggestedAction: "Fill content gap in next revision; prioritize if multiple reports",
  },
  USABILITY: {
    sentiment: "NEGATIVE",
    actionable: true,
    priority: "MEDIUM",
    suggestedAction: "Improve UX/design in next iteration",
  },
  PURCHASE_BARRIER: {
    sentiment: "NEGATIVE",
    actionable: true,
    priority: "HIGH",
    suggestedAction: "Remove barrier — adjust pricing, delivery, or onboarding",
  },
};

/**
 * Theme extraction keywords for each feedback type.
 * Simple keyword matching — no NLP required.
 */
const THEME_KEYWORDS: Record<CommercialFeedbackType, string[]> = {
  POSITIVE: ["value", "quality", "useful", "helpful", "great", "excellent", "love", "recommend"],
  NEGATIVE: ["broken", "wrong", "error", "bad", "poor", "disappointing", "waste", "useless"],
  OBJECTION: ["expensive", "cost", "price", "alternative", "competitor", "not worth", "too complex"],
  FEATURE_REQUEST: ["wish", "could", "should", "need", "want", "missing", "add", "include"],
  CONTENT_GAP: ["missing", "incomplete", "lacking", "not covered", "gap", "nothing about"],
  USABILITY: ["confusing", "hard", "difficult", "unclear", "complicated", "clunky", "intuitive"],
  PURCHASE_BARRIER: ["expensive", "payment", "checkout", "trust", "refund", "demo", "trial", "access"],
};

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Submit a new commercial feedback item.
 * Stores it unanalyzed — call analyzeFeedback() to populate the analysis.
 */
export function submitFeedback(
  productId: string,
  version: string,
  type: CommercialFeedbackType,
  category: CommercialFeedbackCategory,
  content: string,
  source: string
): CommercialFeedbackItem {
  const feedbackId = crypto.randomUUID();

  const item: CommercialFeedbackItem = {
    feedbackId,
    productId,
    version,
    feedbackType: type,
    category,
    content,
    source,
    analyzed: false,
    analysis: null,
    createdAt: new Date(),
  };

  feedbackStore.set(feedbackId, item);
  return item;
}

/**
 * Analyze a feedback item using heuristic rules.
 * Populates the analysis field with sentiment, themes, actionability, and priority.
 * No LLM is used — all analysis is rule-based and deterministic.
 */
export function analyzeFeedback(feedbackId: string): CommercialFeedbackItem {
  const item = feedbackStore.get(feedbackId);
  if (!item) {
    throw new Error(`Feedback item not found: ${feedbackId}`);
  }

  if (item.analyzed && item.analysis) {
    return item; // Already analyzed
  }

  const rule = HEURISTIC_RULES[item.feedbackType];
  const themes = extractThemes(item.content, item.feedbackType);

  const analysis: FeedbackAnalysis = {
    sentiment: rule.sentiment,
    themes,
    actionable: rule.actionable,
    suggestedAction: rule.suggestedAction,
    priority: rule.priority,
  };

  const updated: CommercialFeedbackItem = {
    ...item,
    analyzed: true,
    analysis,
  };

  feedbackStore.set(feedbackId, updated);
  return updated;
}

/**
 * Get all feedback for a product, optionally filtered by version.
 */
export function getFeedbackByProduct(
  productId: string,
  version?: string
): CommercialFeedbackItem[] {
  let results = Array.from(feedbackStore.values()).filter(
    (f) => f.productId === productId
  );

  if (version) {
    results = results.filter((f) => f.version === version);
  }

  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get feedback for a product filtered by category.
 */
export function getFeedbackByCategory(
  productId: string,
  category: CommercialFeedbackCategory
): CommercialFeedbackItem[] {
  return Array.from(feedbackStore.values())
    .filter((f) => f.productId === productId && f.category === category)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get a summary of commercial feedback for a product.
 * Aggregates counts, categories, and top objections.
 */
export function getFeedbackSummary(productId: string): FeedbackSummary {
  const allFeedback = getFeedbackByProduct(productId);

  // Auto-analyze any unanalyzed items
  for (const item of allFeedback) {
    if (!item.analyzed) {
      analyzeFeedback(item.feedbackId);
    }
  }

  const reanalyzed = getFeedbackByProduct(productId);

  let positive = 0;
  let negative = 0;
  const byCategory: Record<string, number> = {};
  const objections: string[] = [];

  for (const item of reanalyzed) {
    // Count by category
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;

    // Count positive/negative
    if (item.analysis) {
      if (item.analysis.sentiment === "POSITIVE") positive++;
      if (item.analysis.sentiment === "NEGATIVE") negative++;
    }

    // Collect objections
    if (item.feedbackType === "OBJECTION") {
      objections.push(item.content);
    }
  }

  // Top objections (most frequent — deduplicated by similarity, limited to top 5)
  const topObjections = deduplicateObjections(objections).slice(0, 5);

  return {
    positive,
    negative,
    byCategory,
    topObjections,
  };
}

/**
 * Get a single feedback item by ID.
 */
export function getFeedbackItem(feedbackId: string): CommercialFeedbackItem | undefined {
  return feedbackStore.get(feedbackId);
}

/**
 * Get all feedback items (for admin/debugging).
 */
export function getAllFeedback(): CommercialFeedbackItem[] {
  return Array.from(feedbackStore.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Clear all feedback (for testing only).
 */
export function clearFeedback(): void {
  feedbackStore.clear();
}

// ─── Private Helpers ──────────────────────────────────────────────────

/**
 * Extract themes from feedback content using keyword matching.
 * Returns matched theme keywords found in the content.
 */
function extractThemes(content: string, type: CommercialFeedbackType): string[] {
  const lowerContent = content.toLowerCase();
  const keywords = THEME_KEYWORDS[type];
  const matched: string[] = [];

  for (const keyword of keywords) {
    if (lowerContent.includes(keyword)) {
      matched.push(keyword);
    }
  }

  // If no keywords matched, add a generic theme for the type
  if (matched.length === 0) {
    matched.push(type.toLowerCase());
  }

  return matched;
}

/**
 * Simple deduplication of objection strings.
 * Groups similar objections (by word overlap) and keeps the shortest representative.
 */
function deduplicateObjections(objections: string[]): string[] {
  if (objections.length === 0) return [];

  const groups: string[][] = [];

  for (const objection of objections) {
    const words = new Set(objection.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    let matched = false;

    for (const group of groups) {
      const representative = group[0];
      const repWords = new Set(representative.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

      // Calculate Jaccard similarity
      let intersection = 0;
      for (const w of words) {
        if (repWords.has(w)) intersection++;
      }
      const union = words.size + repWords.size - intersection;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity > 0.4) {
        group.push(objection);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push([objection]);
    }
  }

  // Sort groups by size (most frequent first), return representative
  return groups
    .sort((a, b) => b.length - a.length)
    .map((group) => {
      // Return the shortest representative as it's likely the most concise
      return group.reduce((shortest, current) =>
        current.length < shortest.length ? current : shortest
      );
    });
}
