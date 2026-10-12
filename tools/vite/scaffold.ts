/**
 * Script scaffolding for Civilization Studio ("Nouveau script").
 *
 * Creates a TypeScript module in `civilizations/<pack>/mechanics/` from a template. Every pack's
 * `pack.ts` auto-discovers modules in that folder (import.meta.glob), so the new behavior,
 * action, condition or mechanic is registered without touching any other file.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export type ScaffoldKind = 'behavior' | 'action' | 'condition' | 'mechanic';

export interface ScaffoldRequest {
  pack: string;
  kind: ScaffoldKind;
  name: string;
}

export interface ScaffoldResult {
  path: string;
  id: string;
  exportName: string;
}

const PACK_RE = /^[a-z][a-z0-9-]*$/;

/** "Porte à résonance" → "porteAResonance", "ResonanceDoor" → "resonanceDoor" */
export function toCamelIdentifier(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();
  const words = ascii.split(/\s+/).filter(Boolean);
  if (words.length === 0) throw new Error('Nom de script vide.');
  const camel = words
    .map((w, i) => {
      const head = i === 0 ? w[0]!.toLowerCase() : w[0]!.toUpperCase();
      return head + w.slice(1);
    })
    .join('');
  return /^[0-9]/.test(camel) ? `s${camel}` : camel;
}

export function renderTemplate(kind: ScaffoldKind, pack: string, camel: string, label: string): string {
  const id = `${pack}.${camel}`;
  const safeLabel = label.replace(/'/g, "\\'");
  switch (kind) {
    case 'behavior':
      return `import { defineBehavior, prop } from '@sdk';

/**
 * ${label} — comportement créé avec Civilization Studio.
 *
 * Attachez-le à une entité dans l’Inspecteur (« Ajouter un composant »). Les propriétés déclarées
 * dans \`props\` apparaissent automatiquement dans l’Inspecteur et sont enregistrées dans la scène.
 */
export const ${camel} = defineBehavior({
  id: '${id}',
  label: '${safeLabel}',
  description: 'Décrivez ici ce que fait ce comportement.',
  props: {
    prompt: prop.text({ label: 'Texte de l’invite', default: 'core.verb.use' }),
    message: prop.text({ label: 'Message affiché', default: '' }),
    actions: prop.actions({ label: 'Actions à l’interaction' }),
    size: prop.vec3({ label: 'Zone de visée (m)', default: [0.8, 1.2, 0.8] }),
  },
  create(ctx) {
    // A box the player can aim at: the entity can be used without a model.
    const aim = () => {
      const [sx, sy, sz] = ctx.props.size;
      ctx.entity.setCollider('aim', { minX: -sx / 2, minY: 0, minZ: -sz / 2, maxX: sx / 2, maxY: sy, maxZ: sz / 2 }, { solid: false, pickable: true });
    };
    aim();
    return {
      onPropsChanged: aim,
      interaction: () => ({ label: ctx.t(ctx.props.prompt) }),
      onInteract: async () => {
        if (ctx.props.message) ctx.ui.notify(ctx.t(ctx.props.message));
        await ctx.logic.run(ctx.props.actions);
      },
    };
  },
});
`;
    case 'action':
      return `import { defineAction, prop } from '@sdk';

/**
 * ${label} — action de logique créée avec Civilization Studio.
 * Elle devient disponible dans l’éditeur de logique, les dialogues, les quêtes et les cinématiques.
 */
export const ${camel} = defineAction({
  id: '${id}',
  label: '${safeLabel}',
  props: {
    message: prop.text({ label: 'Message', default: '' }),
  },
  run(ctx, props) {
    if (props.message) ctx.ui.notify(ctx.t(props.message));
  },
});
`;
    case 'condition':
      return `import { defineCondition, prop } from '@sdk';

/**
 * ${label} — condition créée avec Civilization Studio.
 * Utilisable partout où une condition est attendue (règles, dialogues, quêtes, serrures...).
 */
export const ${camel} = defineCondition({
  id: '${id}',
  label: '${safeLabel}',
  props: {
    variable: prop.variable({ label: 'Variable' }),
    minimum: prop.number({ label: 'Valeur minimale', default: 1 }),
  },
  test(ctx, props) {
    const value = ctx.vars.get(props.variable);
    return typeof value === 'number' && value >= props.minimum;
  },
});
`;
    case 'mechanic':
      return `import { defineMechanic } from '@sdk';

interface ${camel[0]!.toUpperCase() + camel.slice(1)}State {
  activations: number;
}

/**
 * ${label} — mécanique créée avec Civilization Studio.
 *
 * Une mécanique vit pendant toute la durée de la civilisation. Tout ce qu’elle enregistre via
 * \`ctx\` (écouteurs, minuteries, interface, entrées) est libéré automatiquement au déchargement.
 */
export const ${camel} = defineMechanic({
  id: '${id}',
  label: '${safeLabel}',
  state: {
    version: 1,
    initial: (): ${camel[0]!.toUpperCase() + camel.slice(1)}State => ({ activations: 0 }),
  },
  setup(ctx, state) {
    ctx.events.on('entity.interacted', () => {
      state.activations += 1;
    });
    return {
      get activations() {
        return state.activations;
      },
    };
  },
});
`;
  }
}

export async function scaffoldScript(
  req: ScaffoldRequest,
  resolveWritable: (rel: string) => string,
): Promise<ScaffoldResult> {
  if (!req || typeof req.pack !== 'string' || !PACK_RE.test(req.pack)) throw new Error('Pack invalide.');
  if (!['behavior', 'action', 'condition', 'mechanic'].includes(req.kind)) throw new Error('Type de script invalide.');
  const label = String(req.name ?? '').trim();
  const camel = toCamelIdentifier(label);
  const rel = `civilizations/${req.pack}/mechanics/${camel}.ts`;
  const abs = resolveWritable(rel);
  // civilizations/<pack>/mechanics/<file> → civilizations/<pack>/pack.ts
  if (!fs.existsSync(path.join(path.dirname(path.dirname(abs)), 'pack.ts'))) {
    throw new Error(`Le pack « ${req.pack} » n’existe pas.`);
  }
  if (fs.existsSync(abs)) throw new Error(`Le fichier existe déjà : ${rel}`);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, renderTemplate(req.kind, req.pack, camel, label), { encoding: 'utf8', flag: 'wx' });
  return { path: rel, id: `${req.pack}.${camel}`, exportName: camel };
}
