import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { PrefabDoc, EntityDoc } from '@engine/core/content/schemas';
import { VoxelVolume } from '@engine/core/voxel/volume';
import { volumeFromDoc, volumeToDoc } from '@engine/core/world/sceneVoxels';
import { useStudio, viewportRef } from '../hooks';
import { EditorViewport } from './editorViewport';
import { ENTITY_TEMPLATES } from '../core/templates';
import { blockSwatch } from '../ui/catalog';
import { addEntities, clone, uniqueEntityId, type VoxelChange } from '../core/edits';
import type { Studio, ToolId } from '../core/studio';
import { Modal } from '../ui/Modal';

const TOOLS: { id: ToolId; label: string; key: string; title: string }[] = [
  { id: 'select', label: '⬚ Sélection', key: '1', title: 'Sélectionner et transformer les entités (1)' },
  { id: 'place', label: '▣ Poser', key: '2', title: 'Poser des blocs, glisser pour peindre (2)' },
  { id: 'erase', label: '⌫ Effacer', key: '3', title: 'Effacer des blocs (3)' },
  { id: 'paint', label: '🖌 Peindre', key: '4', title: 'Remplacer la matière des blocs (4)' },
  { id: 'box', label: '▤ Boîte', key: '5', title: 'Deux clics : remplir une boîte · Maj : la vider (5)' },
  { id: 'pick', label: '⌖ Pipette', key: '6', title: 'Prendre le bloc visé (6)' },
];

