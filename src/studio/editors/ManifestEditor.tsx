/**
 * Civilization settings: identity, entry point, multiverse fragments, and the look of its
 * interface (theme colors and fonts, HUD elements shown or hidden) with a live preview.
 */
import type { CSSProperties } from 'react';
import { prop, type PropSchema } from '@engine/core/props/props';
import type { PackManifest } from '@engine/core/content/schemas';
import { ICON_SHAPES } from '@engine/core/inventory/items';
import { PropFields, RefInput, TextField } from '../fields/PropField';
import { Row, useDoc } from './common';

const HUD_ELEMENTS: [string, string][] = [
  ['crosshair', 'Réticule'],
  ['prompt', 'Invite d’interaction'],
  ['objectives', 'Objectifs suivis'],
  ['notifications', 'Notifications'],
  ['inventory', 'Inventaire (touche I)'],
  ['abilities', 'Barre de capacités'],
  ['location', 'Titre des lieux'],
];

const THEME_SCHEMA: PropSchema = {
  accent: prop.color({ label: 'Accent', default: '#e8c27a' }),
  accentSoft: prop.color({ label: 'Accent secondaire', default: '#7fb7d9' }),
  text: prop.color({ label: 'Texte', default: '#efe9dc' }),
  textDim: prop.color({ label: 'Texte atténué', default: '#a8a296' }),
  panel: prop.string({ label: 'Fond des panneaux (CSS)', default: 'rgba(14, 16, 22, 0.86)' }),
  panelBorder: prop.string({ label: 'Bordure des panneaux (CSS)', default: 'rgba(232, 194, 122, 0.35)' }),
  font: prop.enum(
    [
      { value: '"Alegreya Sans", system-ui, sans-serif', label: 'Alegreya Sans' },
      { value: '"Cormorant Garamond", Georgia, serif', label: 'Cormorant Garamond' },
      { value: '"IM Fell English", Georgia, serif', label: 'IM Fell English' },
    ],
    { label: 'Police du texte', default: '"Alegreya Sans", system-ui, sans-serif' },
  ),
  titleFont: prop.enum(
    [
      { value: '"Cinzel", Georgia, serif', label: 'Cinzel' },
      { value: '"Cormorant Garamond", Georgia, serif', label: 'Cormorant Garamond' },
      { value: '"IM Fell English", Georgia, serif', label: 'IM Fell English' },
      { value: '"Alegreya Sans", system-ui, sans-serif', label: 'Alegreya Sans' },
    ],
    { label: 'Police des titres', default: '"Cinzel", Georgia, serif' },
  ),
};

