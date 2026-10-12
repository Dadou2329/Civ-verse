/**
 * Civilization validation: boots a civilization in a headless session, then checks every content
 * file against the live registries.
 *
 *  - schemas (already checked when the pack loads),
 *  - references: dialogues, quests, cinematics, scenes, spawns, entities, items, characters,
 *    models, blocks, sounds, music, panels, abilities, component/action/condition types, events,
 *  - variables: writes outside the civilization's namespace,
 *  - localization: every player-visible key exists in French (content and code).
 *
 * Used by `npm run validate`, the test suite and Civilization Studio's diagnostics panel.
 */
import type { GameSession } from '../sim/session';
import type { PropDef, PropSchema } from '../props/props';
import type { ActionData, ConditionData } from '../logic/types';
import type { LoadedPack } from './pack';
import { loadSceneDoc } from './pack';
import type { SceneDoc } from '../content/schemas';
import { toError } from '../util/assert';

export interface ValidationIssue {
  pack: string;
  file: string;
  /** Location inside the file ("entities.cell_door.door.lock.deniedText"). */
  path?: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationOptions {
  /** Localization keys used literally in the pack's code (`t('door.x')`), with their file. */
  codeKeys?: { key: string; file: string }[];
}

export interface ValidationReport {
  civId: string;
  issues: ValidationIssue[];
  stats: { scenes: number; entities: number; dialogues: number; quests: number; cinematics: number; rules: number; keysChecked: number };
}

const SPECIAL_ENTITIES = new Set(['player', '$self', '$event', 'narrator']);

export async function validateCivilization(session: GameSession, civId: string, opts: ValidationOptions = {}): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
  const stats = { scenes: 0, entities: 0, dialogues: 0, quests: 0, cinematics: 0, rules: 0, keysChecked: 0 };
  const report: ValidationReport = { civId, issues, stats };
  for (const ci of session.contentIssues.filter((c) => c.pack === civId)) issues.push({ pack: ci.pack, file: ci.file, severity: ci.severity, message: ci.message });
  try {
    await session.loadCivilization(civId, { fresh: true });
  } catch (err) {
    issues.push({ pack: civId, file: 'manifest.json', severity: 'error', message: `La civilisation ne démarre pas : ${toError(err).message}` });
    return report;
  }
  const civ = session.civ!;
  const pack = civ.pack;
  const scenes = new Map<string, SceneDoc>();
  for (const id of pack.scenes.keys()) {
    try {
      scenes.set(id, await loadSceneDoc(session.provider, pack, id));
    } catch (err) {
      issues.push({ pack: civId, file: pack.scenes.get(id) ?? id, severity: 'error', message: toError(err).message });
    }
  }
  const entityIds = new Map<string, Set<string>>();
  const allEntityIds = new Set<string>();
  const spawnIds = new Set<string>();
  for (const [sid, doc] of scenes) {
    const ids = new Set(doc.entities.map((e) => e.id));
    entityIds.set(sid, ids);
    for (const e of doc.entities) {
      allEntityIds.add(e.id);
      if (e.components['core.spawn']) spawnIds.add(e.id);
    }
  }

  const ctx: CheckCtx = { session, civId, pack, issues, stats, allEntityIds, spawnIds, sceneEntities: null, file: '', scenes };

  // --- Manifest -------------------------------------------------------------------------------
  ctx.file = 'manifest.json';
  const m = civ.manifest;
  for (const [p, k] of [
    ['name', m.name],
    ['description', m.description],
    ['tagline', m.tagline],
  ] as const)
    if (k) checkKey(ctx, k, p);
  m.fragments.forEach((f, i) => {
    checkKey(ctx, f.name, `fragments.${i}.name`);
    checkKey(ctx, f.hint, `fragments.${i}.hint`);
  });
  if (m.entry && !pack.scenes.has(m.entry.scene)) err(ctx, 'entry.scene', `Scène d'entrée inconnue : ${m.entry.scene}`);

  // --- Mechanics: setup failures and their settings (content/rules.json) ------------------------
  for (const [id, record] of civ.mechanics) {
    if (record.failed) issues.push({ pack: civId, file: 'mechanics', path: id, severity: 'error', message: `La mécanique ${id} a échoué à l’initialisation : ${record.failed}` });
  }
  ctx.file = 'content/rules.json';
  for (const def of pack.defs.mechanics) {
    if (def.settings) checkProps(ctx, def.settings, pack.rules.settings[def.id] ?? {}, `settings.${def.id}`);
  }
  if (m.entry && scenes.has(m.entry.scene) && !entityIds.get(m.entry.scene)?.has(m.entry.spawn)) err(ctx, 'entry.spawn', `Point d'apparition introuvable : ${m.entry.spawn}`);

