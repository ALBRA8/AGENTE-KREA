/**
 * MemoryDV - Agent Memory System for AGENTE-KREA
 *
 * Provides full memory lifecycle: store, recall, consolidate, dedup, decay, verify.
 * Memory types: EPISODIC, SEMANTIC, FACTUAL, PROCEDURAL
 * Each memory carries: evidence, provenance, confidence, truth_level, decay
 */

import { db } from "@/lib/db";

// ─── Type Definitions ────────────────────────────────────────────────

export type MemoryType = "EPISODIC" | "SEMANTIC" | "FACTUAL" | "PROCEDURAL";
export type SourceType = "USER" | "AGENT" | "SYSTEM" | "EXTERNAL" | "FEEDBACK" | "INFERENCE";
export type TruthLevel = "OBSERVED" | "VERIFIED" | "ESTIMATED" | "MODELED" | "INFERRED" | "UNKNOWN";
export type MemoryScope = "agent" | "user" | "global" | "ecosistema";
export type MemoryStatus = "ACTIVE" | "CONSOLIDATED" | "INVALIDATED" | "ARCHIVED";

export interface MemoryContent {
  [key: string]: unknown;
}

export interface MemoryEvidence {
  source?: string;
  timestamp?: string;
  data?: unknown;
  provenance?: string[];
}

export interface StoreMemoryOptions {
  userId?: string;
  source?: string;
  sourceType?: SourceType;
  evidence?: MemoryEvidence;
  confidence?: number;
  truthLevel?: TruthLevel;
  relevance?: number;
  utility?: number;
  scope?: MemoryScope;
  status?: MemoryStatus;
}

export interface RecallQuery {
  domain?: string;
  type?: MemoryType;
  scope?: MemoryScope;
  userId?: string;
  minConfidence?: number;
  minRelevance?: number;
  status?: MemoryStatus;
  searchText?: string;
  agentId?: string;
}

export interface RecallOptions {
  limit?: number;
  offset?: number;
  orderBy?: "relevance" | "confidence" | "createdAt" | "updatedAt";
  orderDir?: "asc" | "desc";
}

// ─── Truth Level Ordering ────────────────────────────────────────────

const TRUTH_LEVEL_ORDER: Record<TruthLevel, number> = {
  OBSERVED: 5,
  VERIFIED: 4,
  ESTIMATED: 3,
  MODELED: 2,
  INFERRED: 1,
  UNKNOWN: 0,
};

// ─── MemoryManager ───────────────────────────────────────────────────

export class MemoryManager {
  private defaultAgentId = "krea";

  /**
   * Store a new memory in the system.
   * Checks for duplicates first; if a near-duplicate exists, updates it instead.
   */
  async store(
    agentId: string,
    domain: string,
    type: MemoryType,
    content: MemoryContent,
    options: StoreMemoryOptions = {}
  ): Promise<{ id: string; isNew: boolean }> {
    const contentStr = JSON.stringify(content);
    const effectiveAgentId = agentId || this.defaultAgentId;

    // Check for duplicates in the same domain+type+scope
    const duplicate = await this.dedup(domain, contentStr, {
      agentId: effectiveAgentId,
      userId: options.userId,
      type,
    });

    if (duplicate) {
      // Merge: boost confidence slightly, update content, refresh relevance
      const newConfidence = Math.min(1.0, duplicate.confidence + 0.05);
      const newRelevance = Math.min(1.0, duplicate.relevance + 0.02);
      const mergedEvidence = this.mergeEvidence(
        duplicate.evidence ? JSON.parse(duplicate.evidence) : {},
        options.evidence || {}
      );

      await db.memory.update({
        where: { id: duplicate.id },
        data: {
          content: contentStr,
          confidence: newConfidence,
          relevance: newRelevance,
          evidence: JSON.stringify(mergedEvidence),
          decay: 0, // Reset decay on reinforcement
          lastVerified: new Date(),
          source: options.source || duplicate.source,
          sourceType: options.sourceType || duplicate.sourceType,
        },
      });

      return { id: duplicate.id, isNew: false };
    }

    // Create new memory
    const memory = await db.memory.create({
      data: {
        agentId: effectiveAgentId,
        userId: options.userId,
        domain,
        type,
        content: contentStr,
        source: options.source,
        sourceType: options.sourceType,
        evidence: options.evidence ? JSON.stringify(options.evidence) : null,
        confidence: options.confidence ?? 0.5,
        truthLevel: options.truthLevel ?? "ESTIMATED",
        relevance: options.relevance ?? 1.0,
        utility: options.utility ?? 0.5,
        scope: options.scope ?? "agent",
        status: options.status ?? "ACTIVE",
      },
    });

    return { id: memory.id, isNew: true };
  }

