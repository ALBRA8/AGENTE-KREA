import { describe, it, expect } from 'vitest';
import { createProductPackaging } from '@/lib/product-packaging';
import type { AvailableAsset } from '@/lib/product-packaging';
import type { CommercialProduct, CustomerProfile, PriceStrategy, PriceRange, CommercialReadinessScore, DimensionScore, ProofRequirement } from '@/lib/commercial-product';
import type { EvidenceTag } from '@/lib/product-fit';
import type { RiskFactor } from '@/lib/product-economics';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeDimensionScore(overrides: Partial<DimensionScore> = {}): DimensionScore {
  return { score: 0.5, evidence: 'INFERRED', confidence: 0.5, warnings: [], ...overrides };
}

function makeReadinessScore(overrides: Partial<CommercialReadinessScore> = {}): CommercialReadinessScore {
  return {
    overall: 0.5,
    productCompleteness: makeDimensionScore(),
    contentCompleteness: makeDimensionScore(),
    quality: makeDimensionScore(),
    packaging: makeDimensionScore(),
    delivery: makeDimensionScore(),
    differentiation: makeDimensionScore(),
    evidence: makeDimensionScore(),
    commercialClarity: makeDimensionScore(),
    ...overrides,
  };
}

function makeCommercialProduct(overrides: Partial<CommercialProduct> = {}): CommercialProduct {
  return {
    productId: 'cprod_pkg_test',
    productVersion: '1.0.0',
    productName: 'Marketing Playbook',
    productType: 'ebook',
    targetCustomer: {
      description: 'Small business owners',
      demographics: ['age 25-45'],
      psychographics: ['growth-oriented'],
      painPoints: ['marketing challenges'],
      currentSolutions: ['agencies'],
    },
    problem: 'Small business owners struggle with marketing',
    jobToBeDone: 'Create a marketing strategy',
    desiredOutcome: 'Effective marketing plan',
    valueProposition: 'Step-by-step marketing playbook',
    differentiation: 'Designed for budget-constrained businesses',
    format: 'PDF',
    includedAssets: ['Main ebook', 'Checklist'],
    excludedScope: ['Consulting'],
    priceStrategy: { model: 'one_time', reasoning: 'Ebook pricing', evidence: 'ESTIMATED' },
    priceRange: { min: 9, max: 49, currency: 'USD', recommended: 29, evidence: 'ESTIMATED' },
    monetizationModel: 'one_time',
    distributionStrategy: 'Direct download',
    positioning: 'Affordable marketing guide',
    keyBenefits: ['Save money', 'Better results', 'Quick implementation'],
    objections: ['Too expensive'],
    proofRequirements: [
      { type: 'testimonial', description: 'Customer testimonial', status: 'MISSING' },
      { type: 'sample', description: 'Free sample', status: 'MISSING' },
    ],
    commercialReadiness: makeReadinessScore(),
    launchRequirements: [],
    assumptions: [],
    risks: [],
    evidence: 'INFERRED',
    provenance: 'test',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ProductPackagingEngine', () => {
  it('should create packaging with core product', () => {
    const product = makeCommercialProduct();
    const packaging = createProductPackaging(product);

    expect(packaging.packagingId).toBeTruthy();
    expect(packaging.packagingId).toMatch(/^pkg_/);
    expect(packaging.productId).toBe(product.productId);
    expect(packaging.coreProduct).toBeDefined();
    expect(packaging.coreProduct.description).toBeTruthy();
    expect(packaging.coreProduct.included.length).toBeGreaterThan(0);
    expect(packaging.coreProduct.format).toBe(product.format);
  });

  it('should include bonuses only when they add value', () => {
    const product = makeCommercialProduct({ productType: 'ebook' });
    const packaging = createProductPackaging(product);

    // Ebook should have a Quick Start Guide bonus (adds value)
    expect(packaging.bonuses.length).toBeGreaterThan(0);
    expect(packaging.bonuses.some(b => b.name === 'Quick Start Guide')).toBe(true);

    // Each bonus should have a value explanation
    for (const bonus of packaging.bonuses) {
      expect(bonus.value).toBeTruthy();
      expect(bonus.included).toBe(true);
    }
  });

  it('should define scope with included and excluded', () => {
    const product = makeCommercialProduct();
    const packaging = createProductPackaging(product);

    expect(packaging.scope).toBeDefined();
    expect(packaging.scope.included).toEqual(product.includedAssets);
    expect(packaging.scope.excluded).toEqual(product.excludedScope);
    expect(packaging.scope.boundaries).toBeTruthy();
  });

  it('should set delivery information', () => {
    const product = makeCommercialProduct({ productType: 'ebook' });
    const packaging = createProductPackaging(product);

    expect(packaging.delivery).toBeDefined();
    expect(packaging.delivery.method).toBeTruthy();
    expect(packaging.delivery.format.length).toBeGreaterThan(0);
    expect(packaging.delivery.access).toBeTruthy();
  });

  it('should create usage guide', () => {
    const product = makeCommercialProduct({ productType: 'ebook' });
    const packaging = createProductPackaging(product);

    expect(packaging.usage).toBeDefined();
    expect(packaging.usage.steps.length).toBeGreaterThan(0);
    expect(packaging.usage.prerequisites.length).toBeGreaterThan(0);
    expect(packaging.usage.timeToValue).toBeTruthy();
  });

  it('should set expected outcome with honest evidence', () => {
    const product = makeCommercialProduct();
    const packaging = createProductPackaging(product);

    expect(packaging.expectedOutcome).toBeDefined();
    expect(packaging.expectedOutcome.description).toBeTruthy();
    // Evidence should never be VERIFIED for estimated outcomes
    expect(['INFERRED', 'NOT_VERIFIED', 'ESTIMATED']).toContain(packaging.expectedOutcome.evidence);
  });

  it('should include disclaimers when evidence is insufficient', () => {
    // Product with all proofs MISSING → insufficient evidence
    const product = makeCommercialProduct({
      proofRequirements: [
        { type: 'testimonial', description: 'Testimonial', status: 'MISSING' },
        { type: 'case_study', description: 'Case study', status: 'MISSING' },
      ],
    });
    const packaging = createProductPackaging(product);

    // Should have disclaimers about insufficient evidence
    expect(packaging.expectedOutcome.disclaimers.length).toBeGreaterThan(0);
    // Should mention that proof is not available
    const disclaimerText = packaging.expectedOutcome.disclaimers.join(' ');
    expect(disclaimerText.length).toBeGreaterThan(10);
  });

  it('should NOT invent pricing tiers without value differentiation', () => {
    // Simple product with no bonus content, single format → should have only standard version
    const product = makeCommercialProduct({
      productType: 'checklist',
      format: 'PDF',
      includedAssets: ['Main checklist'],
    });
    const packaging = createProductPackaging(product);

    // Should have at least one version (Standard)
    expect(packaging.versions.length).toBeGreaterThanOrEqual(1);
    expect(packaging.versions[0].name).toBe('Standard');

    // Without real value differentiation, should not have Premium tier
    const hasPremium = packaging.versions.some(v => v.name === 'Premium');
    // If premium exists, it must have more included items than standard
    if (hasPremium) {
      const premium = packaging.versions.find(v => v.name === 'Premium')!;
      const standard = packaging.versions.find(v => v.name === 'Standard')!;
      expect(premium.included.length).toBeGreaterThan(standard.included.length);
    }
  });
});