  // --- Scenes -------------------------------------------------------------------------------------
  for (const [sid, doc] of scenes) {
    stats.scenes++;
    ctx.file = pack.scenes.get(sid) ?? sid;
    ctx.sceneEntities = entityIds.get(sid) ?? null;
    checkKey(ctx, doc.name, 'name');
    for (const b of new Set(doc.voxels.palette)) if (b !== 'core:air' && !session.blocks.get(b)) err(ctx, 'voxels.palette', `Bloc inconnu : ${b}`);
    const env = doc.environment;
    if (env.music && !session.music.has(env.music)) err(ctx, 'environment.music', `Musique inconnue : ${env.music}`);
    if (env.ambience && !session.sounds.has(env.ambience)) err(ctx, 'environment.ambience', `Ambiance inconnue : ${env.ambience}`);
    for (const e of doc.entities) {
      stats.entities++;
      for (const [type, props] of Object.entries(e.components)) {
        const def = session.behaviorDefs.get(type)?.def;
        const path = `entities.${e.id}.${type}`;
        if (!def) {
          err(ctx, path, `Composant inconnu : ${type}`);
          continue;
        }
        checkProps(ctx, def.props, props, path);
      }
    }
  }
  ctx.sceneEntities = null;

  // --- Dialogues ------------------------------------------------------------------------------
  for (const [id, d] of pack.dialogues) {
    stats.dialogues++;
    ctx.file = `content/dialogues/${id}.dialogue.json`;
    const nodeIds = new Set(d.nodes.map((n) => n.id));
    if (!nodeIds.has(d.start)) err(ctx, 'start', `Nœud de départ inconnu : ${d.start}`);
    if (d.title) checkKey(ctx, d.title, 'title', true);
    for (const [sk, sp] of Object.entries(d.speakers ?? {})) {
      checkKey(ctx, sp.name, `speakers.${sk}.name`);
      if (sp.entity && !allEntityIds.has(sp.entity)) err(ctx, `speakers.${sk}.entity`, `Entité inconnue : ${sp.entity}`);
    }
    for (const n of d.nodes) {
      const p = `nodes.${n.id}`;
      if (n.text) checkKey(ctx, n.text, `${p}.text`);
      if (n.speaker && !SPECIAL_ENTITIES.has(n.speaker) && !d.speakers?.[n.speaker] && !allEntityIds.has(n.speaker)) {
        err(ctx, `${p}.speaker`, `Locuteur inconnu : ${n.speaker} (ni entité, ni « speakers »)`);
      }
      if (n.next && !nodeIds.has(n.next)) err(ctx, `${p}.next`, `Nœud inconnu : ${n.next}`);
      for (const [i, b] of (n.branches ?? []).entries()) {
        if (!nodeIds.has(b.next)) err(ctx, `${p}.branches.${i}.next`, `Nœud inconnu : ${b.next}`);
        checkCondition(ctx, b.condition, `${p}.branches.${i}.condition`);
      }
      checkActions(ctx, n.actions, `${p}.actions`);
      for (const c of n.choices ?? []) {
        const cp = `${p}.choices.${c.id}`;
        checkKey(ctx, c.text, `${cp}.text`);
        if (c.next && !nodeIds.has(c.next)) err(ctx, `${cp}.next`, `Nœud inconnu : ${c.next}`);
        checkCondition(ctx, c.condition, `${cp}.condition`);
        checkActions(ctx, c.actions, `${cp}.actions`);
      }
      if (!n.text && !n.next && !n.branches?.length && !n.choices?.length && !n.end) warn(ctx, p, 'Nœud vide qui termine le dialogue (ajouter end: true pour le rendre explicite).');
    }
  }

