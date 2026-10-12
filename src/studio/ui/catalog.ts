/**
 * What the Studio's pickers offer for each kind of reference (entities, items, dialogues,
 * sounds, variables...). Labels are French; unknown values stay editable as free text.
 */
import type { RefKind } from '@engine/core/props/props';
import type { CharactersSchema, SceneDoc } from '@engine/core/content/schemas';
import type { z } from 'zod';
import type { Studio } from '../core/studio';
import type { DocKind } from '../core/project';
import { generateTile, TILE_SIZE } from '@engine/core/voxel/textures/generators';
import { BlockRegistry, type ResolvedBlockDef } from '@engine/core/voxel/blocks';

export interface Option {
  value: string;
  label: string;
  group?: string;
}

function docIds(studio: Studio, kind: DocKind): Option[] {
  const packs = studio.packId ? [studio.packId, ...(studio.session.manifests.get(studio.packId)?.dependencies ?? [])] : [];
  return packs.flatMap((p) => studio.project.docsOf(p, kind).map((d) => ({ value: d.id, label: d.id, group: p })));
}

let varCache: { version: number; names: string[] } | null = null;

/** Story variables used anywhere in the active pack's content (for suggestions). */
export function knownVariables(studio: Studio): string[] {
  const v = studio.getVersion();
  if (varCache && varCache.version === v) return varCache.names;
  const names = new Set<string>();
  const re = /"(?:var|variable|consent|examineVar|flag)":\s*"([A-Za-z0-9_.:-]+)"/g;
  for (const doc of studio.project.docsOf(studio.packId ?? '')) {
    if (!doc.loaded || typeof doc.data !== 'object') continue;
    const text = JSON.stringify(doc.data);
    for (const m of text.matchAll(re)) names.add(m[1]!);
  }
  varCache = { version: v, names: [...names].sort() };
  return varCache.names;
}

export function refOptions(studio: Studio, kind: RefKind, withComponent?: string): Option[] {
  const s = studio.session;
  switch (kind) {
    case 'entity': {
      const scene = studio.sceneDoc();
      const list = (scene?.entities ?? []).filter((e) => !withComponent || e.components[withComponent]);
      return [{ value: 'player', label: 'Le joueur', group: 'Spécial' }, ...list.map((e) => ({ value: e.id, label: e.name ? `${e.id} — ${e.name}` : e.id, group: e.folder ?? 'Scène' }))];
    }
    case 'spawn': {
      const out: Option[] = [];
      for (const doc of studio.project.docsOf(studio.packId ?? '', 'scene')) {
        const scene = doc.data as SceneDoc | null;
        for (const e of scene?.entities ?? []) if (e.components['core.spawn']) out.push({ value: e.id, label: e.id, group: doc.id });
      }
      return out;
    }
    case 'item':
      return s.items.all().map((i) => ({ value: i.id, label: `${s.t(i.name)} (${i.id})`, group: i.id.split(':')[0] }));
    case 'dialogue':
      return docIds(studio, 'dialogue');
    case 'quest':
      return docIds(studio, 'quest');
    case 'cinematic':
      return docIds(studio, 'cinematic');
    case 'scene':
      return docIds(studio, 'scene');
    case 'prefab':
      return docIds(studio, 'prefab');
    case 'sound':
      return [...s.sounds.entries()].map(([id, v]) => ({ value: id, label: `${v.def.label ?? id}`, group: v.def.category }));
    case 'music':
      return [...s.music.entries()].map(([id, v]) => ({ value: id, label: v.def.label ?? id, group: 'Musiques' }));
    case 'model':
      return s.models.all().map((m) => ({ value: m.id, label: m.label ?? m.id, group: m.category ?? m.id.split(':')[0] }));
    case 'block':
      return s.blocks.all().map((b) => ({ value: b.id, label: b.label, group: b.category }));
    case 'character': {
      const out: Option[] = [];
      for (const pack of s.loadedPacks.keys()) {
        for (const doc of studio.project.docsOf(pack, 'characters')) {
          const data = doc.data as z.infer<typeof CharactersSchema> | null;
          for (const c of data?.characters ?? []) out.push({ value: c.id, label: `${s.t(c.name)} (${c.id})`, group: pack });
        }
      }
      return out;
    }
    case 'variable':
      return knownVariables(studio).map((v) => ({ value: v, label: v }));
    case 'event':
      return s.logicRegistry.listEvents().map((e) => ({ value: e.id, label: `${e.label} (${e.id})`, group: e.id.split('.')[0] }));
    case 'panel':
      return [...s.loadedPacks.values()].flatMap((p) => p.defs.panels.map((d) => ({ value: d.id, label: d.id, group: p.manifest.id })));
    case 'ability':
      return [...s.loadedPacks.values()].flatMap((p) => p.defs.abilities.map((d) => ({ value: d.id, label: d.id, group: p.manifest.id })));
    default:
      return [];
  }
}

// ------------------------------------------------------------------------------------------------
// Block swatches (the side texture of each block, as a small image)
// ------------------------------------------------------------------------------------------------

const swatchCache = new Map<string, string>();

export function blockSwatch(def: ResolvedBlockDef | undefined): string {
  if (!def || typeof document === 'undefined') return '';
  const spec = BlockRegistry.faceTexture(def, 0);
  const key = JSON.stringify([spec.gen, spec.colors, spec.seed ?? 0, spec.params ?? {}]);
  const cached = swatchCache.get(key);
  if (cached) return cached;
  const pixels = generateTile(spec.gen, spec.colors, spec.seed ?? 0, spec.params ?? {});
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const g = canvas.getContext('2d');
  if (!g) return '';
  const img = g.createImageData(TILE_SIZE, TILE_SIZE);
  img.data.set(pixels);
  g.putImageData(img, 0, 0);
  const url = canvas.toDataURL();
  swatchCache.set(key, url);
  return url;
}
