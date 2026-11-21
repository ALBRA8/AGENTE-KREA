import { describe, it, expect } from 'vitest';
import {
  evaluateReadiness,
  transitionReadiness,
  getReadinessRequirements,
} from '@/lib/commercial-readiness';
import { ReadinessTransitionError } from '@/lib/commercial-readiness';
import type { CommercialReadiness, ReadinessState, CommercialReadinessScore, DimensionScore, ReadinessRequirement, ProductAssets } from '@/lib/commercial-readiness';
import type { ProductQAReport, CommercialProduct as QACommercialProduct, Packaging } from '@/lib/product-qa';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeQAReport(overrides: Partial<ProductQAReport> = {}): ProductQAReport {
  return {
    reportId: 'qa_test',
    productId: 'prod_cr_test',
    version: '1.0.0',
    overallPassed: true,
    overallScore: 0.8,
    artifactQA: { category: 'artifact', passed: true, score: 0.9, checks: [], issues: [] },
    contentQA: { category: 'content', passed: true, score: 0.8, checks: [], issues: [] },
    structureQA: { category: 'structure', passed: true, score: 0.85, checks: [], issues: [] },
    visualQA: { category: 'visual', passed: true, score: 0.75, checks: [], issues: [] },
    commercialQA: { category: 'commercial', passed: true, score: 0.7, checks: [], issues: [] },
    deliveryQA: { category: 'delivery', passed: true, score: 0.8, checks: [], issues: [] },
    criticalIssues: [],
    warnings: [],
    evidence: 'VERIFIED',
    inspectedAt: new Date(),
    ...overrides,
  };
}

function makeCommercialProductQA(overrides: Partial<QACommercialProduct> = {}): QACommercialProduct {
  return {
    hasPricing: true,
    hasTargetCustomer: true,
    hasValueProposition: true,
    hasProblemStatement: true,
    hasDifferentiation: true,
    testimonials: [],
    claims: ['Quality tested'],
    ...overrides,
  };
}

function makePackaging(overrides: Partial<Packaging> = {}): Packaging {
  return {
    deliveryFormat: 'PDF',
    accessMethod: 'Download link',
    usageGuide: 'Follow the guide',
    prerequisites: ['PDF reader'],
    supportInfo: 'Email support',
    ...overrides,
  };
}

function makeProductAssets(overrides: Partial<ProductAssets> = {}): ProductAssets {
  return {
    artifactCount: 3,
    hasBlueprint: true,
    hasSpecification: true,
    hasEconomics: true,
    hasArchitecture: true,
    ...overrides,
  };
}