  // --- Quests -----------------------------------------------------------------------------------
  for (const [id, q] of pack.quests) {
    stats.quests++;
    ctx.file = `content/quests/${id}.quest.json`;
    checkKey(ctx, q.title, 'title');
    checkKey(ctx, q.summary, 'summary');
    checkCondition(ctx, q.startWhen, 'startWhen');
    if (q.startOn) checkEvent(ctx, q.startOn.event, 'startOn.event');
    checkActions(ctx, q.onStart, 'onStart');
    checkActions(ctx, q.onComplete, 'onComplete');
    checkCondition(ctx, q.failWhen, 'failWhen');
    checkActions(ctx, q.onFail, 'onFail');
    const stageIds = new Set(q.stages.map((s) => s.id));
    for (const st of q.stages) {
      const p = `stages.${st.id}`;
      checkKey(ctx, st.description, `${p}.description`);
      if (st.next && !stageIds.has(st.next)) err(ctx, `${p}.next`, `Étape inconnue : ${st.next}`);
      checkActions(ctx, st.onComplete, `${p}.onComplete`);
      for (const o of st.objectives) {
        const op = `${p}.objectives.${o.id}`;
        checkKey(ctx, o.text, `${op}.text`);
        checkCondition(ctx, o.completeWhen, `${op}.completeWhen`);
        if (o.completeOn) checkEvent(ctx, o.completeOn.event, `${op}.completeOn.event`);
        if (o.target && !allEntityIds.has(o.target)) err(ctx, `${op}.target`, `Entité cible inconnue : ${o.target}`);
        if (o.targetScene && !pack.scenes.has(o.targetScene)) err(ctx, `${op}.targetScene`, `Scène inconnue : ${o.targetScene}`);
        if (o.progress) checkVariable(ctx, o.progress.var, `${op}.progress.var`, false);
        if (!o.completeWhen && !o.completeOn && !referencesObjective(pack, scenes, id, o.id)) {
          warn(ctx, op, `Objectif sans condition ni événement, jamais complété par une action core.completeObjective.`);
        }
      }
    }
  }

  // --- Cinematics -------------------------------------------------------------------------------
  for (const [id, c] of pack.cinematics) {
    stats.cinematics++;
    ctx.file = `content/cinematics/${id}.cinematic.json`;
    if (c.title) checkKey(ctx, c.title, 'title', true);
    checkActions(ctx, c.onComplete, 'onComplete');
    c.tracks.forEach((tr, ti) => {
      const p = `tracks.${ti}`;
      if (tr.type === 'subtitle') {
        tr.items.forEach((it, i) => {
          checkKey(ctx, it.text, `${p}.items.${i}.text`);
          if (it.speaker && !SPECIAL_ENTITIES.has(it.speaker) && !allEntityIds.has(it.speaker)) checkKey(ctx, it.speaker, `${p}.items.${i}.speaker`);
        });
      } else if (tr.type === 'actor') {
        if (!allEntityIds.has(tr.entity) && tr.entity !== 'player') err(ctx, `${p}.entity`, `Entité inconnue : ${tr.entity}`);
        tr.keys.forEach((k, i) => {
          if (typeof k.moveTo === 'string' && !allEntityIds.has(k.moveTo) && k.moveTo !== 'player') err(ctx, `${p}.keys.${i}.moveTo`, `Entité inconnue : ${k.moveTo}`);
          if (k.say) checkKey(ctx, k.say, `${p}.keys.${i}.say`);
        });
      } else if (tr.type === 'audio') {
        tr.items.forEach((it, i) => {
          if (it.sound && !session.sounds.has(it.sound)) err(ctx, `${p}.items.${i}.sound`, `Son inconnu : ${it.sound}`);
          if (it.music && !session.music.has(it.music)) err(ctx, `${p}.items.${i}.music`, `Musique inconnue : ${it.music}`);
          if (typeof it.at === 'string' && !allEntityIds.has(it.at)) err(ctx, `${p}.items.${i}.at`, `Entité inconnue : ${it.at}`);
        });
      } else if (tr.type === 'actions') {
        tr.items.forEach((it, i) => checkActions(ctx, it.actions, `${p}.items.${i}.actions`));
      } else if (tr.type === 'camera') {
        tr.keys.forEach((k, i) => {
          if (k.lookAt && k.lookAt !== 'player' && !allEntityIds.has(k.lookAt)) err(ctx, `${p}.keys.${i}.lookAt`, `Entité inconnue : ${k.lookAt}`);
        });
      }
    });
  }

  // --- Logic rules --------------------------------------------------------------------------------
  for (const doc of pack.logic) {
    ctx.file = `content/logic/${doc.id}.logic.json`;
    for (const r of doc.rules) {
      stats.rules++;
      const p = `rules.${r.id}`;
      checkEvent(ctx, r.when.event, `${p}.when.event`);
      if (r.scene && !pack.scenes.has(r.scene)) err(ctx, `${p}.scene`, `Scène inconnue : ${r.scene}`);
      checkCondition(ctx, r.if, `${p}.if`);
      checkActions(ctx, r.then, `${p}.then`);
      checkActions(ctx, r.else, `${p}.else`);
    }
  }

