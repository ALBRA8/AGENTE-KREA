import { describe, it, expect } from 'vitest';
import { createBlueprint, validateBlueprint } from '@/lib/product-blueprint';
import type { ProductBlueprint } from '@/lib/product-blueprint';
import type { CommercialProduct, CustomerProfile, PriceStrategy, PriceRange, CommercialReadinessScore, DimensionScore, ProofRequirement } from '@/lib/commercial-product';
import type { ProductArchitecture, ArchitectureComponent } from '@/lib/product-architecture';
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
    productId: 'cprod_bp_test',
    productVersion: '1.0.0',
    productName: 'Test Guide',
    productType: 'guide',
    targetCustomer: {
      description: 'Entrepreneurs seeking growth',
      demographics: ['age 25-45'],
      psychographics: ['ambitious'],
      painPoints: ['scaling challenges'],
      currentSolutions: ['consultants'],
    },
    problem: 'Entrepreneurs struggle to scale their businesses effectively',
    jobToBeDone: 'Create a scalable growth framework',
    desiredOutcome: 'Sustainable business growth',
    valueProposition: 'A proven growth framework for scaling businesses',
    differentiation: 'Based on real-world case studies and data',
    format: 'PDF',
    includedAssets: ['Main guide', 'Templates'],
    excludedScope: ['Personal coaching'],
    priceStrategy: { model: 'one_time', reasoning: 'Guide pricing', evidence: 'ESTIMATED' },
    priceRange: { min: 7, max: 39, currency: 'USD', recommended: 23, evidence: 'ESTIMATED' },
    monetizationModel: 'one_time',
    distributionStrategy: 'Direct download',
    positioning: 'The growth guide for scaling businesses',
    keyBenefits: ['Scale faster', 'Reduce costs', 'Improve efficiency'],
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

function makeArchitecture(overrides: Partial<ProductArchitecture> = {}): ProductArchitecture {
  return {
    productType: 'guide',
    architecture: 'Book-style architecture with chapters',
    components: [
      { name: 'Introduction', type: 'section', description: 'Product overview', dependencies: [] },
      { name: 'Core Framework', type: 'section', description: 'Main content', dependencies: ['Introduction'] },
      { name: 'Templates', type: 'section', description: 'Template pack', dependencies: ['Core Framework'] },
    ],
    dependencies: [],
    constraints: [],
    estimatedDuration: '2 weeks',
    technologyStack: ['PDF', 'Markdown'],
    evidence: 'INFERRED',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ProductBlueprint', () => {
  it('should create blueprint from commercial product + architecture', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    expect(blueprint.blueprintId).toBeTruthy();
    expect(blueprint.blueprintId).toMatch(/^bp_/);
    expect(blueprint.productId).toBe(product.productId);
    expect(blueprint.version).toBe(product.productVersion);
    expect(blueprint.type).toBe(product.productType);
    expect(blueprint.customer).toEqual(product.targetCustomer);
    expect(blueprint.problem).toBe(product.problem);
    expect(blueprint.jobToBeDone).toBe(product.jobToBeDone);
    expect(blueprint.desiredOutcome).toBe(product.desiredOutcome);
    expect(blueprint.valueProposition).toBe(product.valueProposition);
  });

  it('should derive structure from architecture chapters', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    // Should have sections derived from components
    expect(blueprint.structure.sections.length).toBeGreaterThan(0);
    // Should have total estimated words
    expect(blueprint.structure.totalEstimatedWords).toBeGreaterThan(0);
    // Should have total estimated pages
    expect(blueprint.structure.totalEstimatedPages).toBeGreaterThan(0);
    // Format spec should match product format
    expect(blueprint.structure.formatSpec).toBe(product.format);
  });

  it('should validate a complete blueprint as valid', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    const result = validateBlueprint(blueprint);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should invalidate blueprint with missing MUST requirements', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    // Set a MUST requirement with empty description
    blueprint.contentRequirements.push({
      id: 'creq_test',
      description: '',
      priority: 'MUST',
      status: 'PENDING',
    });

    const result = validateBlueprint(blueprint);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('MUST'))).toBe(true);
  });

  it('should invalidate blueprint with no sections', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    // Remove all sections
    blueprint.structure.sections = [];

    const result = validateBlueprint(blueprint);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('no sections'))).toBe(true);
  });

  it('should invalidate blueprint with no success criteria', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    // Remove all success criteria
    blueprint.successCriteria = [];

    const result = validateBlueprint(blueprint);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('success criteria'))).toBe(true);
  });

  it('should set all requirements with correct priority', () => {
    const product = makeCommercialProduct();
    const arch = makeArchitecture();
    const blueprint = createBlueprint(product, arch);

    // Content requirements should have priorities
    for (const req of blueprint.contentRequirements) {
      expect(['MUST', 'SHOULD', 'NICE_TO_HAVE']).toContain(req.priority);
    }
    // Design requirements should have priorities
    for (const req of blueprint.designRequirements) {
      expect(['MUST', 'SHOULD', 'NICE_TO_HAVE']).toContain(req.priority);
    }
    // Asset requirements should have priorities
    for (const req of blueprint.assetRequirements) {
      expect(['MUST', 'SHOULD', 'NICE_TO_HAVE']).toContain(req.priority);
    }
  });
});
