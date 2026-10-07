import { describe, it, expect } from 'vitest';
import { parseStructuredResponse } from '@/lib/structured-output';
import { z } from 'zod';

const testSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
  recommendation: z.enum(['PROCEED', 'SKIP']),
});

describe('parseStructuredResponse', () => {
  it('should parse valid JSON directly', () => {
    const response = JSON.stringify({ name: 'Test', score: 0.8, recommendation: 'PROCEED' });
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test');
      expect(result.data.score).toBe(0.8);
      expect(result.data.recommendation).toBe('PROCEED');
      expect(result.evidence).toBe('VERIFIED');
    }
  });

  it('should parse JSON from markdown code block', () => {
    const response = 'Here is the result:\n```json\n{"name":"Test","score":0.7,"recommendation":"PROCEED"}\n```\nDone.';
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test');
    }
  });

  it('should fail on empty response', () => {
    const result = parseStructuredResponse('', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('EMPTY_RESPONSE');
  });

  it('should fail on whitespace-only response', () => {
    const result = parseStructuredResponse('   \n  \t  ', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('EMPTY_RESPONSE');
  });

  it('should fail on invalid JSON', () => {
    const result = parseStructuredResponse('not json at all', testSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('CONTAMINATED');
  });

  it('should fail on JSON with missing fields', () => {
    const response = JSON.stringify({ name: 'Test' }); // missing score, recommendation
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('SCHEMA_VALIDATION');
  });

  it('should fail on JSON with wrong types', () => {
    const response = JSON.stringify({ name: 'Test', score: 'high', recommendation: 'PROCEED' });
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('SCHEMA_VALIDATION');
  });

  it('should succeed on JSON with extra fields (Zod strips by default)', () => {
    const response = JSON.stringify({ name: 'Test', score: 0.5, recommendation: 'SKIP', extra: 'field' });
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test');
      expect((result.data as any).extra).toBeUndefined(); // stripped by Zod
    }
  });

  it('should handle response with text before JSON', () => {
    const response = 'The analysis shows: {"name":"Product","score":0.6,"recommendation":"SKIP"}';
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Product');
    }
  });

  it('should fail on partially valid JSON (incomplete)', () => {
    const response = '{"name":"Test","score":0.8'; // missing closing brace
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(false);
  });

  it('should parse JSON with wrong enum value', () => {
    const response = JSON.stringify({ name: 'Test', score: 0.8, recommendation: 'MAYBE' });
    const result = parseStructuredResponse(response, testSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('SCHEMA_VALIDATION');
  });

  it('should include raw response in failure', () => {
    const raw = 'bad input';
    const result = parseStructuredResponse(raw, testSchema);
    if (!result.success) {
      expect(result.raw).toBe(raw);
    }
  });

  it('should include error message in failure', () => {
    const result = parseStructuredResponse('not json', testSchema);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    }
  });
});

describe('parseStructuredResponse with array schema', () => {
  const arraySchema = z.array(z.object({ id: z.number(), label: z.string() }));

  it('should parse valid JSON array', () => {
    const response = JSON.stringify([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]);
    const result = parseStructuredResponse(response, arraySchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe(1);
    }
  });

  it('should parse array from code block', () => {
    const response = '```json\n[{"id":1,"label":"x"}]\n```';
    const result = parseStructuredResponse(response, arraySchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe(1);
    }
  });
});

describe('parseStructuredResponse with nested schema', () => {
  const nestedSchema = z.object({
    user: z.object({
      name: z.string(),
      age: z.number(),
    }),
    tags: z.array(z.string()),
  });

  it('should parse nested object', () => {
    const response = JSON.stringify({
      user: { name: 'Alice', age: 30 },
      tags: ['admin', 'user'],
    });
    const result = parseStructuredResponse(response, nestedSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user.name).toBe('Alice');
      expect(result.data.tags.length).toBe(2);
    }
  });

  it('should fail on missing nested field', () => {
    const response = JSON.stringify({
      user: { name: 'Alice' }, // missing age
      tags: ['admin'],
    });
    const result = parseStructuredResponse(response, nestedSchema);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errorType).toBe('SCHEMA_VALIDATION');
  });
});