  // --- Items and characters ---------------------------------------------------------------------
  ctx.file = 'content/items.json';
  for (const it of pack.items) {
    checkKey(ctx, it.name, `items.${it.id}.name`);
    checkKey(ctx, it.description, `items.${it.id}.description`);
    for (const a of it.actions ?? []) {
      checkKey(ctx, a.label, `items.${it.id}.actions.${a.id}.label`);
      checkCondition(ctx, a.condition, `items.${it.id}.actions.${a.id}.condition`);
      checkActions(ctx, a.actions, `items.${it.id}.actions.${a.id}.actions`);
    }
  }
  ctx.file = 'content/characters.json';
  for (const [id, ch] of pack.characters) checkKey(ctx, ch.name, `characters.${id}.name`);

  // --- Code ---------------------------------------------------------------------------------------
  for (const { key, file } of opts.codeKeys ?? []) {
    ctx.file = file;
    checkKey(ctx, key, 'code');
  }

  await session.unloadCivilization();
  return report;
}

// =================================================================================================

interface CheckCtx {
  session: GameSession;
  civId: string;
  pack: LoadedPack;
  issues: ValidationIssue[];
  stats: ValidationReport['stats'];
  allEntityIds: Set<string>;
  spawnIds: Set<string>;
  /** Entities of the scene being checked (null outside scenes). */
  sceneEntities: Set<string> | null;
  file: string;
  scenes: Map<string, SceneDoc>;
}

function err(ctx: CheckCtx, path: string, message: string): void {
  ctx.issues.push({ pack: ctx.civId, file: ctx.file, path, severity: 'error', message });
}

function warn(ctx: CheckCtx, path: string, message: string): void {
  ctx.issues.push({ pack: ctx.civId, file: ctx.file, path, severity: 'warning', message });
}

/** Player-visible text must be a localization key known in French. */
function checkKey(ctx: CheckCtx, key: string | undefined | null, path: string, editorOnly = false): void {
  if (!key) return;
  ctx.stats.keysChecked++;
  if (ctx.session.i18n.has(key, 'fr-FR')) return;
  if (editorOnly) return;
  if (/\s/.test(key) || !/^[a-zA-Z0-9_.-]+$/.test(key)) err(ctx, path, `Texte brut au lieu d'une clé de traduction : « ${key.slice(0, 60)} »`);
  else err(ctx, path, `Clé de traduction manquante en français : ${key}`);
}

function checkEvent(ctx: CheckCtx, name: string, path: string): void {
  if (!ctx.session.logicRegistry.event(name)) warn(ctx, path, `Événement non documenté : ${name} (aucun defineEvent)`);
}

function checkVariable(ctx: CheckCtx, name: string, path: string, write: boolean): void {
  if (!name) return;
  if (name.startsWith('global.')) {
    if (write) err(ctx, path, `Les variables globales ne s'écrivent pas directement : ${name} (utiliser core.grantFragment / core.setGlobalFlag)`);
    return;
  }
  if (!name.startsWith(`${ctx.civId}.`)) err(ctx, path, `Variable hors de l'espace « ${ctx.civId}. » : ${name}`);
}

function checkCondition(ctx: CheckCtx, c: ConditionData | null | undefined, path: string): void {
  if (!c) return;
  const def = ctx.session.logicRegistry.condition(c.type);
  if (!def) {
    err(ctx, `${path}.type`, `Condition inconnue : ${c.type}`);
    return;
  }
  checkProps(ctx, def.props, c as Record<string, unknown>, path, false);
}

function checkActions(ctx: CheckCtx, list: readonly ActionData[] | null | undefined, path: string): void {
  if (!list) return;
  list.forEach((a, i) => {
    const def = ctx.session.logicRegistry.action(a.type);
    if (!def) {
      err(ctx, `${path}.${i}.type`, `Action inconnue : ${a.type}`);
      return;
    }
    checkProps(ctx, def.props, a as Record<string, unknown>, `${path}.${i}`, true);
  });
}

function checkProps(ctx: CheckCtx, schema: PropSchema, values: Record<string, unknown>, path: string, writes = false): void {
  for (const [name, def] of Object.entries(schema)) {
    const v = values[name] === undefined ? undefined : values[name];
    if (v === undefined) continue;
    checkValue(ctx, def, v, `${path}.${name}`, writes && (name === 'var' || name === 'variable'));
  }
}