export function ManifestEditor({ path }: { path: string }) {
  const h = useDoc<PackManifest>(path);
  if (!h) return null;
  const { data, edit, env, studio } = h;
  const set = <K extends keyof PackManifest>(k: K, v: PackManifest[K], label: string, merge?: string) => edit(label, (d) => ({ ...d, [k]: v }), merge ? `${String(k)}|${merge}` : undefined);
  const theme = data.theme ?? { accent: '#e8c27a' };
  const hidden = new Set(data.hud?.hide ?? []);
  return (
    <div className="st-editor" data-testid="st-manifest-editor">
      <h2>Civilisation « {data.id} »</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: '1.2rem' }}>
        <div>
          <h3>Identité</h3>
          <Row label="Nom">
            <TextField value={data.name} env={{ ...env, keyHint: 'name' }} onChange={(k, m) => set('name', k, 'Nom', m)} />
          </Row>
          <Row label="Accroche">
            <TextField value={data.tagline ?? ''} env={{ ...env, keyHint: 'tagline' }} onChange={(k, m) => set('tagline', k || undefined, 'Accroche', m)} />
          </Row>
          <Row label="Description">
            <TextField value={data.description} multiline env={{ ...env, keyHint: 'description' }} onChange={(k, m) => set('description', k, 'Description', m)} />
          </Row>
          <Row label="Version du pack">
            <input className="st-input st-input--mono" value={data.packVersion} onChange={(e) => set('packVersion', e.target.value, 'Version du pack', 'v')} />
          </Row>
          <Row label="API du moteur" help="Plage semver de l’API du moteur pour laquelle le pack est écrit">
            <input className="st-input st-input--mono" value={data.engineApi} onChange={(e) => set('engineApi', e.target.value, 'API du moteur', 'api')} />
          </Row>
          <Row label="Ordre dans la sélection">
            <input className="st-input" type="number" value={data.order} onChange={(e) => set('order', Number(e.target.value), 'Ordre', 'order')} />
          </Row>
          <h3>Point d’entrée</h3>
          <Row label="Scène">
            <RefInput kind="scene" value={data.entry?.scene ?? ''} env={env} onChange={(v, m) => set('entry', { scene: v, spawn: data.entry?.spawn ?? '' }, 'Scène d’entrée', m)} />
          </Row>
          <Row label="Apparition">
            <RefInput kind="spawn" value={data.entry?.spawn ?? ''} env={env} onChange={(v, m) => set('entry', { scene: data.entry?.scene ?? '', spawn: v }, 'Point d’apparition', m)} />
          </Row>
          <h3>Multivers</h3>
          <PropFields
            schema={{
              globalWrites: prop.list(prop.string({ label: 'Chemin', placeholder: 'fragments.mon_fragment' }), { label: 'Écritures globales autorisées' }),
              fragments: prop.list(
                prop.object(
                  {
                    id: prop.string({ label: 'Identifiant' }),
                    name: prop.text({ label: 'Nom' }),
                    hint: prop.text({ label: 'Indice' }),
                    icon: prop.enum(
                      ICON_SHAPES.map((s) => ({ value: s, label: s })),
                      { label: 'Icône', default: 'fragment' },
                    ),
                  },
                  { label: 'Fragment' },
                ),
                { label: 'Fragments du registre multiversel' },
              ),
            }}
            value={{ globalWrites: data.globalWrites, fragments: data.fragments }}
            env={{ ...env, keyHint: 'fragment' }}
            onChange={(next, m) => edit('Multivers', (d) => ({ ...d, globalWrites: next.globalWrites as string[], fragments: next.fragments as PackManifest['fragments'] }), m ? `mv|${m}` : undefined)}
          />
          <h3>Divers</h3>
          <PropFields
            schema={{
              dependencies: prop.list(prop.string({ label: 'Pack' }), { label: 'Dépendances' }),
              credits: prop.list(prop.string({ label: 'Ligne' }), { label: 'Crédits' }),
              tags: prop.list(prop.string({ label: 'Mot-clé' }), { label: 'Mots-clés' }),
            }}
            value={{ dependencies: data.dependencies, credits: data.credits, tags: data.tags }}
            env={env}
            onChange={(next, m) => edit('Informations', (d) => ({ ...d, ...(next as Partial<PackManifest>) }), m ? `misc|${m}` : undefined)}
          />
        </div>
        <div>
          <h3>Interface (HUD)</h3>
          <HudPreview manifest={data} title={studio.t(data.name)} />
          <Row label="Éléments affichés">
            <div>
              {HUD_ELEMENTS.map(([id, label]) => (
                <label key={id} className="st-check" style={{ display: 'flex' }}>
                  <input
                    type="checkbox"
                    checked={!hidden.has(id)}
                    onChange={(e) => {
                      const next = new Set(hidden);
                      if (e.target.checked) next.delete(id);
                      else next.add(id);
                      set('hud', { hide: [...next] }, 'Éléments du HUD');
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Row>
          <h3>Thème</h3>
          <PropFields schema={THEME_SCHEMA} value={theme as unknown as Record<string, unknown>} env={env} onChange={(next, m) => set('theme', next as unknown as PackManifest['theme'], 'Thème', m)} />
          <h3>Vignette de sélection</h3>
          <PropFields
            schema={{
              colors: prop.list(prop.color({ label: 'Couleur', default: '#202020' }), { label: 'Dégradé' }),
              motif: prop.enum(
                [
                  { value: 'default', label: 'Sobre' },
                  { value: 'door', label: 'Porte' },
                  { value: 'memory', label: 'Éclats' },
                ],
                { label: 'Motif', default: 'default' },
              ),
            }}
            value={(data.cover ?? { colors: ['#14161c', '#3a3020'], motif: 'default' }) as unknown as Record<string, unknown>}
            env={env}
            onChange={(next, m) => set('cover', next as unknown as PackManifest['cover'], 'Vignette', m)}
          />
        </div>
      </div>
    </div>
  );
}

function HudPreview({ manifest, title }: { manifest: PackManifest; title: string }) {
  const t = manifest.theme;
  const hidden = new Set(manifest.hud?.hide ?? []);
  const vars = {
    '--p-accent': t?.accent ?? '#e8c27a',
    '--p-soft': t?.accentSoft ?? '#7fb7d9',
    '--p-panel': t?.panel ?? 'rgba(14, 16, 22, 0.86)',
    '--p-border': t?.panelBorder ?? 'rgba(232, 194, 122, 0.35)',
    '--p-text': t?.text ?? '#efe9dc',
    '--p-dim': t?.textDim ?? '#a8a296',
  } as CSSProperties;
  const colors = manifest.cover?.colors ?? ['#1a1d24', '#3a3020'];
  const panel: CSSProperties = { background: 'var(--p-panel)', border: '1px solid var(--p-border)', borderRadius: 8, color: 'var(--p-text)', fontFamily: t?.font, padding: '0.35rem 0.6rem', fontSize: 12 };
  return (
    <div style={{ ...vars, position: 'relative', height: 230, borderRadius: 8, overflow: 'hidden', background: `linear-gradient(160deg, ${colors.join(', ')})`, marginBottom: 8 }} data-testid="st-hud-preview">
      {!hidden.has('location') && (
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, textAlign: 'center', fontFamily: t?.titleFont, color: 'var(--p-text)', fontSize: 20, textShadow: '0 2px 8px #000' }}>
          {title}
          <div style={{ fontFamily: t?.font, fontSize: 10, letterSpacing: '0.3em', color: 'var(--p-accent)' }}>SOUS-TITRE DU LIEU</div>
        </div>
      )}
      {!hidden.has('objectives') && (
        <div style={{ ...panel, position: 'absolute', top: 8, right: 8, width: 150 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--p-accent)' }}>QUÊTES PRINCIPALES</div>
          <div style={{ fontFamily: t?.titleFont }}>Une quête</div>
          <div style={{ color: 'var(--p-dim)' }}>☐ Un objectif</div>
        </div>
      )}
      {!hidden.has('notifications') && <div style={{ ...panel, position: 'absolute', top: 120, left: 8, borderLeft: '3px solid var(--p-soft)' }}>✦ Une notification</div>}
      {!hidden.has('crosshair') && <div style={{ position: 'absolute', left: '50%', top: '58%', width: 6, height: 6, marginLeft: -3, borderRadius: 3, background: 'var(--p-text)' }} />}
      {!hidden.has('prompt') && (
        <div style={{ ...panel, position: 'absolute', left: '50%', top: '66%', transform: 'translateX(-50%)' }}>
          <span style={{ border: '1px solid var(--p-border)', borderRadius: 4, padding: '0 4px', marginRight: 4 }}>E</span>
          Parler
        </div>
      )}
      {!hidden.has('abilities') && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ ...panel, width: 26, height: 26, padding: 0, textAlign: 'center', lineHeight: '26px' }}>
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