export function ViewportPanel({ active }: { active: boolean }) {
  const studio = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [popup, setPopup] = useState<'blocks' | 'add' | 'prefabs' | null>(null);
  const [prefabModal, setPrefabModal] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vp = new EditorViewport(canvas, studio);
    vp.onUiChange = bump;
    viewportRef.current = vp;
    vp.start();
    const ro = new ResizeObserver(() => vp.resize());
    if (hostRef.current) ro.observe(hostRef.current);
    const timer = setInterval(bump, 500);
    return () => {
      clearInterval(timer);
      ro.disconnect();
      vp.dispose();
      viewportRef.current = null;
    };
  }, [studio]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    if (active) {
      vp.start();
      vp.resize();
    } else vp.stop();
  }, [active]);

  const vp = viewportRef.current;
  const block = studio.session.blocks.get(studio.block);
  const corner = vp?.pendingBoxCorner;
  const hover = vp?.hover;
  const hint =
    studio.tool === 'select'
      ? 'Clic : sélectionner · Ctrl : ajouter/retirer · Clic droit maintenu + ZQSD/WASD : se déplacer (A/E : descendre/monter, Maj : vite) · Molette : avancer · F : cadrer'
      : studio.tool === 'box'
        ? corner
          ? `Premier coin : ${corner.join(', ')} — cliquez le coin opposé (Maj : vider) · Échap : annuler`
          : 'Cliquez un premier coin de la boîte'
        : 'Clic gauche (glisser pour peindre) · Clic droit maintenu : regarder';
  return (
    <div className="st-viewport" ref={hostRef} style={{ visibility: active ? 'visible' : 'hidden' }} data-testid="st-viewport">
      <canvas ref={canvasRef} tabIndex={0} data-testid="st-canvas" />
      {!studio.scenePath && <div className="st-busy" style={{ position: 'absolute' }}>Ouvrez une scène dans l’explorateur.</div>}
      <div className="st-vtools">
        <div className="st-vgroup" role="toolbar" aria-label="Outils">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`st-btn ${studio.tool === t.id ? 'is-active' : ''}`}
              title={t.title}
              onClick={() => {
                studio.tool = t.id;
                studio.changed();
              }}
              data-testid={`st-tool-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {studio.tool === 'select' ? (
          <div className="st-vgroup" role="toolbar" aria-label="Transformation">
            {(
              [
                ['move', '✥ Déplacer', 'W'],
                ['rotate', '⟳ Tourner', 'E'],
                ['scale', '⤢ Échelle', 'R'],
              ] as const
            ).map(([m, l, k]) => (
              <button
                key={m}
                type="button"
                className={`st-btn ${studio.gizmo === m ? 'is-active' : ''}`}
                title={`${l.slice(2)} (${k})`}
                onClick={() => {
                  studio.gizmo = m;
                  studio.changed();
                }}
              >
                {l}
              </button>
            ))}
          </div>
        ) : (
          <div className="st-vgroup" style={{ position: 'relative' }}>
            <button type="button" className="st-btn" onClick={() => setPopup(popup === 'blocks' ? null : 'blocks')} title="Choisir le bloc" data-testid="st-block-picker">
              <img className="st-swatch" src={blockSwatch(block)} alt="" />
              {block?.label ?? studio.block}
            </button>
            {popup === 'blocks' && <BlockPalette studio={studio} onClose={() => setPopup(null)} />}
          </div>
        )}
        <div className="st-vgroup" role="toolbar" aria-label="Aimantation">
          <button
            type="button"
            className={`st-btn ${studio.snap.enabled ? 'is-active' : ''}`}
            title="Aimanter les déplacements et rotations"
            onClick={() => {
              studio.snap.enabled = !studio.snap.enabled;
              studio.changed();
            }}
          >
            🧲 {studio.snap.move} m · {studio.snap.rotate}°
          </button>
          <select
            className="st-select"
            style={{ width: 'auto', background: 'transparent', border: 'none' }}
            value={studio.snap.move}
            title="Pas de déplacement"
            onChange={(e) => {
              studio.snap.move = Number(e.target.value);
              studio.changed();
            }}
          >
            {[0.125, 0.25, 0.5, 1, 2].map((v) => (
              <option key={v} value={v}>
                {v} m
              </option>
            ))}
          </select>
          <select
            className="st-select"
            style={{ width: 'auto', background: 'transparent', border: 'none' }}
            value={studio.snap.rotate}
            title="Pas de rotation"
            onChange={(e) => {
              studio.snap.rotate = Number(e.target.value);
              studio.changed();
            }}
          >
            {[5, 15, 45, 90].map((v) => (
              <option key={v} value={v}>
                {v}°
              </option>
            ))}
          </select>
        </div>
        <div className="st-vgroup" style={{ position: 'relative' }}>
          <button type="button" className="st-btn" onClick={() => setPopup(popup === 'add' ? null : 'add')} disabled={!studio.scenePath} data-testid="st-add-entity">
            ＋ Ajouter
          </button>
          {popup === 'add' && <AddMenu studio={studio} onClose={() => setPopup(null)} />}
          <button type="button" className="st-btn" onClick={() => setPopup(popup === 'prefabs' ? null : 'prefabs')} disabled={!studio.scenePath} title="Préfabriqués">
            ❖ Préfabriqués
          </button>
          {popup === 'prefabs' && <PrefabMenu studio={studio} onClose={() => setPopup(null)} onCreate={() => setPrefabModal(true)} />}
        </div>
      </div>
      <div className="st-vhint">
        {hint}
        {hover?.voxel && studio.tool !== 'select' && (
          <span>
            {' '}
            · {hover.voxel.x}, {hover.voxel.y}, {hover.voxel.z} ({studio.session.blocks.get(hover.voxel.blockId)?.label ?? hover.voxel.blockId})
          </span>
        )}
      </div>
      {prefabModal && <PrefabModal studio={studio} onClose={() => setPrefabModal(false)} />}
    </div>
  );
}

function BlockPalette({ studio, onClose }: { studio: Studio; onClose: () => void }) {
  const [filter, setFilter] = useState('');
  const blocks = useMemo(() => studio.session.blocks.all().filter((b) => b.id !== 'core:missing'), [studio.session.blocks.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = filter.trim().toLowerCase();
  const groups = new Map<string, typeof blocks>();
  for (const b of blocks) {
    if (f && !b.label.toLowerCase().includes(f) && !b.id.includes(f)) continue;
    groups.set(b.category, [...(groups.get(b.category) ?? []), b]);
  }
  return (
    <div className="st-pop" style={{ top: '110%', left: 0, width: 360 }} onMouseLeave={onClose}>
      <input className="st-input" autoFocus placeholder="Chercher un bloc…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat}>
          <div className="st-menu-cat">{cat}</div>
          <div className="st-palette">
            {list.map((b) => (
              <button
                key={b.id}
                type="button"
                title={`${b.label} (${b.id})`}
                className={studio.block === b.id ? 'is-active' : ''}
                onClick={() => {
                  studio.block = b.id;
                  studio.changed();
                  onClose();
                }}
              >
                <img src={blockSwatch(b)} alt={b.label} style={{ width: '100%', height: '100%', imageRendering: 'pixelated', borderRadius: 4 }} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddMenu({ studio, onClose }: { studio: Studio; onClose: () => void }) {
  const cats = [...new Set(ENTITY_TEMPLATES.map((t) => t.category))];
  return (
    <div className="st-pop" style={{ top: '110%', left: 0 }} onMouseLeave={onClose}>
      {cats.map((c) => (
        <div key={c}>
          <div className="st-menu-cat">{c}</div>
          {ENTITY_TEMPLATES.filter((t) => t.category === c).map((t) => (
            <button
              key={t.id}
              type="button"
              className="st-menu-item"
              onClick={() => {
                const at = viewportRef.current?.placementPoint() ?? [0, 0, 0];
                studio.addFromTemplate(t, at);
                onClose();
              }}
              data-testid={`st-add-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Prefabs: a piece of scene (blocks + entities) saved for reuse
// ------------------------------------------------------------------------------------------------

function PrefabMenu({ studio, onClose, onCreate }: { studio: Studio; onClose: () => void; onCreate: () => void }) {
  const pack = studio.packId ?? '';
  const prefabs = studio.project.docsOf(pack, 'prefab');
  return (
    <div className="st-pop" style={{ top: '110%', right: 0 }} onMouseLeave={onClose}>
      <button type="button" className="st-menu-item" onClick={() => (onCreate(), onClose())} disabled={!studio.writable}>
        ＋ Créer à partir d’une zone de la scène…
      </button>
      <div className="st-menu-cat">Placer devant la caméra</div>
      {prefabs.length === 0 && <div className="st-empty">Aucun préfabriqué dans ce pack.</div>}
      {prefabs.map((d) => (
        <button
          key={d.path}
          type="button"
          className="st-menu-item"
          onClick={async () => {
            if (!d.loaded) await studio.project.load(d.path);
            placePrefab(studio, d.data as PrefabDoc);
            onClose();
          }}
        >
          {(d.data as PrefabDoc | null)?.label ?? d.id}
        </button>
      ))}
    </div>
  );
}

/** Pastes a prefab at the point in front of the camera (blocks and entities, one undo step). */
export function placePrefab(studio: Studio, prefab: PrefabDoc): void {
  const scene = studio.sceneDoc();
  const world = studio.world;
  if (!scene || !world) return;
  const at = viewportRef.current?.placementPoint() ?? [0, 0, 0];
  const origin: [number, number, number] = [Math.floor(at[0]), Math.floor(at[1]), Math.floor(at[2])];
  studio.history.transaction(`Placer « ${prefab.label} »`, () => {
    if (prefab.voxels) {
      const src = volumeFromDoc(prefab.voxels);
      const changes: VoxelChange[] = [];
      const v = world.volume;
      for (let y = 0; y < src.sizeY; y++)
        for (let z = 0; z < src.sizeZ; z++)
          for (let x = 0; x < src.sizeX; x++) {
            const id = src.get(x, y, z);
            if (id === null) continue;
            const [wx, wy, wz] = [origin[0] + x, origin[1] + y, origin[2] + z];
            if (wx < 0 || wy < 0 || wz < 0 || wx >= v.sizeX || wy >= v.sizeY || wz >= v.sizeZ) continue;
            changes.push([wx, wy, wz, v.get(wx, wy, wz), id]);
          }
      studio.editVoxels(`Placer « ${prefab.label} »`, changes);
    }
    const taken = new Set<string>();
    const ents: EntityDoc[] = prefab.entities.map((e) => {
      const copy = clone(e);
      copy.id = uniqueEntityId(scene, e.id, taken);
      taken.add(copy.id);
      copy.position = [e.position[0] + origin[0], e.position[1] + origin[1], e.position[2] + origin[2]];
      return copy;
    });
    if (ents.length) studio.editScene(`Placer « ${prefab.label} »`, (s) => addEntities(s, ents));
    studio.select(ents.map((e) => e.id));
  });
}

function PrefabModal({ studio, onClose }: { studio: Studio; onClose: () => void }) {
  const world = studio.world;
  const scene = studio.sceneDoc();
  const sel = studio.selection.map((id) => scene?.entities.find((e) => e.id === id)).filter((e): e is EntityDoc => !!e);
  const center = sel.length ? sel[0]!.position : (viewportRef.current?.placementPoint() ?? [0, 0, 0]);
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [min, setMin] = useState<[number, number, number]>([Math.floor(center[0]) - 2, Math.floor(center[1]), Math.floor(center[2]) - 2]);
  const [max, setMax] = useState<[number, number, number]>([Math.floor(center[0]) + 2, Math.floor(center[1]) + 3, Math.floor(center[2]) + 2]);
  const [error, setError] = useState<string | null>(null);
  if (!world || !scene) return null;
  const create = () => {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return setError('Identifiant : lettres, chiffres, _ et - uniquement.');
    const size: [number, number, number] = [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1];
    if (size.some((n) => n < 1 || n > 64)) return setError('Chaque dimension doit être comprise entre 1 et 64 blocs.');
    const vol = new VoxelVolume(size[0], size[1], size[2]);
    for (let y = 0; y < size[1]; y++) for (let z = 0; z < size[2]; z++) for (let x = 0; x < size[0]; x++) vol.set(x, y, z, world.volume.get(min[0] + x, min[1] + y, min[2] + z));
    const inside = scene.entities.filter((e) => e.position.every((p, i) => p >= min[i]! && p < max[i]! + 1));
    const doc: PrefabDoc = {
      format: 'civverse.prefab',
      version: 1,
      id,
      label: label.trim() || id,
      category: 'Créés dans le Studio',
      voxels: volumeToDoc(vol),
      entities: inside.map((e) => ({ ...clone(e), position: [e.position[0] - min[0], e.position[1] - min[1], e.position[2] - min[2]] })),
    };
    try {
      studio.project.create(studio.packId!, `content/prefabs/${id}.prefab.json`, doc);
      studio.print('success', `Préfabriqué « ${doc.label} » créé (${size.join(' × ')} blocs, ${doc.entities.length} entités). Enregistrez pour l’écrire sur le disque.`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const vec = (v: [number, number, number], set: (v: [number, number, number]) => void) => (
    <div className="st-vec">
      {[0, 1, 2].map((i) => (
        <input
          key={i}
          className="st-input"
          type="number"
          value={v[i]}
          onChange={(e) => {
            const n = [...v] as [number, number, number];
            n[i] = Math.round(Number(e.target.value) || 0);
            set(n);
          }}
        />
      ))}
    </div>
  );
  return (
    <Modal title="Nouveau préfabriqué" onClose={onClose} actions={<button type="button" className="st-btn st-btn--primary" onClick={create}>Créer</button>}>
      <div className="st-field">
        <div className="st-field__label">Identifiant</div>
        <input className="st-input st-input--mono" value={id} onChange={(e) => setId(e.target.value)} autoFocus />
      </div>
      <div className="st-field">
        <div className="st-field__label">Nom</div>
        <input className="st-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Échoppe de marché" />
      </div>
      <div className="st-field">
        <div className="st-field__label">Coin minimal</div>
        {vec(min, setMin)}
      </div>
      <div className="st-field">
        <div className="st-field__label">Coin maximal</div>
        {vec(max, setMax)}
      </div>
      <p className="st-field__help">Les blocs de la zone et les entités qu’elle contient sont copiés ; le préfabriqué se place ensuite devant la caméra.</p>
      {error && <div className="st-line--error">{error}</div>}
    </Modal>
  );
}
