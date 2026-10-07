import { describe, it, expect } from 'vitest';
import { makeProductDecision, isProceedable, getNextActions } from '@/lib/product-decision';
import type { FitScore } from '@/lib/product-fit';

// Helper to create fit scores
function makeFitScore(overrides: Partial<FitScore> = {}): FitScore {
  return {
    overall: 0.75,
    marketExistence: 0.8,
    audienceClarity: 0.8,
    problemValidity: 0.8,
    differentiation: 0.7,
    feasibility: 0.7,
    evidence: 'INFERRED',
    reasoning: 'Test fit score',
    recommendation: 'PROCEED',
    ...overrides,
  };
}

describe('makeProductDecision', () => {
  it('should return GO for strong fit scores', () => {
    const decision = makeProductDecision(makeFitScore());
    expect(decision.decision).toBe('GO');
    expect(decision.riskLevel).toBe('LOW');
  });

  it('should return NO_GO for very low overall score', () => {
    const decision = makeProductDecision(makeFitScore({ overall: 0.2, recommendation: 'SKIP' }));
    expect(decision.decision).toBe('NO_GO');
  });

  it('should return CONDITIONAL_GO for moderate scores', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.55,
      feasibility: 0.35,
      recommendation: 'EXPLORE',
    }));
    expect(decision.decision).toBe('CONDITIONAL_GO');
  });

  it('should return NO_GO if any critical score is very low (< 0.3)', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.6,
      problemValidity: 0.2,
      recommendation: 'SKIP',
    }));
    expect(decision.decision).toBe('NO_GO');
    expect(decision.riskLevel).toBe('CRITICAL');
  });

  it('should include rationale', () => {
    const decision = makeProductDecision(makeFitScore());
    expect(decision.rationale).toBeTruthy();
    expect(decision.rationale.length).toBeGreaterThan(10);
  });

  it('should include conditions for CONDITIONAL_GO', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.55,
      feasibility: 0.35,
      recommendation: 'EXPLORE',
    }));
    if (decision.decision === 'CONDITIONAL_GO') {
      expect(decision.conditions.length).toBeGreaterThan(0);
    }
  });

  it('should return NO_GO when overall < 0.5', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.45,
      recommendation: 'RESEARCH_MORE',
    }));
    expect(decision.decision).toBe('NO_GO');
  });

  it('should return GO when overall >= 0.7 and all individual >= 0.4', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.7,
      marketExistence: 0.7,
      audienceClarity: 0.7,
      problemValidity: 0.7,
      differentiation: 0.5,
      feasibility: 0.5,
      recommendation: 'PROCEED',
    }));
    expect(decision.decision).toBe('GO');
  });

  it('should return CONDITIONAL_GO when overall >= 0.7 but some individual < 0.4', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.7,
      marketExistence: 0.7,
      audienceClarity: 0.7,
      problemValidity: 0.7,
      differentiation: 0.3, // below 0.4
      feasibility: 0.5,
      recommendation: 'EXPLORE',
    }));
    expect(decision.decision).toBe('CONDITIONAL_GO');
  });

  it('should inherit evidence from FitScore', () => {
    const decision = makeProductDecision(makeFitScore({ evidence: 'INFERRED' }));
    expect(decision.evidence).toBe('INFERRED');
  });

  it('should include the original FitScore in the decision', () => {
    const fitScore = makeFitScore();
    const decision = makeProductDecision(fitScore);
    expect(decision.fitScore).toBe(fitScore);
  });

  it('should include estimated effort', () => {
    const decision = makeProductDecision(makeFitScore());
    expect(decision.estimatedEffort).toBeTruthy();
    expect(typeof decision.estimatedEffort).toBe('string');
  });

  it('should set HIGH risk when min score is very low', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.6,
      differentiation: 0.32,
      recommendation: 'EXPLORE',
    }));
    expect(decision.riskLevel).toBe('HIGH');
  });
});

describe('isProceedable', () => {
  it('should return true for GO', () => {
    const decision = makeProductDecision(makeFitScore());
    expect(isProceedable(decision)).toBe(true);
  });

  it('should return true for CONDITIONAL_GO', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.55,
      feasibility: 0.35,
      recommendation: 'EXPLORE',
    }));
    expect(isProceedable(decision)).toBe(true);
  });

  it('should return false for NO_GO', () => {
    const decision = makeProductDecision(makeFitScore({ overall: 0.2, recommendation: 'SKIP' }));
    expect(isProceedable(decision)).toBe(false);
  });
});

describe('getNextActions', () => {
  it('should return architecture actions for GO', () => {
    const decision = makeProductDecision(makeFitScore());
    const actions = getNextActions(decision);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.includes('architecture'))).toBe(true);
  });

  it('should return condition-related actions for CONDITIONAL_GO', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.55,
      feasibility: 0.35,
      recommendation: 'EXPLORE',
    }));
    const actions = getNextActions(decision);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.includes('condition') || a.includes('Condition'))).toBe(true);
  });

  it('should return research actions for NO_GO with some potential', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.35,
      recommendation: 'RESEARCH_MORE',
    }));
    const actions = getNextActions(decision);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.includes('Research') || a.includes('research'))).toBe(true);
  });

  it('should return abandon actions for very low NO_GO', () => {
    const decision = makeProductDecision(makeFitScore({
      overall: 0.1,
      recommendation: 'SKIP',
    }));
    const actions = getNextActions(decision);
    expect(actions.length).toBeGreaterThan(0);
  });
});
