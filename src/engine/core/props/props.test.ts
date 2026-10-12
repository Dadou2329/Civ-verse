import { describe, expect, expectTypeOf, it } from 'vitest';
import { defaultsOf, normalizeProps, prop, type InferProps } from './props';

describe('prop schemas', () => {
  const schema = {
    frequency: prop.number({ min: 100, max: 2000, default: 440 }),
    mode: prop.enum(['ouvrir', 'fermer'] as const),
    target: prop.entity(),
    tags: prop.list(prop.string()),
    nested: prop.object({ enabled: prop.boolean({ default: true }) }),
  };

  it('infers value types', () => {
    type P = InferProps<typeof schema>;
    expectTypeOf<P['frequency']>().toEqualTypeOf<number>();
    expectTypeOf<P['mode']>().toEqualTypeOf<'ouvrir' | 'fermer'>();
    expectTypeOf<P['tags']>().toEqualTypeOf<string[]>();
    expectTypeOf<P['nested']['enabled']>().toEqualTypeOf<boolean>();
  });

  it('provides defaults', () => {
    const d = defaultsOf(schema);
    expect(d).toEqual({ frequency: 440, mode: 'ouvrir', target: '', tags: [], nested: { enabled: true } });
  });

  it('normalizes and reports issues without throwing', () => {
    const { value, issues } = normalizeProps(schema, { frequency: 5000, mode: 'voler', extra: 1 });
    expect(value.frequency).toBe(2000);
    expect(value.mode).toBe('ouvrir');
    expect(issues.map((i) => i.path).sort()).toEqual(['extra', 'frequency', 'mode']);
  });
});
