import { describe, it, expect, beforeEach } from 'vitest';
import {
  createFactoryContract,
  transitionFactoryStatus,
  addError,
  isIdempotent,
  clearContracts,
} from '@/lib/factory-contract';
import { FactoryContractError } from '@/lib/factory-contract';
import type { FactoryContract, Blueprint } from '@/lib/factory-contract';

// Helper to create a Blueprint matching the actual API
function makeBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  return {
    blueprintId: 'bp-1',
    productId: 'prod-1',
    productVersion: '1.0.0',
    productType: 'ebook',
    ...overrides,
  };
}

describe('FactoryContract', () => {
  beforeEach(() => {
    clearContracts();
  });

  it('should create contract with CREATED status', () => {
    const contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    expect(contract.status).toBe('CREATED');
    expect(contract.factoryId).toBe('book-factory');
    expect(contract.errors).toHaveLength(0);
  });

  it('should allow CREATED→QUEUED transition', () => {
    const contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    const updated = transitionFactoryStatus(contract, 'QUEUED');
    expect(updated.status).toBe('QUEUED');
  });

  it('should allow QUEUED→RUNNING transition', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = transitionFactoryStatus(contract, 'QUEUED');
    contract = transitionFactoryStatus(contract, 'RUNNING');
    expect(contract.status).toBe('RUNNING');
  });

  it('should allow RUNNING→QA→PASSED→COMPLETED chain', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = transitionFactoryStatus(contract, 'QUEUED');
    contract = transitionFactoryStatus(contract, 'RUNNING');
    contract = transitionFactoryStatus(contract, 'QA');
    contract = transitionFactoryStatus(contract, 'PASSED');
    contract = transitionFactoryStatus(contract, 'COMPLETED');
    expect(contract.status).toBe('COMPLETED');
  });

  it('should reject invalid transition CREATED→COMPLETED', () => {
    const contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    expect(() => transitionFactoryStatus(contract, 'COMPLETED')).toThrow();
  });

  it('should allow FAILED→REPAIRING→RUNNING retry', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = transitionFactoryStatus(contract, 'QUEUED');
    contract = transitionFactoryStatus(contract, 'RUNNING');
    contract = transitionFactoryStatus(contract, 'QA');
    contract = transitionFactoryStatus(contract, 'FAILED');
    contract = transitionFactoryStatus(contract, 'REPAIRING');
    contract = transitionFactoryStatus(contract, 'RUNNING');
    expect(contract.status).toBe('RUNNING');
  });

  it('should allow any→CANCELLED', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = transitionFactoryStatus(contract, 'CANCELLED');
    expect(contract.status).toBe('CANCELLED');
  });

  it('should add errors without removing previous', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = addError(contract, 'step1', 'error1', true);
    contract = addError(contract, 'step2', 'error2', false);
    expect(contract.errors).toHaveLength(2);
  });

  it('should be idempotent for COMPLETED contracts', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = transitionFactoryStatus(contract, 'QUEUED');
    contract = transitionFactoryStatus(contract, 'RUNNING');
    contract = transitionFactoryStatus(contract, 'QA');
    contract = transitionFactoryStatus(contract, 'PASSED');
    contract = transitionFactoryStatus(contract, 'COMPLETED');
    expect(isIdempotent(contract)).toBe(true);
  });

  it('should NOT be idempotent for RUNNING contracts', () => {
    let contract = createFactoryContract('book-factory', 'prod-1', makeBlueprint());
    contract = transitionFactoryStatus(contract, 'QUEUED');
    contract = transitionFactoryStatus(contract, 'RUNNING');
    expect(isIdempotent(contract)).toBe(false);
  });
});
