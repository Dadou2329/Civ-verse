/**
 * Built-in conditions ("core.*"). Packs add their own with defineCondition().
 */
import { defineCondition } from '../packs/definitions';
import { prop } from '../props/props';
import { compareValues, COMPARE_OPS } from '../state/variables';
import { distance } from '../util/math';

const OPS = COMPARE_OPS.map((o) => ({
  value: o,
  label: { '==': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤', exists: 'existe / vrai', missing: 'absente / faux', contains: 'contient' }[o],
}));

export const coreConditions = [
  defineCondition({
    id: 'core.always',
    label: 'Toujours vrai',
    category: 'Logique',
    props: {},
    test: () => true,
  }),
  defineCondition({
    id: 'core.all',
    label: 'Toutes les conditions (ET)',
    category: 'Logique',
    props: { of: prop.list(prop.condition({ label: 'Condition' }), { label: 'Conditions' }) },
    test: (ctx, p, scope) => p.of.every((c) => ctx.logic.test(c, scope)),
  }),
  defineCondition({
    id: 'core.any',
    label: 'Au moins une condition (OU)',
    category: 'Logique',
    props: { of: prop.list(prop.condition({ label: 'Condition' }), { label: 'Conditions' }) },
    test: (ctx, p, scope) => p.of.some((c) => ctx.logic.test(c, scope)),
  }),
  defineCondition({
    id: 'core.not',
    label: 'Négation (NON)',
    category: 'Logique',
    props: { condition: prop.condition({ label: 'Condition' }) },
    test: (ctx, p, scope) => !ctx.logic.test(p.condition, scope),
  }),
  defineCondition({
    id: 'core.random',
    label: 'Hasard',
    category: 'Logique',
    props: { chance: prop.number({ label: 'Probabilité (0–1)', default: 0.5, min: 0, max: 1, step: 0.05 }) },
    test: (_ctx, p) => Math.random() < p.chance,
  }),
  defineCondition({
    id: 'core.var',
    label: 'Comparer une variable',
    category: 'Variables',
    props: {
      var: prop.variable({ label: 'Variable' }),
      op: prop.enum(OPS, { label: 'Opérateur', default: '==' }),
      value: prop.json({ label: 'Valeur', default: true }),
    },
    test: (ctx, p) => compareValues(ctx.vars.get(p.var), p.op, p.value),
    summarize: (p) => `${p.var} ${p.op} ${JSON.stringify(p.value)}`,
  }),
  defineCondition({
    id: 'core.hasItem',
    label: 'Possède un objet',
    category: 'Inventaire',
    props: { item: prop.item({ label: 'Objet' }), count: prop.integer({ label: 'Quantité minimale', default: 1, min: 1 }) },
    test: (ctx, p) => ctx.inventory.has(p.item, p.count),
    summarize: (p) => `Possède ${p.count} × ${p.item}`,
  }),
  defineCondition({
    id: 'core.questStatus',
    label: 'État d’une quête',
    category: 'Narration',
    props: {
      quest: prop.quest({ label: 'Quête' }),
      status: prop.enum(
        [
          { value: 'inactive', label: 'Pas commencée' },
          { value: 'active', label: 'En cours' },
          { value: 'completed', label: 'Terminée' },
          { value: 'failed', label: 'Échouée' },
        ],
        { label: 'État', default: 'active' },
      ),
    },
    test: (ctx, p) => ctx.quests.status(p.quest) === p.status,
    summarize: (p) => `${p.quest} : ${p.status}`,
  }),
  defineCondition({
    id: 'core.questStage',
    label: 'Étape de quête',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }), stage: prop.string({ label: 'Étape' }) },
    test: (ctx, p) => ctx.quests.status(p.quest) === 'active' && ctx.quests.stage(p.quest) === p.stage,
  }),
  defineCondition({
    id: 'core.objectiveDone',
    label: 'Objectif accompli',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }), objective: prop.string({ label: 'Objectif' }) },
    test: (ctx, p) => ctx.quests.isObjectiveDone(p.quest, p.objective),
  }),
  defineCondition({
    id: 'core.dialogueSeen',
    label: 'Réplique déjà vue',
    category: 'Narration',
    props: { dialogue: prop.dialogue({ label: 'Dialogue' }), node: prop.string({ label: 'Nœud (vide = tout le dialogue)' }) },
    test: (ctx, p) => ctx.dialogue.seen(p.dialogue, p.node || undefined),
  }),
  defineCondition({
    id: 'core.dialogueActive',
    label: 'Un dialogue est en cours',
    category: 'Narration',
    description: 'Vrai pendant qu’un dialogue est affiché (pour attendre que le joueur ait fini de parler).',
    props: {},
    test: (ctx) => ctx.dialogue.active,
  }),
  defineCondition({
    id: 'core.choiceMade',
    label: 'Choix de dialogue fait',
    category: 'Narration',
    props: { dialogue: prop.dialogue({ label: 'Dialogue' }), choice: prop.string({ label: 'Choix' }) },
    test: (ctx, p) => ctx.dialogue.chose(p.dialogue, p.choice),
  }),
  defineCondition({
    id: 'core.inScene',
    label: 'Dans la scène',
    category: 'Monde',
    props: { scene: prop.scene({ label: 'Scène' }) },
    test: (ctx, p) => ctx.scenes.current === p.scene,
  }),
  defineCondition({
    id: 'core.entityVisible',
    label: 'Entité visible',
    category: 'Monde',
    props: { entity: prop.entity({ label: 'Entité' }) },
    test: (ctx, p) => ctx.world.entity(p.entity)?.visible ?? false,
  }),
  defineCondition({
    id: 'core.doorOpen',
    label: 'Porte ouverte',
    category: 'Monde',
    props: { entity: prop.entity({ label: 'Porte', withComponent: 'core.door' }) },
    test: (ctx, p) => ctx.world.entity(p.entity)?.behavior<{ isOpen: boolean }>('core.door')?.isOpen ?? false,
  }),
  defineCondition({
    id: 'core.playerNear',
    label: 'Joueur à proximité',
    category: 'Monde',
    props: { entity: prop.entity({ label: 'Entité' }), distance: prop.number({ label: 'Distance (m)', default: 3, min: 0 }) },
    test: (ctx, p) => {
      const e = ctx.world.entity(p.entity);
      return !!e && distance(e.position, ctx.player.position) <= p.distance;
    },
  }),
  defineCondition({
    id: 'core.hasAbility',
    label: 'Possède une capacité',
    category: 'Joueur',
    props: { ability: prop.ability({ label: 'Capacité' }) },
    test: (ctx, p) => ctx.player.abilities.has(p.ability),
  }),
  defineCondition({
    id: 'core.hasFragment',
    label: 'Fragment multivers possédé',
    category: 'Multivers',
    props: { fragment: prop.string({ label: 'Fragment' }) },
    test: (ctx, p) => ctx.multiverse.hasFragment(p.fragment),
  }),
  defineCondition({
    id: 'core.globalFlag',
    label: 'Indicateur global',
    category: 'Multivers',
    props: { flag: prop.string({ label: 'Indicateur' }), op: prop.enum(OPS, { label: 'Opérateur', default: 'exists' }), value: prop.json({ label: 'Valeur', default: true }) },
    test: (ctx, p) => compareValues(ctx.multiverse.getFlag(p.flag), p.op, p.value),
  }),
  defineCondition({
    id: 'core.civCompleted',
    label: 'Civilisation terminée',
    category: 'Multivers',
    props: { civ: prop.string({ label: 'Civilisation' }) },
    test: (ctx, p) => ctx.multiverse.isCivCompleted(p.civ),
  }),
  // ---- Equipment and combat -----------------------------------------------------------------
  defineCondition({
    id: 'core.holding',
    label: 'Le joueur tient un objet en main',
    category: 'Équipement',
    props: { item: prop.item({ label: 'Objet (vide = main nue)' }) },
    test: (ctx, p) => ctx.equipment.held === (p.item || null),
  }),
  defineCondition({
    id: 'core.wearing',
    label: 'Le joueur porte un objet',
    category: 'Équipement',
    props: { item: prop.item({ label: 'Objet' }) },
    test: (ctx, p) => ctx.equipment.wornItems().some((w) => w.itemId === p.item),
  }),
  defineCondition({
    id: 'core.entityDefeated',
    label: 'Entité vaincue',
    category: 'Combat',
    props: { entity: prop.entity({ label: 'Entité', withComponent: 'core.health' }) },
    test: (ctx, p) => {
      const e = ctx.world.entity(p.entity);
      return !!e && e.behavior<{ defeated: boolean }>('core.health')?.defeated === true;
    },
  }),
  defineCondition({
    id: 'core.encounterDone',
    label: 'Rencontre gagnée',
    category: 'Combat',
    props: { encounter: prop.entity({ label: 'Rencontre', withComponent: 'core.encounter' }) },
    test: (ctx, p) => ctx.world.entity(p.encounter)?.behavior<{ status: string }>('core.encounter')?.status === 'done',
  }),
  defineCondition({
    id: 'core.playerHealth',
    label: 'Vie du joueur sous un seuil',
    category: 'Combat',
    props: { below: prop.number({ label: 'Fraction de la vie (0–1)', default: 0.3, min: 0, max: 1, step: 0.05 }) },
    test: (ctx, p) => ctx.combat.enabled && ctx.combat.player.health / ctx.combat.player.maxHealth < p.below,
  }),
  defineCondition({
    id: 'core.inCombat',
    label: 'Combat en cours',
    category: 'Combat',
    props: {},
    test: (ctx) => ctx.combat.inCombat,
  }),
];
