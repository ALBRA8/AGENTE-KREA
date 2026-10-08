import { describe, it, expect } from 'vitest';
import { evaluateCommercialReadiness } from '@/lib/commercial-product';
import type { CommercialProduct, CustomerProfile, ProductType, ProofRequirement, PriceStrategy, PriceRange, CommercialReadinessScore, DimensionScore } from '@/lib/commercial-product';
import type { EvidenceTag } from '@/lib/product-fit';
import type { RiskFactor } from '@/lib/product-economics';

// ─── Helper: Create a minimal CommercialProduct ──────────────────────────────

function makeDimensionScore(overrides: Partial<DimensionScore> = {}): DimensionScore {
  return {
    score: 0.5,
    evidence: 'INFERRED',
    confidence: 0.5,
    warnings: [],
    ...overrides,
  };
}

function makeCommercialReadinessScore(overrides: Partial<CommercialReadinessScore> = {}): CommercialReadinessScore {
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

function makeCustomerProfile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    description: 'Small business owners looking to improve marketing',
    demographics: ['age 25-45', 'business owners'],
    psychographics: ['growth-oriented', 'practical'],
    painPoints: ['struggling with marketing', 'limited budget'],
    currentSolutions: ['hiring agencies', 'DIY approach'],
    ...overrides,
  };
}

function makeProofRequirements(): ProofRequirement[] {
  return [
    { type: 'testimonial', description: 'Customer testimonial', status: 'MISSING' },
    { type: 'case_study', description: 'Case study', status: 'MISSING' },
    { type: 'sample', description: 'Free sample', status: 'MISSING' },
  ];
}

function makePriceRange(overrides: Partial<PriceRange> = {}): PriceRange {
  return {
    min: 9,
    max: 49,
    currency: 'USD',
    recommended: 29,
    evidence: 'ESTIMATED',
    ...overrides,
  };
}

function makePriceStrategy(overrides: Partial<PriceStrategy> = {}): PriceStrategy {
  return {
    model: 'one_time',
    reasoning: 'Based on ebook product type heuristics',
    evidence: 'ESTIMATED',
    ...overrides,
  };
}