function checkValue(ctx: CheckCtx, def: PropDef, v: unknown, path: string, isWrite: boolean): void {
  const s = ctx.session;
  const pack = ctx.pack;
  switch (def.kind) {
    case 'text':
      if (typeof v === 'string') checkKey(ctx, v, path);
      return;
    case 'condition':
      checkCondition(ctx, v as ConditionData | null, path);
      return;
    case 'actions':
      checkActions(ctx, v as ActionData[] | null, path);
      return;
    case 'list':
      if (Array.isArray(v)) v.forEach((item, i) => checkValue(ctx, def.item, item, `${path}.${i}`, isWrite));
      return;
    case 'object':
      if (v && typeof v === 'object') checkProps(ctx, def.fields, v as Record<string, unknown>, path);
      return;
    case 'ref': {
      if (typeof v !== 'string' || v === '') return;
      switch (def.ref) {
        case 'entity':
          if (SPECIAL_ENTITIES.has(v) || v.startsWith('$')) return;
          if (ctx.sceneEntities && !ctx.sceneEntities.has(v)) {
            if (ctx.allEntityIds.has(v)) warn(ctx, path, `Entité d'une autre scène : ${v}`);
            else err(ctx, path, `Entité inconnue : ${v}`);
          } else if (!ctx.sceneEntities && !ctx.allEntityIds.has(v)) err(ctx, path, `Entité inconnue : ${v}`);
          return;
        case 'item':
          if (!s.items.get(v)) err(ctx, path, `Objet inconnu : ${v}`);
          return;
        case 'dialogue':
          if (!pack.dialogues.has(v)) err(ctx, path, `Dialogue inconnu : ${v}`);
          return;
        case 'quest':
          if (!pack.quests.has(v)) err(ctx, path, `Quête inconnue : ${v}`);
          return;
        case 'cinematic':
          if (!pack.cinematics.has(v)) err(ctx, path, `Cinématique inconnue : ${v}`);
          return;
        case 'scene':
          if (!pack.scenes.has(v)) err(ctx, path, `Scène inconnue : ${v}`);
          return;
        case 'spawn':
          if (!ctx.allEntityIds.has(v)) err(ctx, path, `Repère inconnu : ${v}`);
          return;
        case 'sound':
          if (!s.sounds.has(v) && !s.music.has(v)) err(ctx, path, `Son inconnu : ${v}`);
          return;
        case 'music':
          if (!s.music.has(v)) err(ctx, path, `Musique inconnue : ${v}`);
          return;
        case 'model':
          if (!s.models.has(v)) err(ctx, path, `Modèle inconnu : ${v}`);
          return;
        case 'character':
          if (!s.characterDoc(v)) err(ctx, path, `Apparence inconnue : ${v}`);
          return;
        case 'block':
          if (!s.blocks.get(v)) err(ctx, path, `Bloc inconnu : ${v}`);
          return;
        case 'variable':
          checkVariable(ctx, v, path, isWrite);
          return;
        case 'panel':
          if (!s.civ?.panels.has(v)) err(ctx, path, `Panneau inconnu : ${v}`);
          return;
        case 'ability':
          if (!s.civ?.abilities.has(v)) err(ctx, path, `Capacité inconnue : ${v}`);
          return;
        case 'event':
          checkEvent(ctx, v, path);
          return;
        default:
          return;
      }
    }
    default:
      return;
  }
}

function referencesObjective(pack: LoadedPack, scenes: Map<string, SceneDoc>, questId: string, objectiveId: string): boolean {
  const needle = (a: unknown): boolean => {
    if (Array.isArray(a)) return a.some(needle);
    if (a && typeof a === 'object') {
      const o = a as Record<string, unknown>;
      if (o.type === 'core.completeObjective' && o.quest === questId && o.objective === objectiveId) return true;
      return Object.values(o).some(needle);
    }
    return false;
  };
  return (
    [...pack.dialogues.values()].some(needle) ||
    [...pack.quests.values()].some(needle) ||
    [...pack.cinematics.values()].some(needle) ||
    pack.logic.some(needle) ||
    pack.items.some(needle) ||
    [...scenes.values()].some((sc) => sc.entities.some(needle))
  );
}

/** Extracts literal `t('key')` / `ctx.t("key")` keys from source code (for codeKeys). */
export function extractCodeKeys(source: string): string[] {
  const out = new Set<string>();
  const re = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.add(m[1]!);
  return [...out];
}
