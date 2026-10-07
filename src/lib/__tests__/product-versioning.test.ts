import { describe, it, expect } from 'vitest';
import {
  incrementVersion,
  parseSemver,
  isValidSemver,
  compareSemver,
} from '@/lib/product-versioning';

describe('ProductVersioning', () => {
  it('should increment major version', () => {
    expect(incrementVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(incrementVersion('1.5.3', 'major')).toBe('2.0.0');
  });

  it('should increment minor version', () => {
    expect(incrementVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(incrementVersion('2.3.1', 'minor')).toBe('2.4.0');
  });

  it('should increment patch version', () => {
    expect(incrementVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(incrementVersion('1.2.5', 'patch')).toBe('1.2.6');
  });

  it('should parse semver', () => {
    const [major, minor, patch] = parseSemver('2.3.7');
    expect(major).toBe(2);
    expect(minor).toBe(3);
    expect(patch).toBe(7);
  });

  it('should validate semver', () => {
    expect(isValidSemver('1.0.0')).toBe(true);
    expect(isValidSemver('0.0.1')).toBe(true);
    expect(isValidSemver('not-semver')).toBe(false);
    expect(isValidSemver('1.0')).toBe(false);
  });

  it('should compare semver', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0);
    expect(compareSemver('1.0.1', '1.0.2')).toBeLessThan(0);
  });
});
