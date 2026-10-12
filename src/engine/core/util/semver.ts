/** Minimal semver support for pack/engine API compatibility checks ("^1.2.0", "~1.2.0", ">=1.0.0", "1.2.3"). */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export function parseSemver(v: string): SemVer | null {
  const m = SEMVER_RE.exec(v.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareSemver(a: SemVer, b: SemVer): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function satisfies(version: string, range: string): boolean {
  const v = parseSemver(version);
  if (!v) return false;
  const r = range.trim();
  if (r === '*' || r === '') return true;
  const op = /^(\^|~|>=|<=|>|<|=)?\s*(.*)$/.exec(r);
  if (!op) return false;
  const base = parseSemver(op[2] ?? '');
  if (!base) return false;
  const cmp = compareSemver(v, base);
  switch (op[1] ?? '=') {
    case '^':
      return cmp >= 0 && (base.major === 0 ? v.major === 0 && v.minor === base.minor : v.major === base.major);
    case '~':
      return cmp >= 0 && v.major === base.major && v.minor === base.minor;
    case '>=':
      return cmp >= 0;
    case '<=':
      return cmp <= 0;
    case '>':
      return cmp > 0;
    case '<':
      return cmp < 0;
    default:
      return cmp === 0;
  }
}