function makeReadiness(overrides: Partial<CommercialReadiness> = {}): CommercialReadiness {
  return {
    productId: 'prod_cr_test',
    version: '1.0.0',
    state: 'NOT_READY',
    score: {
      overall: 0.2,
      productCompleteness: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      contentCompleteness: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      quality: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      packaging: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      delivery: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      differentiation: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      evidence: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
      commercialClarity: { score: 0.2, evidence: 'NOT_VERIFIED', confidence: 0.2, warnings: [] },
    },
    requirements: [],
    blockers: [],
    evaluatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CommercialReadiness', () => {
  it('should evaluate readiness with NOT_READY for low scores', () => {
    // No assets → product completeness = 0
    const qa = makeQAReport({ overallScore: 0.1, contentQA: { category: 'content', passed: false, score: 0.1, checks: [], issues: [] } });
    const readiness = evaluateReadiness('prod_low', '1.0.0', qa, undefined, undefined, undefined);

    expect(readiness.state).toBe('NOT_READY');
    expect(readiness.score.overall).toBeLessThan(0.3);
  });

  it('should evaluate readiness with REQUIRES_REPAIR for moderate scores', () => {
    const qa = makeQAReport({ overallScore: 0.4, overallPassed: false, contentQA: { category: 'content', passed: false, score: 0.4, checks: [], issues: [] } });
    const commProd = makeCommercialProductQA({ hasPricing: true, hasTargetCustomer: true, hasValueProposition: true, hasProblemStatement: false, hasDifferentiation: false });
    const assets = makeProductAssets({ hasBlueprint: true, hasArchitecture: true, hasSpecification: true, hasEconomics: false, artifactCount: 2 });
    const readiness = evaluateReadiness('prod_mod', '1.0.0', qa, commProd, undefined, assets);

    expect(readiness.state).toBe('REQUIRES_REPAIR');
  });

  it('should evaluate readiness with READY_FOR_VALIDATION for good scores', () => {
    const qa = makeQAReport({ overallScore: 0.6, contentQA: { category: 'content', passed: true, score: 0.6, checks: [], issues: [] } });
    const commProd = makeCommercialProductQA();
    const packaging = makePackaging();
    const assets = makeProductAssets();
    const readiness = evaluateReadiness('prod_good', '1.0.0', qa, commProd, packaging, assets);

    expect(readiness.score.overall).toBeGreaterThanOrEqual(0.5);
    expect(readiness.state === 'READY_FOR_VALIDATION' || readiness.state === 'READY_FOR_SALE').toBe(true);
  });

  it('should evaluate readiness with READY_FOR_SALE for complete products', () => {
    const qa = makeQAReport({ overallScore: 0.9, contentQA: { category: 'content', passed: true, score: 0.9, checks: [], issues: [] } });
    const commProd = makeCommercialProductQA();
    const packaging = makePackaging();
    const assets = makeProductAssets();
    const readiness = evaluateReadiness('prod_complete', '1.0.0', qa, commProd, packaging, assets);

    expect(readiness.score.overall).toBeGreaterThanOrEqual(0.7);
    expect(readiness.state).toBe('READY_FOR_SALE');
  });

  it('should allow valid state transitions', () => {
    const readiness = makeReadiness({ state: 'NOT_READY' });
    const updated = transitionReadiness(readiness, 'REQUIRES_REPAIR');
    expect(updated.state).toBe('REQUIRES_REPAIR');

    const updated2 = transitionReadiness(updated, 'ITERATING');
    expect(updated2.state).toBe('ITERATING');
  });

  it('should reject invalid state transitions', () => {
    const readiness = makeReadiness({ state: 'NOT_READY' });
    expect(() => {
      transitionReadiness(readiness, 'LAUNCHED');
    }).toThrow(ReadinessTransitionError);
  });

  it('should add warnings for missing data', () => {
    // No assets, no commercial product, no packaging → lots of warnings
    const qa = makeQAReport({ overallScore: 0.2, contentQA: { category: 'content', passed: false, score: 0.2, checks: [], issues: [] } });
    const readiness = evaluateReadiness('prod_warn', '1.0.0', qa, undefined, undefined, undefined);

    // Collect all warnings
    const allWarnings = [
      ...readiness.score.productCompleteness.warnings,
      ...readiness.score.contentCompleteness.warnings,
      ...readiness.score.quality.warnings,
      ...readiness.score.packaging.warnings,
      ...readiness.score.delivery.warnings,
      ...readiness.score.differentiation.warnings,
      ...readiness.score.evidence.warnings,
      ...readiness.score.commercialClarity.warnings,
    ];
    expect(allWarnings.length).toBeGreaterThan(0);
  });

  it('should never inflate scores', () => {
    // With no data at all, score should be very low
    const qa = makeQAReport({ overallScore: 0, contentQA: { category: 'content', passed: false, score: 0, checks: [], issues: [] } });
    const readiness = evaluateReadiness('prod_noinflate', '1.0.0', qa, undefined, undefined, undefined);

    // Overall should be low
    expect(readiness.score.overall).toBeLessThanOrEqual(0.3);
    // Each dimension should be between 0 and 1
    const dimensions = [
      readiness.score.productCompleteness.score,
      readiness.score.contentCompleteness.score,
      readiness.score.quality.score,
      readiness.score.packaging.score,
      readiness.score.delivery.score,
      readiness.score.differentiation.score,
      readiness.score.evidence.score,
      readiness.score.commercialClarity.score,
    ];
    for (const dim of dimensions) {
      expect(dim).toBeGreaterThanOrEqual(0);
      expect(dim).toBeLessThanOrEqual(1);
    }
  });
});