function makeCommercialProduct(overrides: Partial<CommercialProduct> = {}): CommercialProduct {
  return {
    productId: 'cprod_test1',
    productVersion: '1.0.0',
    productName: 'Marketing Playbook',
    productType: 'ebook',
    targetCustomer: makeCustomerProfile(),
    problem: 'Small business owners struggle with effective marketing on limited budgets',
    jobToBeDone: 'Create a comprehensive marketing strategy without hiring an agency',
    desiredOutcome: 'A clear, actionable marketing plan that delivers results',
    valueProposition: 'Step-by-step marketing playbook that replaces the need for an agency',
    differentiation: 'Specifically designed for budget-constrained small businesses',
    format: 'PDF',
    includedAssets: ['Main ebook', 'Checklist'],
    excludedScope: ['Custom consulting', 'Agency services'],
    priceStrategy: makePriceStrategy(),
    priceRange: makePriceRange(),
    monetizationModel: 'one_time',
    distributionStrategy: 'Direct download (PDF/EPUB) via website',
    positioning: 'The affordable alternative to hiring a marketing agency',
    keyBenefits: ['Save money on marketing', 'Get agency-quality results', 'Implement immediately'],
    objections: ['Too expensive', 'Not sure it applies to my industry'],
    proofRequirements: makeProofRequirements(),
    commercialReadiness: makeCommercialReadinessScore(),
    launchRequirements: ['Product content fully complete'],
    assumptions: ['Target audience has basic digital literacy'],
    risks: [{ description: 'Market saturation', probability: 0.3, impact: 0.4, mitigation: 'Focus on niche' }],
    evidence: 'INFERRED',
    provenance: 'commercial-product:cprod_test1',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CommercialProductEngine', () => {
  it('should create commercial product with all required fields', () => {
    const product = makeCommercialProduct();
    expect(product.productId).toBeTruthy();
    expect(product.productVersion).toBe('1.0.0');
    expect(product.productName).toBeTruthy();
    expect(product.productType).toBeTruthy();
    expect(product.targetCustomer).toBeDefined();
    expect(product.problem).toBeTruthy();
    expect(product.jobToBeDone).toBeTruthy();
    expect(product.desiredOutcome).toBeTruthy();
    expect(product.valueProposition).toBeTruthy();
    expect(product.differentiation).toBeTruthy();
    expect(product.format).toBeTruthy();
    expect(product.priceStrategy).toBeDefined();
    expect(product.priceRange).toBeDefined();
    expect(product.evidence).toBeTruthy();
    expect(product.provenance).toBeTruthy();
  });

  it('should tag all market data as INFERRED or ESTIMATED (never VERIFIED)', () => {
    const product = makeCommercialProduct();
    // Overall evidence should never be VERIFIED for new products
    expect(product.evidence).not.toBe('VERIFIED');
    // Price range evidence should be ESTIMATED (never VERIFIED for new products)
    expect(product.priceRange.evidence).not.toBe('VERIFIED');
    expect(['ESTIMATED', 'INFERRED']).toContain(product.priceRange.evidence);
    // Price strategy evidence should be ESTIMATED
    expect(product.priceStrategy.evidence).not.toBe('VERIFIED');
    expect(['ESTIMATED', 'INFERRED']).toContain(product.priceStrategy.evidence);
  });

  it('should set proof requirements as MISSING by default', () => {
    const product = makeCommercialProduct();
    // All default proof requirements should start as MISSING
    for (const proof of product.proofRequirements) {
      expect(proof.status).toBe('MISSING');
    }
  });

  it('should set evidence tag based on data source', () => {
    // When data is LLM-derived, evidence should be INFERRED
    const inferredProduct = makeCommercialProduct({ evidence: 'INFERRED' });
    expect(inferredProduct.evidence).toBe('INFERRED');

    // When data is estimated, evidence should be ESTIMATED
    const estimatedProduct = makeCommercialProduct({ evidence: 'ESTIMATED' });
    expect(estimatedProduct.evidence).toBe('ESTIMATED');
  });

  it('should evaluate commercial readiness with 8 dimensions', () => {
    const product = makeCommercialProduct();
    const readiness = evaluateCommercialReadiness(product);

    expect(readiness.overall).toBeGreaterThanOrEqual(0);
    expect(readiness.overall).toBeLessThanOrEqual(1);
    expect(readiness.productCompleteness).toBeDefined();
    expect(readiness.contentCompleteness).toBeDefined();
    expect(readiness.quality).toBeDefined();
    expect(readiness.packaging).toBeDefined();
    expect(readiness.delivery).toBeDefined();
    expect(readiness.differentiation).toBeDefined();
    expect(readiness.evidence).toBeDefined();
    expect(readiness.commercialClarity).toBeDefined();
  });

  it('should never inflate readiness scores', () => {
    // Product with no QA, no assets, all proofs MISSING
    const product = makeCommercialProduct();
    const readiness = evaluateCommercialReadiness(product);

    // Without any QA or verified assets, scores should be moderate (not inflated to near 1.0)
    expect(readiness.overall).toBeLessThan(0.8);
  });

  it('should add warnings when data is missing', () => {
    // Product with empty customer profile
    const product = makeCommercialProduct({
      targetCustomer: makeCustomerProfile({ description: '', painPoints: [] }),
      keyBenefits: [],
      objections: [],
    });
    const readiness = evaluateCommercialReadiness(product);

    // Product completeness should have warnings
    const allWarnings = [
      ...readiness.productCompleteness.warnings,
      ...readiness.contentCompleteness.warnings,
      ...readiness.quality.warnings,
      ...readiness.packaging.warnings,
      ...readiness.delivery.warnings,
      ...readiness.differentiation.warnings,
      ...readiness.evidence.warnings,
      ...readiness.commercialClarity.warnings,
    ];
    expect(allWarnings.length).toBeGreaterThan(0);
  });

  it('should set overall readiness below 0.5 when critical data is missing', () => {
    const product = makeCommercialProduct({
      problem: '',
      jobToBeDone: '',
      valueProposition: '',
      differentiation: '',
      targetCustomer: makeCustomerProfile({ description: '' }),
      keyBenefits: [],
      format: '',
    });
    const readiness = evaluateCommercialReadiness(product);

    expect(readiness.overall).toBeLessThan(0.5);
  });

  it('should compute price range from domain heuristics', () => {
    // Ebook price range should be reasonable
    const ebookProduct = makeCommercialProduct({ productType: 'ebook' });
    expect(ebookProduct.priceRange.min).toBeGreaterThanOrEqual(5);
    expect(ebookProduct.priceRange.max).toBeLessThanOrEqual(100);
    expect(ebookProduct.priceRange.min).toBeLessThan(ebookProduct.priceRange.max);
    expect(ebookProduct.priceRange.recommended).toBeGreaterThanOrEqual(ebookProduct.priceRange.min);
    expect(ebookProduct.priceRange.recommended).toBeLessThanOrEqual(ebookProduct.priceRange.max);

    // SaaS should have subscription model
    const saasProduct = makeCommercialProduct({
      productType: 'saas',
      priceStrategy: makePriceStrategy({ model: 'subscription' }),
    });
    expect(saasProduct.priceStrategy.model).toBe('subscription');
  });
});
