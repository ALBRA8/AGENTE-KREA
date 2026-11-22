import { describe, it, expect } from 'vitest';
import {
  generateLaunchPackage,
  validateLaunchPackage,
  getIntegrityIssues,
} from '@/lib/launch-package';
import type { LaunchPackage, ProductDefinition, OfferArchitecture } from '@/lib/launch-package';
import type { CommercialReadiness, ReadinessState, CommercialReadinessScore, DimensionScore } from '@/lib/commercial-readiness';
import type { ProductQAReport, Packaging } from '@/lib/product-qa';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeDimensionScore(overrides: Partial<DimensionScore> = {}): DimensionScore {
  return { score: 0.5, evidence: 'INFERRED', confidence: 0.5, warnings: [], ...overrides };
}

function makeReadinessScore(overrides: Partial<CommercialReadinessScore> = {}): CommercialReadinessScore {
  return {
    overall: 0.7,
    productCompleteness: makeDimensionScore({ score: 0.7 }),
    contentCompleteness: makeDimensionScore({ score: 0.7 }),
    quality: makeDimensionScore({ score: 0.7 }),
    packaging: makeDimensionScore({ score: 0.7 }),
    delivery: makeDimensionScore({ score: 0.7 }),
    differentiation: makeDimensionScore({ score: 0.7 }),
    evidence: makeDimensionScore({ score: 0.7 }),
    commercialClarity: makeDimensionScore({ score: 0.7 }),
    ...overrides,
  };
}

function makeProductDefinition(overrides: Partial<ProductDefinition> = {}): ProductDefinition {
  return {
    name: 'Growth Playbook',
    type: 'guide',
    description: 'A practical guide for scaling businesses',
    version: '1.0.0',
    targetCustomer: 'Entrepreneurs and small business owners',
    painPoints: ['Scaling challenges', 'Limited budget for consultants'],
    valueProposition: 'Step-by-step growth framework',
    differentiation: 'Based on real-world case studies',
    price: { amount: 29, currency: 'USD', model: 'one_time' },
    ...overrides,
  };
}

function makePackaging(overrides: Partial<Packaging> = {}): Packaging {
  return {
    deliveryFormat: 'PDF',
    accessMethod: 'Download link',
    usageGuide: 'Follow the steps',
    prerequisites: ['PDF reader'],
    supportInfo: 'Email support',
    ...overrides,
  };
}

function makeReadiness(overrides: Partial<CommercialReadiness> = {}): CommercialReadiness {
  return {
    productId: 'prod_lp_test',
    version: '1.0.0',
    state: 'READY_FOR_SALE',
    score: makeReadinessScore(),
    requirements: [],
    blockers: [],
    evaluatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('LaunchPackage', () => {
  it('should generate launch package with all required fields', () => {
    const productDef = makeProductDefinition();
    const packaging = makePackaging();
    const readiness = makeReadiness();

    const lp = generateLaunchPackage(productDef, packaging, undefined, undefined, undefined, readiness);

    expect(lp.packageId).toBeTruthy();
    expect(lp.productId).toBeTruthy();
    expect(lp.version).toBe('1.0.0');
    expect(lp.product).toBeDefined();
    expect(lp.offer).toBeDefined();
    expect(lp.positioning).toBeTruthy();
    expect(lp.targetCustomer).toBeDefined();
    expect(lp.corePromise).toBeTruthy();
    expect(lp.benefits.length).toBeGreaterThan(0);
    expect(lp.price).toBeDefined();
    expect(lp.delivery).toBeDefined();
    expect(lp.faq.length).toBeGreaterThan(0);
    expect(lp.objections.length).toBeGreaterThan(0);
    expect(lp.cta).toBeTruthy();
    expect(lp.proofRequirements.length).toBeGreaterThan(0);
    expect(lp.disclaimers.length).toBeGreaterThan(0);
    expect(lp.integrityCheck).toBeDefined();
    expect(lp.evidence).toBeTruthy();
    expect(lp.generatedAt).toBeDefined();
  });

  it('should validate a complete launch package', () => {
    const productDef = makeProductDefinition();
    const packaging = makePackaging();
    const readiness = makeReadiness();

    const lp = generateLaunchPackage(productDef, packaging, undefined, undefined, undefined, readiness);
    const result = validateLaunchPackage(lp);

    // A complete, honest package should be valid
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('should invalidate package with missing fields', () => {
    const productDef = makeProductDefinition({
      description: '',
      valueProposition: '',
      differentiation: '',
    });
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, undefined);
    const result = validateLaunchPackage(lp);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should detect fake testimonials in integrity check', () => {
    const productDef = makeProductDefinition({
      description: 'This product changed my life! Works like magic!',
    });
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, undefined);

    const issues = getIntegrityIssues(lp);
    expect(issues.some(i => i.includes('testimonial') || i.includes('Fake'))).toBe(true);
  });

  it('should detect invented statistics', () => {
    const productDef = makeProductDefinition({
      description: '95% of users report incredible results within days',
    });
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, undefined);

    const issues = getIntegrityIssues(lp);
    expect(issues.some(i => i.includes('statistics') || i.includes('Invented'))).toBe(true);
  });

  it('should detect false authority claims', () => {
    const productDef = makeProductDefinition({
      differentiation: 'Clinically proven and doctor recommended approach',
    });
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, undefined);

    const issues = getIntegrityIssues(lp);
    expect(issues.some(i => i.includes('authority') || i.includes('False'))).toBe(true);
  });

  it('should detect guaranteed results without evidence', () => {
    const productDef = makeProductDefinition({
      valueProposition: 'Guaranteed you will double your income',
    });
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, undefined);

    const issues = getIntegrityIssues(lp);
    expect(issues.some(i => i.includes('guaranteed') || i.includes('Guaranteed'))).toBe(true);
  });

  it('should pass integrity for honest package', () => {
    const productDef = makeProductDefinition();
    const readiness = makeReadiness();
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, readiness);

    expect(lp.integrityCheck.passes).toBe(true);
    expect(lp.integrityCheck.issues.length).toBe(0);
  });

  it('should include disclaimers when evidence insufficient', () => {
    const productDef = makeProductDefinition();
    // No readiness → evidence is insufficient
    const lp = generateLaunchPackage(productDef, undefined, undefined, undefined, undefined, undefined);

    expect(lp.disclaimers.length).toBeGreaterThan(0);
    // Should have the standard results disclaimer
    expect(lp.disclaimers.some(d => d.includes('Results may vary'))).toBe(true);
  });

  it('should set CTA based on readiness state', () => {
    // READY_FOR_SALE → direct CTA
    const readiness4sale = makeReadiness({ state: 'READY_FOR_SALE' });
    const lp1 = generateLaunchPackage(makeProductDefinition(), undefined, undefined, undefined, undefined, readiness4sale);
    expect(lp1.cta).toBeTruthy();

    // NOT_READY → soft CTA
    const readinessNotReady = makeReadiness({ state: 'NOT_READY' });
    const lp2 = generateLaunchPackage(makeProductDefinition(), undefined, undefined, undefined, undefined, readinessNotReady);
    expect(lp2.cta).toBeTruthy();
    expect(lp2.cta).toContain('development');
  });
});
