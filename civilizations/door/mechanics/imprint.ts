import { defineAction, defineCondition, defineEvent, defineMechanic, prop } from '@sdk';
import { access } from './access';

/**
 * KeyImprint — Mira's workbench imprints a key pattern into blank metal.
 *
 * The player gathers three parts (copper spring, brass pin, blank disc), then aligns three dials
 * on the workbench (panel `door.imprint`). Each dial clicks when it reaches the notch engraved
 * on the gallery gate; the pattern can be read on the gate itself (« Examiner »), Mira and Tomas
 * hint at it. Success consumes the parts and produces the Porteur plaque: rank 1.
 */
export const IMPRINT_PARTS = ['door:ressort', 'door:goupille', 'door:disque'] as const;

/** Symbols engraved on the dials (localization keys door.dial.<symbol>). */
export const DIAL_SYMBOLS = ['lune', 'cle', 'tour', 'oeil', 'main', 'pont'] as const;

export interface ImprintApi {
  readonly symbols: readonly string[];
  /** Per-dial correctness of a candidate setting (the dial « clicks » when right). */
  check(dials: readonly number[]): boolean[];
  /** Records an imprint attempt; true when every dial is aligned. */
  submit(dials: readonly number[]): boolean;
  readonly attempts: number;
  /** True once the gate engraving has been read (the panel shows it as a hint). */
  readonly hintKnown: boolean;
  /** Symbols of the engraving, once known (null before). */
  hint(): string[] | null;
}

export const keyImprint = defineMechanic({
  id: 'door.keyImprint',
  label: "Empreinte de clé (trois cadrans)",
  description: 'Mini-jeu de l’établi de Mira : aligner trois cadrans sur la gravure de la porte de la Galerie.',
  state: { version: 1, initial: () => ({ attempts: 0, done: false }) },
  settings: {
    dial1: prop.integer({ label: 'Cadran 1 (index du symbole)', default: 0, min: 0, max: 5 }),
    dial2: prop.integer({ label: 'Cadran 2 (index du symbole)', default: 1, min: 0, max: 5 }),
    dial3: prop.integer({ label: 'Cadran 3 (index du symbole)', default: 2, min: 0, max: 5 }),
  },
  setup(ctx, state, settings): ImprintApi {
    const target = [settings.dial1, settings.dial2, settings.dial3];
    const check = (dials: readonly number[]) => target.map((t, i) => dials[i] === t);
    return {
      symbols: DIAL_SYMBOLS,
      check,
      submit(dials) {
        state.attempts++;
        const ok = check(dials).every(Boolean);
        if (ok) state.done = true;
        return ok;
      },
      get attempts() {
        return state.attempts;
      },
      get hintKnown() {
        return ctx.vars.get('door.gateEngravingSeen') === true;
      },
      hint() {
        return ctx.vars.get('door.gateEngravingSeen') === true ? target.map((i) => DIAL_SYMBOLS[i] ?? DIAL_SYMBOLS[0]) : null;
      },
    };
  },
});

export const imprintReady = defineCondition({
  id: 'door.imprintReady',
  label: "Les trois pièces de l'empreinte sont réunies",
  category: 'Verrou',
  props: {},
  test: (ctx) => IMPRINT_PARTS.every((id) => ctx.inventory.has(id)) && access(ctx).rank < 1,
});

export const openImprint = defineAction({
  id: 'door.openImprint',
  label: "Ouvrir l'établi d'empreinte (trois cadrans)",
  category: 'Verrou',
  props: {},
  async run(ctx) {
    if (!IMPRINT_PARTS.every((id) => ctx.inventory.has(id))) {
      ctx.ui.notify(ctx.t('door.prompt.bench.missing'), { kind: 'denied' });
      return;
    }
    const result = await ctx.ui.openPanel<{ success?: boolean }>('door.imprint');
    if (!result?.success) return;
    for (const id of IMPRINT_PARTS) ctx.inventory.remove(id, 1, { silent: true });
    if (ctx.inventory.has('door:plaque_r0')) ctx.inventory.remove('door:plaque_r0', 1, { silent: true });
    ctx.audio.play('door:imprint');
    await ctx.time.wait(1.1);
    ctx.inventory.add('door:plaque_r1', 1);
    access(ctx).setRank(1);
    ctx.events.emit('door.imprinted', {});
  },
});

export const imprintedEvent = defineEvent({ id: 'door.imprinted', label: 'Plaque de Porteur empreinte', fields: {} });
