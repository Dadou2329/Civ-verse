import { describe, expect, it } from 'vitest';
import { Localizer, formatMessage } from './localizer';

describe('Localizer', () => {
  it('interpolates and applies French plural rules', () => {
    expect(formatMessage('Bonjour {name}', { name: 'Mira' })).toBe('Bonjour Mira');
    const msg = '{n, plural, one {# éclat} other {# éclats}}';
    expect(formatMessage(msg, { n: 0 })).toBe('0 éclat');
    expect(formatMessage(msg, { n: 1 })).toBe('1 éclat');
    expect(formatMessage(msg, { n: 3 })).toBe('3 éclats');
    expect(formatMessage('{n, plural, =0 {aucun} other {#}}', { n: 0 })).toBe('aucun');
    expect(formatMessage('{g, select, f {prête} other {prêt}}', { g: 'f' })).toBe('prête');
  });

  it('falls back to French and marks missing keys without inventing text', () => {
    const l = new Localizer('en-US');
    l.addTable('engine', 'fr-FR', { 'a.b': 'Bonjour' });
    expect(l.t('a.b')).toBe('Bonjour');
    expect(l.t('x.y')).toBe('⟦x.y⟧');
    expect(l.missing()).toContain('x.y');
  });

  it('removes a namespace cleanly', () => {
    const l = new Localizer();
    l.addTable('door', 'fr-FR', { 'door.a': 'Porte' });
    expect(l.has('door.a')).toBe(true);
    l.removeNamespace('door');
    expect(l.has('door.a')).toBe(false);
  });
});
