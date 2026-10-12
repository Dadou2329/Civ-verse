import { describe, expect, it } from 'vitest';
import { parseSemver, satisfies } from './semver';

describe('semver (pack and engine API compatibility)', () => {
  it('parses versions, ignoring pre-release and build suffixes', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver('0.1.0-alpha.1')).toEqual({ major: 0, minor: 1, patch: 0 });
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('v1.2.3')).toBeNull();
  });

  it('supports ^, ~, comparisons, exact versions and *', () => {
    expect(satisfies('1.5.0', '^1.2.0')).toBe(true);
    expect(satisfies('1.1.9', '^1.2.0')).toBe(false);
    expect(satisfies('2.0.0', '^1.2.0')).toBe(false);
    // Before 1.0.0, ^ only accepts the same minor version.
    expect(satisfies('0.2.5', '^0.2.0')).toBe(true);
    expect(satisfies('0.3.0', '^0.2.0')).toBe(false);
    expect(satisfies('1.2.9', '~1.2.0')).toBe(true);
    expect(satisfies('1.3.0', '~1.2.0')).toBe(false);
    expect(satisfies('1.0.0', '>=1.0.0')).toBe(true);
    expect(satisfies('0.9.9', '>=1.0.0')).toBe(false);
    expect(satisfies('1.0.0', '<1.0.0')).toBe(false);
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '=1.2.3')).toBe(false);
    expect(satisfies('7.0.0', '*')).toBe(true);
  });

  it('rejects what it does not understand instead of guessing', () => {
    expect(satisfies('not-a-version', '*')).toBe(false);
    expect(satisfies('1.0.0', '^banana')).toBe(false);
    // Compound ranges and x-ranges are not supported (documented limitation).
    expect(satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(false);
    expect(satisfies('1.5.0', '1.x')).toBe(false);
  });
});