  /**
   * Recall memories matching a query with optional filtering and ordering.
   */
  async recall(query: RecallQuery = {}, options: RecallOptions = {}): Promise<unknown[]> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const orderBy = options.orderBy ?? "relevance";
    const orderDir = options.orderDir ?? "desc";

    // Build where clause
    const where: Record<string, unknown> = {};

    if (query.agentId) where.agentId = query.agentId;
    if (query.domain) where.domain = query.domain;
    if (query.type) where.type = query.type;
    if (query.scope) where.scope = query.scope;
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;
    if (query.minConfidence !== undefined) where.confidence = { gte: query.minConfidence };
    if (query.minRelevance !== undefined) where.relevance = { gte: query.minRelevance };

    // Text search in content (case-insensitive contains)
    if (query.searchText) {
      where.content = { contains: query.searchText };
    }

    const orderField = orderBy === "createdAt" || orderBy === "updatedAt" ? orderBy : orderBy;
    const orderConfig = { [orderField]: orderDir };

    const memories = await db.memory.findMany({
      where,
      orderBy: orderConfig,
      take: limit,
      skip: offset,
    });

    return memories.map((m) => ({
      ...m,
      content: JSON.parse(m.content),
      evidence: m.evidence ? JSON.parse(m.evidence) : null,
    }));
  }

  /**
   * Consolidate similar memories: merge those with same domain+type+scope
   * that have overlapping content, boosting confidence and marking as CONSOLIDATED.
   */
  async consolidate(agentId?: string): Promise<{ consolidated: number }> {
    const effectiveAgentId = agentId || this.defaultAgentId;
    let consolidated = 0;

    // Find all active memories grouped by domain+type
    const memories = await db.memory.findMany({
      where: {
        agentId: effectiveAgentId,
        status: "ACTIVE",
      },
      orderBy: { confidence: "desc" },
    });

    // Group by domain+type+scope+userId
    const groups = new Map<string, typeof memories>();
    for (const mem of memories) {
      const key = `${mem.domain}|${mem.type}|${mem.scope}|${mem.userId ?? "null"}`;
      const group = groups.get(key) || [];
      group.push(mem);
      groups.set(key, group);
    }

    // For each group, merge memories with similar content
    for (const [, group] of groups) {
      if (group.length < 2) continue;

      const merged: Set<string> = new Set();
      for (let i = 0; i < group.length; i++) {
        if (merged.has(group[i].id)) continue;

        for (let j = i + 1; j < group.length; j++) {
          if (merged.has(group[j].id)) continue;

          const similarity = this.computeSimilarity(group[i].content, group[j].content);
          if (similarity > 0.7) {
            // Merge j into i
            const kept = group[i];
            const absorbed = group[j];

            const newConfidence = Math.min(
              1.0,
              kept.confidence + absorbed.confidence * 0.3
            );
            const mergedEvidence = this.mergeEvidence(
              kept.evidence ? JSON.parse(kept.evidence) : {},
              absorbed.evidence ? JSON.parse(absorbed.evidence) : {}
            );

            // Determine the highest truth level
            const newTruthLevel = this.higherTruthLevel(
              kept.truthLevel as TruthLevel,
              absorbed.truthLevel as TruthLevel
            );

            await db.memory.update({
              where: { id: kept.id },
              data: {
                confidence: newConfidence,
                truthLevel: newTruthLevel,
                evidence: JSON.stringify(mergedEvidence),
                status: "CONSOLIDATED",
              },
            });

            // Invalidate the absorbed memory
            await db.memory.update({
              where: { id: absorbed.id },
              data: {
                status: "INVALIDATED",
                relevance: 0,
              },
            });

            merged.add(absorbed.id);
            consolidated++;
          }
        }
      }
    }

    return { consolidated };
  }

  /**
   * Check for duplicate memories in a given domain.
   * Returns the most similar existing memory above a threshold, or null.
   */
  async dedup(
    domain: string,
    content: string,
    options: { agentId?: string; userId?: string; type?: MemoryType } = {}
  ): Promise<{ id: string; confidence: number; relevance: number; evidence: string | null; source: string | null; sourceType: string | null } | null> {
    const effectiveAgentId = options.agentId || this.defaultAgentId;

    const where: Record<string, unknown> = {
      agentId: effectiveAgentId,
      domain,
      status: { in: ["ACTIVE", "CONSOLIDATED"] },
    };
    if (options.userId) where.userId = options.userId;
    if (options.type) where.type = options.type;

    const candidates = await db.memory.findMany({ where });

    for (const candidate of candidates) {
      const similarity = this.computeSimilarity(content, candidate.content);
      if (similarity > 0.8) {
        return {
          id: candidate.id,
          confidence: candidate.confidence,
          relevance: candidate.relevance,
          evidence: candidate.evidence,
          source: candidate.source,
          sourceType: candidate.sourceType,
        };
      }
    }

    return null;
  }

  /**
   * Apply time-based decay to all active memories.
   * Decay increases over time; relevance decreases proportionally.
   */
  async decay(agentId?: string, decayRate: number = 0.01): Promise<{ decayed: number }> {
    const effectiveAgentId = agentId || this.defaultAgentId;
    let decayed = 0;

    const memories = await db.memory.findMany({
      where: {
        agentId: effectiveAgentId,
        status: { in: ["ACTIVE", "CONSOLIDATED"] },
      },
    });

    for (const mem of memories) {
      const ageMs = Date.now() - mem.updatedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const newDecay = mem.decay + decayRate * ageDays;
      const newRelevance = Math.max(0, mem.relevance * Math.exp(-newDecay));

      // Archive memories that have decayed below threshold
      const newStatus = newRelevance < 0.05 ? "ARCHIVED" : mem.status;

      await db.memory.update({
        where: { id: mem.id },
        data: {
          decay: newDecay,
          relevance: newRelevance,
          status: newStatus,
        },
      });

      decayed++;
    }

    return { decayed };
  }

  /**
   * Update a memory's fields.
   */
  async update(
    memoryId: string,
    updates: Partial<{
      content: MemoryContent;
      confidence: number;
      truthLevel: TruthLevel;
      relevance: number;
      utility: number;
      scope: MemoryScope;
      status: MemoryStatus;
      source: string;
      sourceType: SourceType;
      evidence: MemoryEvidence;
    }>
  ): Promise<void> {
    const data: Record<string, unknown> = {};

    if (updates.content !== undefined) data.content = JSON.stringify(updates.content);
    if (updates.confidence !== undefined) data.confidence = updates.confidence;
    if (updates.truthLevel !== undefined) data.truthLevel = updates.truthLevel;
    if (updates.relevance !== undefined) data.relevance = updates.relevance;
    if (updates.utility !== undefined) data.utility = updates.utility;
    if (updates.scope !== undefined) data.scope = updates.scope;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.source !== undefined) data.source = updates.source;
    if (updates.sourceType !== undefined) data.sourceType = updates.sourceType;
    if (updates.evidence !== undefined) data.evidence = JSON.stringify(updates.evidence);

    await db.memory.update({
      where: { id: memoryId },
      data,
    });
  }

  /**
   * Invalidate a memory with a reason stored in evidence.
   */
  async invalidate(memoryId: string, reason: string): Promise<void> {
    const mem = await db.memory.findUnique({ where: { id: memoryId } });
    if (!mem) throw new Error(`Memory ${memoryId} not found`);

    const evidence = mem.evidence ? JSON.parse(mem.evidence) : {};
    evidence.invalidatedReason = reason;
    evidence.invalidatedAt = new Date().toISOString();

    await db.memory.update({
      where: { id: memoryId },
      data: {
        status: "INVALIDATED",
        confidence: 0,
        relevance: 0,
        evidence: JSON.stringify(evidence),
      },
    });
  }

  /**
   * Verify a memory: re-check confidence and truth level.
   * If the memory has supporting evidence, boost confidence; otherwise reduce it.
   */
  async verify(memoryId: string): Promise<{
    confidence: number;
    truthLevel: TruthLevel;
    verified: boolean;
  }> {
    const mem = await db.memory.findUnique({ where: { id: memoryId } });
    if (!mem) throw new Error(`Memory ${memoryId} not found`);

    let newConfidence = mem.confidence;
    let newTruthLevel = mem.truthLevel as TruthLevel;

    // Evaluate evidence quality
    const evidence = mem.evidence ? JSON.parse(mem.evidence) : {};
    const hasProvenance = Array.isArray(evidence.provenance) && evidence.provenance.length > 0;
    const hasSource = !!mem.source;
    const hasData = !!evidence.data;

    const evidenceScore = (Number(hasProvenance) + Number(hasSource) + Number(hasData)) / 3;

    if (evidenceScore >= 0.66) {
      // Strong evidence: boost confidence and potentially upgrade truth level
      newConfidence = Math.min(1.0, newConfidence + 0.1);
      if (newTruthLevel === "ESTIMATED" && evidenceScore >= 0.9) {
        newTruthLevel = "VERIFIED";
      } else if (newTruthLevel === "INFERRED" && evidenceScore >= 0.8) {
        newTruthLevel = "ESTIMATED";
      }
    } else if (evidenceScore <= 0.33) {
      // Weak evidence: reduce confidence
      newConfidence = Math.max(0, newConfidence - 0.1);
      if (newTruthLevel === "VERIFIED") {
        newTruthLevel = "ESTIMATED";
      }
    }

    await db.memory.update({
      where: { id: memoryId },
      data: {
        confidence: newConfidence,
        truthLevel: newTruthLevel,
        lastVerified: new Date(),
      },
    });

    return {
      confidence: newConfidence,
      truthLevel: newTruthLevel,
      verified: newTruthLevel === "VERIFIED" || newTruthLevel === "OBSERVED",
    };
  }

  /**
   * Get the most relevant memories for a given domain and optional query.
   * Filters by effective relevance (relevance * confidence, adjusted for decay).
   */
  async getRelevant(
    domain: string,
    query?: string,
    limit: number = 10,
    agentId?: string
  ): Promise<unknown[]> {
    const effectiveAgentId = agentId || this.defaultAgentId;

    const where: Record<string, unknown> = {
      agentId: effectiveAgentId,
      domain,
      status: { in: ["ACTIVE", "CONSOLIDATED"] },
      relevance: { gte: 0.1 },
    };

    if (query) {
      where.content = { contains: query };
    }

    const memories = await db.memory.findMany({
      where,
      orderBy: [
        { confidence: "desc" },
        { relevance: "desc" },
      ],
      take: limit * 2, // Over-fetch to apply decay scoring
    });

    // Score by effective relevance: relevance * confidence * (1 - decay)
    const scored = memories.map((m) => {
      const effectiveRelevance = m.relevance * m.confidence * Math.max(0, 1 - m.decay);
      return {
        ...m,
        content: JSON.parse(m.content),
        evidence: m.evidence ? JSON.parse(m.evidence) : null,
        effectiveRelevance,
      };
    });

    scored.sort((a, b) => b.effectiveRelevance - a.effectiveRelevance);

    return scored.slice(0, limit);
  }

  /**
   * Get a single memory by ID.
   */
  async get(memoryId: string): Promise<unknown | null> {
    const mem = await db.memory.findUnique({ where: { id: memoryId } });
    if (!mem) return null;

    return {
      ...mem,
      content: JSON.parse(mem.content),
      evidence: mem.evidence ? JSON.parse(mem.evidence) : null,
    };
  }

  /**
   * Delete a memory permanently.
   */
  async delete(memoryId: string): Promise<void> {
    await db.memory.delete({ where: { id: memoryId } });
  }

  /**
   * Get memory statistics for a given agent.
   */
  async getStats(agentId?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
    byStatus: Record<string, number>;
    avgConfidence: number;
    avgRelevance: number;
  }> {
    const effectiveAgentId = agentId || this.defaultAgentId;

    const memories = await db.memory.findMany({
      where: { agentId: effectiveAgentId },
    });

    const byType: Record<string, number> = {};
    const byDomain: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalConfidence = 0;
    let totalRelevance = 0;

    for (const m of memories) {
      byType[m.type] = (byType[m.type] || 0) + 1;
      byDomain[m.domain] = (byDomain[m.domain] || 0) + 1;
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
      totalConfidence += m.confidence;
      totalRelevance += m.relevance;
    }

    return {
      total: memories.length,
      byType,
      byDomain,
      byStatus,
      avgConfidence: memories.length > 0 ? totalConfidence / memories.length : 0,
      avgRelevance: memories.length > 0 ? totalRelevance / memories.length : 0,
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  /**
   * Compute simple Jaccard-like similarity between two JSON strings.
   * Uses normalized token overlap for approximate matching.
   */
  private computeSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;

    const tokensA = this.tokenize(a);
    const tokensB = this.tokenize(b);

    if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) intersection++;
    }

    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Tokenize a JSON string for similarity comparison.
   * Extracts meaningful tokens (keys and string values).
   */
  private tokenize(str: string): Set<string> {
    try {
      const obj = JSON.parse(str);
      const tokens = new Set<string>();

      const walk = (o: unknown, prefix: string = "") => {
        if (typeof o === "string") {
          tokens.add(`${prefix}:${o.toLowerCase()}`);
        } else if (typeof o === "number" || typeof o === "boolean") {
          tokens.add(`${prefix}:${o}`);
        } else if (Array.isArray(o)) {
          for (let i = 0; i < o.length; i++) {
            walk(o[i], `${prefix}[${i}]`);
          }
        } else if (o && typeof o === "object") {
          for (const [key, val] of Object.entries(o as Record<string, unknown>)) {
            tokens.add(`${prefix}.${key}`);
            walk(val, `${prefix}.${key}`);
          }
        }
      };

      walk(obj);
      return tokens;
    } catch {
      // Fallback: simple word-level tokenization
      return new Set(str.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    }
  }

  /**
   * Merge two evidence objects, combining provenance lists.
   */
  private mergeEvidence(a: MemoryEvidence, b: MemoryEvidence): MemoryEvidence {
    const provenanceA = Array.isArray(a.provenance) ? a.provenance : [];
    const provenanceB = Array.isArray(b.provenance) ? b.provenance : [];

    return {
      source: b.source || a.source,
      timestamp: b.timestamp || a.timestamp,
      data: b.data ?? a.data,
      provenance: [...new Set([...provenanceA, ...provenanceB])],
    };
  }

  /**
   * Return the higher of two truth levels.
   */
  private higherTruthLevel(a: TruthLevel, b: TruthLevel): TruthLevel {
    return TRUTH_LEVEL_ORDER[a] >= TRUTH_LEVEL_ORDER[b] ? a : b;
  }
}

// Singleton instance for convenience
export const memoryManager = new MemoryManager();
