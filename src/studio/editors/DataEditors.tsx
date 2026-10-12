/**
 * Editors of the civilization's data files: items, characters (with a 3D preview), mechanic
 * rules, French texts, prefabs.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import { prop, type PropSchema } from '@engine/core/props/props';
import type { CharacterDoc, CharactersSchema, ItemsSchema, PrefabDoc, RulesDoc } from '@engine/core/content/schemas';
import { ACCESSORY_TYPES } from '@engine/core/content/schemas';
import { ICON_SHAPES } from '@engine/core/inventory/items';
import { CharacterRig } from '@engine/view/characters/rig';
import type { StringTable } from '@engine/core/i18n/localizer';
import { frenchApostrophes } from '@engine/core/i18n/typography';
import type { z } from 'zod';
import { PropFields } from '../fields/PropField';
import { freeId, removeAt, replaceAt, Row, useDoc } from './common';
import { placePrefab } from '../viewport/ViewportPanel';
import { viewportRef } from '../hooks';

// ------------------------------------------------------------------------------------------------
// Items
// ------------------------------------------------------------------------------------------------

type ItemsDoc = z.infer<typeof ItemsSchema>;
type ItemDoc = ItemsDoc['items'][number];

const ITEM_SCHEMA: PropSchema = {
  name: prop.text({ label: 'Nom' }),
  description: prop.text({ label: 'Description', multiline: true }),
  category: prop.enum(
    [
      { value: 'key', label: 'Clé' },
      { value: 'quest', label: 'Objet de quête' },
      { value: 'document', label: 'Document' },
      { value: 'tool', label: 'Outil' },
      { value: 'consumable', label: 'Consommable' },
      { value: 'equipment', label: 'Équipement' },
      { value: 'collectible', label: 'À collectionner' },
      { value: 'misc', label: 'Divers' },
    ],
    { label: 'Catégorie', default: 'misc' },
  ),
  icon: prop.object(
    {
      shape: prop.enum(
        ICON_SHAPES.map((s) => ({ value: s, label: s })),
        { label: 'Forme', default: 'box' },
      ),
      color: prop.color({ label: 'Couleur', default: '#c8a060' }),
      accent: prop.color({ label: 'Accent', default: '#ffffff' }),
      glow: prop.boolean({ label: 'Lumineux' }),
    },
    { label: 'Icône' },
  ),
  questItem: prop.boolean({ label: 'Objet de quête (ne se jette pas)' }),
  stackable: prop.boolean({ label: 'Empilable' }),
  maxStack: prop.integer({ label: 'Pile maximale', default: 99, min: 1 }),
  tags: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Étiquettes' }),
};

export function ItemsEditor({ path }: { path: string }) {
  const h = useDoc<ItemsDoc>(path);
  const [sel, setSel] = useState(0);
  if (!h) return null;
  const { data, edit, env, studio } = h;
  const item = data.items[sel];
  return (
    <div className="st-editor">
      <h2>Objets</h2>
      <div className="st-split">
        <div className="st-split__list">
          <ul className="st-tree">
            {data.items.map((it, i) => (
              <li key={it.id}>
                <button type="button" className={`st-tree__item ${i === sel ? 'is-selected' : ''}`} onClick={() => setSel(i)}>
                  <span className="st-swatch" style={{ background: it.icon.color }} />
                  {studio.t(it.name)}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="st-btn st-btn--small"
            style={{ marginTop: 8 }}
            onClick={() =>
              studio.history.transaction('Nouvel objet', () => {
                const short = freeId(
                  data.items.map((i) => i.id.split(':')[1] ?? i.id),
                  'objet',
                );
                const id = `${h.doc.pack}:${short}`;
                const name = studio.newTextKey(`item.${short}`, 'Nouvel objet');
                const description = studio.newTextKey(`item.${short}.desc`, 'Description de l’objet.');
                edit('Nouvel objet', (d) => ({ ...d, items: [...d.items, { id, name, description, category: 'misc', icon: { shape: 'box', color: '#c8a060' } }] }));
                setSel(data.items.length);
              })
            }
          >
            ＋ Objet
          </button>
        </div>
        {item ? (
          <div>
            <Row label="Identifiant">
              <input className="st-input st-input--mono" value={item.id} onChange={(e) => edit('Identifiant d’objet', (d) => ({ ...d, items: replaceAt(d.items, sel, { ...item, id: e.target.value }) }), `id${sel}`)} />
            </Row>
            <PropFields
              schema={ITEM_SCHEMA}
              value={item as unknown as Record<string, unknown>}
              env={{ ...env, keyHint: `item.${item.id.split(':')[1] ?? item.id}` }}
              onChange={(next, m) => edit('Modifier un objet', (d) => ({ ...d, items: replaceAt(d.items, sel, { ...item, ...(next as unknown as ItemDoc) }) }), m ? `item${sel}|${m}` : undefined)}
            />
            <button type="button" className="st-btn st-btn--small st-btn--danger" onClick={() => (edit('Supprimer un objet', (d) => ({ ...d, items: removeAt(d.items, sel) })), setSel(0))}>
              Supprimer l’objet
            </button>
          </div>
        ) : (
          <div className="st-empty">Aucun objet.</div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Characters (NPC appearance) with a live 3D preview
// ------------------------------------------------------------------------------------------------

type CharactersDoc = z.infer<typeof CharactersSchema>;

const CHARACTER_SCHEMA: PropSchema = {
  name: prop.text({ label: 'Nom affiché' }),
  build: prop.object(
    {
      body: prop.enum(
        [
          { value: 'adult', label: 'Adulte' },
          { value: 'slim', label: 'Mince' },
          { value: 'broad', label: 'Carré' },
          { value: 'child', label: 'Enfant' },
          { value: 'elder', label: 'Âgé' },
        ],
        { label: 'Silhouette', default: 'adult' },
      ),
      height: prop.number({ label: 'Taille', min: 0.6, max: 1.3, step: 0.01, slider: true, default: 1 }),
    },
    { label: 'Corps' },
  ),
  skin: prop.color({ label: 'Peau', default: '#d8a888' }),
  eyes: prop.color({ label: 'Yeux', default: '#4a3a2a' }),
  hair: prop.object(
    {
      style: prop.enum(
        [
          ['short', 'Courts'],
          ['long', 'Longs'],
          ['bun', 'Chignon'],
          ['ponytail', 'Queue de cheval'],
          ['curly', 'Bouclés'],
          ['bald', 'Chauve'],
          ['braids', 'Tresses'],
          ['mohawk', 'Crête'],
          ['swept', 'Mèche'],
          ['bob', 'Carré'],
        ].map(([value, label]) => ({ value: value!, label: label! })),
        { label: 'Coiffure', default: 'short' },
      ),
      color: prop.color({ label: 'Couleur', default: '#3a2a1e' }),
    },
    { label: 'Cheveux' },
  ),
  face: prop.object(
    {
      brows: prop.color({ label: 'Sourcils', default: '#3a2a1e' }),
      freckles: prop.boolean({ label: 'Taches de rousseur' }),
      blush: prop.boolean({ label: 'Joues rosées' }),
      scar: prop.boolean({ label: 'Cicatrice' }),
      wrinkles: prop.boolean({ label: 'Rides' }),
    },
    { label: 'Visage' },
  ),
  outfit: prop.object(
    {
      style: prop.enum(
        [
          ['tunic', 'Tunique'],
          ['coat', 'Manteau'],
          ['robe', 'Robe longue'],
          ['dress', 'Robe'],
          ['vest', 'Gilet'],
          ['uniform', 'Uniforme'],
          ['rags', 'Haillons'],
          ['shirt', 'Chemise'],
        ].map(([value, label]) => ({ value: value!, label: label! })),
        { label: 'Tenue', default: 'tunic' },
      ),
      top: prop.color({ label: 'Haut', default: '#6a5a4a' }),
      bottom: prop.color({ label: 'Bas', default: '#3a3a3a' }),
      shoes: prop.color({ label: 'Chaussures', default: '#2a2220' }),
      accent: prop.color({ label: 'Accent', default: '#c8a060' }),
    },
    { label: 'Vêtements' },
  ),
  accessories: prop.list(
    prop.object(
      {
        type: prop.enum(
          ACCESSORY_TYPES.map((a) => ({ value: a, label: a })),
          { label: 'Accessoire', default: 'hat' },
        ),
        color: prop.color({ label: 'Couleur', default: '#6a4a2e' }),
      },
      { label: 'Accessoire' },
    ),
    { label: 'Accessoires' },
  ),
  idle: prop.enum(
    [
      { value: 'calm', label: 'Calme' },
      { value: 'nervous', label: 'Nerveux' },
      { value: 'proud', label: 'Fier' },
      { value: 'tired', label: 'Fatigué' },
      { value: 'playful', label: 'Enjoué' },
    ],
    { label: 'Attitude', default: 'calm' },
  ),
  voicePitch: prop.number({ label: 'Hauteur de voix (bips)', min: 0.5, max: 2, step: 0.05, default: 1 }),
};

function CharacterPreview({ doc }: { doc: CharacterDoc }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{ engine: Engine; scene: Scene; rig: CharacterRig | null } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true }, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.09, 0.1, 0.13, 1);
    const cam = new ArcRotateCamera('aperçu', Math.PI / 2 + 0.5, 1.25, 3.4, new Vector3(0, 0.9, 0), scene);
    cam.attachControl(canvas, true);
    cam.lowerRadiusLimit = 1.5;
    cam.upperRadiusLimit = 6;
    cam.wheelPrecision = 60;
    const sky = new HemisphericLight('ciel', new Vector3(0, 1, 0), scene);
    sky.intensity = 0.75;
    sky.groundColor = new Color3(0.35, 0.33, 0.3);
    // A light that follows the camera: whichever side is looked at stays readable.
    const fill = new DirectionalLight('frontal', new Vector3(0, -0.3, 1), scene);
    fill.intensity = 0.55;
    scene.onBeforeRenderObservable.add(() => {
      fill.direction.copyFrom(cam.target.subtract(cam.position).normalize());
      fill.direction.y -= 0.35;
    });
    sceneRef.current = { engine, scene, rig: null };
    engine.runRenderLoop(() => scene.render());
    return () => {
      sceneRef.current = null;
      engine.dispose();
    };
  }, []);
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.rig?.dispose();
    try {
      s.rig = new CharacterRig(s.scene, doc, 'aperçu', null);
    } catch {
      s.rig = null;
    }
  }, [doc]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: 320, borderRadius: 8, border: '1px solid var(--st-border)' }} data-testid="st-character-preview" />;
}

export function CharactersEditor({ path }: { path: string }) {
  const h = useDoc<CharactersDoc>(path);
  const [sel, setSel] = useState(0);
  if (!h) return null;
  const { data, edit, env, studio } = h;
  const c = data.characters[sel];
  return (
    <div className="st-editor">
      <h2>Personnages</h2>
      <div className="st-split" style={{ gridTemplateColumns: '220px minmax(0, 1fr) 300px' }}>
        <div className="st-split__list">
          <ul className="st-tree">
            {data.characters.map((ch, i) => (
              <li key={ch.id}>
                <button type="button" className={`st-tree__item ${i === sel ? 'is-selected' : ''}`} onClick={() => setSel(i)}>
                  <span className="st-swatch" style={{ background: ch.outfit.top }} />
                  {studio.t(ch.name)}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="st-btn st-btn--small"
            style={{ marginTop: 8 }}
            onClick={() =>
              studio.history.transaction('Nouveau personnage', () => {
                const short = freeId(
                  data.characters.map((x) => x.id.split(':')[1] ?? x.id),
                  'personnage',
                );
                const base = data.characters[sel] ?? data.characters[0];
                const name = studio.newTextKey(`npc.${short}`, 'Nouveau personnage');
                const fresh: CharacterDoc = base
                  ? { ...structuredClone(base), id: `${h.doc.pack}:${short}`, name }
                  : {
                      id: `${h.doc.pack}:${short}`,
                      name,
                      build: { body: 'adult', height: 1 },
                      skin: '#d8a888',
                      eyes: '#4a3a2a',
                      hair: { style: 'short', color: '#3a2a1e' },
                      face: {},
                      outfit: { style: 'tunic', top: '#6a5a4a', bottom: '#3a3a3a', shoes: '#2a2220', accent: '#c8a060' },
                      accessories: [],
                      idle: 'calm',
                      voicePitch: 1,
                    };
                edit('Nouveau personnage', (d) => ({ ...d, characters: [...d.characters, fresh] }));
                setSel(data.characters.length);
              })
            }
          >
            ＋ Personnage
          </button>
        </div>
        {c ? (
          <>
            <div>
              <Row label="Identifiant">
                <input className="st-input st-input--mono" value={c.id} onChange={(e) => edit('Identifiant', (d) => ({ ...d, characters: replaceAt(d.characters, sel, { ...c, id: e.target.value }) }), `id${sel}`)} />
              </Row>
              <PropFields
                schema={CHARACTER_SCHEMA}
                value={c as unknown as Record<string, unknown>}
                env={{ ...env, keyHint: `npc.${c.id.split(':')[1] ?? c.id}` }}
                onChange={(next, m) => edit('Modifier un personnage', (d) => ({ ...d, characters: replaceAt(d.characters, sel, { ...c, ...(next as unknown as CharacterDoc) }) }), m ? `ch${sel}|${m}` : undefined)}
              />
              <button type="button" className="st-btn st-btn--small st-btn--danger" onClick={() => (edit('Supprimer un personnage', (d) => ({ ...d, characters: removeAt(d.characters, sel) })), setSel(0))}>
                Supprimer le personnage
              </button>
            </div>
            <div>
              <CharacterPreview doc={c} />
              <p className="st-field__help">Glisser pour tourner autour, molette pour zoomer.</p>
            </div>
          </>
        ) : (
          <div className="st-empty">Aucun personnage.</div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Mechanic rules (content/rules.json)
// ------------------------------------------------------------------------------------------------

export function RulesEditor({ path }: { path: string }) {
  const h = useDoc<RulesDoc>(path);
  if (!h) return null;
  const { data, edit, env, studio } = h;
  const pack = studio.session.loadedPacks.get(h.doc.pack);
  const mechanics = (pack?.defs.mechanics ?? []).filter((m) => m.settings && Object.keys(m.settings).length > 0);
  return (
    <div className="st-editor">
      <h2>Règles des mécaniques</h2>
      <p className="st-field__help">Les réglages de chaque mécanique du pack (déclarés par son code avec des propriétés typées) s’éditent ici, sans toucher au code.</p>
      {mechanics.length === 0 && <div className="st-empty">Aucune mécanique réglable dans ce pack.</div>}
      {mechanics.map((m) => (
        <section key={m.id} className="st-section" style={{ border: '1px solid var(--st-border)', borderRadius: 8, marginBottom: '0.8rem' }}>
          <div className="st-section__head" style={{ cursor: 'default' }}>
            {m.label}
            <small>{m.id}</small>
          </div>
          <div className="st-section__body">
            {m.description && <p className="st-field__help">{m.description}</p>}
            <PropFields
              schema={m.settings!}
              value={(data.settings[m.id] ?? {}) as Record<string, unknown>}
              env={{ ...env, keyHint: `rules.${m.id}` }}
              onChange={(next, merge) => edit(`Règles : ${m.label}`, (d) => ({ ...d, settings: { ...d.settings, [m.id]: next } }), merge ? `${m.id}|${merge}` : undefined)}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// French texts (locales/fr-FR.json)
// ------------------------------------------------------------------------------------------------

export function LocaleEditor({ path }: { path: string }) {
  const h = useDoc<StringTable>(path);
  const [filter, setFilter] = useState('');
  const [newKey, setNewKey] = useState('');
  const keys = useMemo(() => Object.keys(h?.data ?? {}), [h?.data]);
  if (!h) return null;
  const { data, edit, studio, doc } = h;
  const f = filter.trim().toLowerCase();
  const shown = keys.filter((k) => !f || k.toLowerCase().includes(f) || (data[k] ?? '').toLowerCase().includes(f)).slice(0, 400);
  const setText = (k: string, v: string) => {
    edit('Modifier un texte', (d) => ({ ...d, [k]: frenchApostrophes(v) }), `texte:${k}`);
    studio.syncLocales(doc.pack);
  };
  return (
    <div className="st-editor" data-testid="st-locale-editor">
      <h2>Textes français — {doc.pack}</h2>
      <p className="st-field__help">
        Tous les textes vus par le joueur passent par ces clés. {keys.length} textes. Les espaces insécables de la typographie française sont conservées.
      </p>
      <div className="st-row" style={{ marginBottom: 8 }}>
        <input className="st-input" placeholder="Chercher une clé ou un texte…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <input className="st-input st-input--mono" placeholder={`${doc.pack}.nouvelle.cle`} value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ maxWidth: 260 }} />
        <button
          type="button"
          className="st-btn"
          disabled={!/^[A-Za-z0-9_.-]+$/.test(newKey) || newKey in data}
          onClick={() => {
            edit('Nouvelle clé', (d) => ({ ...d, [newKey]: '' }));
            studio.syncLocales(doc.pack);
            setFilter(newKey);
            setNewKey('');
          }}
        >
          ＋ Clé
        </button>
      </div>
      <table className="st-table">
        <thead>
          <tr>
            <th>Clé</th>
            <th>Texte</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((k) => (
            <tr key={k}>
              <td className="st-mono">{k}</td>
              <td>
                {(data[k] ?? '').length > 60 ? (
                  <textarea className="st-textarea" value={data[k] ?? ''} onChange={(e) => setText(k, e.target.value)} />
                ) : (
                  <input className={`st-input ${(data[k] ?? '') === '' ? 'is-invalid' : ''}`} value={data[k] ?? ''} onChange={(e) => setText(k, e.target.value)} />
                )}
              </td>
              <td>
                <button
                  type="button"
                  className="st-btn st-btn--small st-btn--ghost st-btn--danger"
                  title="Supprimer la clé (vérifiez d’abord qu’elle n’est plus utilisée : « Valider »)"
                  onClick={() => {
                    edit('Supprimer une clé', (d) => {
                      const { [k]: _gone, ...rest } = d;
                      return rest;
                    });
                    studio.syncLocales(doc.pack);
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {keys.length > shown.length && <p className="st-field__help">{keys.length - shown.length} autres textes : affinez la recherche.</p>}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Prefabs
// ------------------------------------------------------------------------------------------------

export function PrefabEditor({ path }: { path: string }) {
  const h = useDoc<PrefabDoc>(path);
  if (!h) return null;
  const { data, edit, studio } = h;
  return (
    <div className="st-editor">
      <h2>Préfabriqué — {data.label}</h2>
      <Row label="Nom">
        <input className="st-input" value={data.label} onChange={(e) => edit('Nom du préfabriqué', (d) => ({ ...d, label: e.target.value }), 'label')} />
      </Row>
      <Row label="Catégorie">
        <input className="st-input" value={data.category} onChange={(e) => edit('Catégorie', (d) => ({ ...d, category: e.target.value }), 'cat')} />
      </Row>
      <Row label="Contenu">
        <div className="st-field__key">
          {data.voxels ? `${data.voxels.size.join(' × ')} blocs` : 'sans blocs'} · {data.entities.length} entité(s) : {data.entities.map((e) => e.id).join(', ')}
        </div>
      </Row>
      <button
        type="button"
        className="st-btn st-btn--primary"
        disabled={!studio.scenePath || !viewportRef.current}
        onClick={() => {
          placePrefab(studio, data);
          const scene = studio.tabs.find((t) => t.kind === 'scene');
          if (scene) void studio.openDoc(scene.path);
        }}
      >
        Placer dans la scène ouverte
      </button>
    </div>
  );
}
