/**
 * Cinematic editor: a timeline of tracks (camera, subtitles, actors, sound, effects, actions)
 * above which the scene viewport previews the camera at the playhead — computed with the same
 * function as the game. Keys are dragged in time; the camera key « vue actuelle » takes the
 * editor camera.
 */
import { useEffect, useRef, useState } from 'react';
import type { CinematicDoc, CinematicTrackDoc } from '@engine/core/content/schemas';
import { evaluateCameraTrack } from '@engine/core/story/cinematics';
import { EASING_NAMES } from '@engine/core/util/easing';
import { viewportRef } from '../hooks';
import { ActionsEditor } from '../fields/LogicEditors';
import { ColorInput, NumberInput, RefInput, TextField, Vec3Input } from '../fields/PropField';
import { removeAt, replaceAt, Row, useDoc, type DocHandle } from './common';

const PPS = 48;
type Track = CinematicTrackDoc;
type Sel = { track: number; item: number } | null;

const TRACK_LABEL: Record<Track['type'], string> = {
  camera: 'Caméra',
  subtitle: 'Sous-titres',
  actor: 'Acteur',
  audio: 'Sons et musique',
  fx: 'Effets d’écran',
  actions: 'Actions',
};

function itemsOf(track: Track): { t: number; duration?: number; label: string }[] {
  switch (track.type) {
    case 'camera':
      return track.keys.map((k) => ({ t: k.t, label: k.cut ? 'coupe' : '' }));
    case 'subtitle':
      return track.items.map((i) => ({ t: i.t, duration: i.duration, label: i.text }));
    case 'actor':
      return track.keys.map((k) => ({ t: k.t, label: k.animation ?? (k.moveTo ? 'déplacement' : '') }));
    case 'audio':
      return track.items.map((i) => ({ t: i.t, label: i.sound ?? (i.music === null ? 'silence' : (i.music ?? '')) }));
    case 'fx':
      return track.items.map((i) => ({ t: i.t, label: i.fx }));
    case 'actions':
      return track.items.map((i) => ({ t: i.t, label: `${i.actions.length} action(s)` }));
  }
}

function withItemTime(track: Track, index: number, t: number): Track {
  const set = <T extends { t: number }>(list: T[]) => replaceAt(list, index, { ...list[index]!, t });
  switch (track.type) {
    case 'camera':
      return { ...track, keys: set(track.keys).sort((a, b) => a.t - b.t) };
    case 'actor':
      return { ...track, keys: set(track.keys).sort((a, b) => a.t - b.t) };
    case 'subtitle':
      return { ...track, items: set(track.items) };
    case 'audio':
      return { ...track, items: set(track.items) };
    case 'fx':
      return { ...track, items: set(track.items) };
    case 'actions':
      return { ...track, items: set(track.items) };
  }
}

export function CinematicEditor({ path }: { path: string }) {
  const h = useDoc<CinematicDoc>(path);
  const [time, setTime] = useState(0);
  const [sel, setSel] = useState<Sel>(null);
  const [playing, setPlaying] = useState(false);
  // t0: time of the item when the button went down (a click without movement records nothing).
  const [drag, setDrag] = useState<{ track: number; item: number; t: number; t0: number } | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const data = h?.data;
  const editorStudio = h?.studio;

  // Preview the camera at the playhead in the scene viewport — only when the cinematic or the
  // playhead changes, so that the editor camera stays free during other edits.
  useEffect(() => {
    if (!data || !editorStudio) return;
    const pose = evaluateCameraTrack(data, time, (id) => {
      const e = editorStudio.entity(id);
      return e ? { x: e.position[0], y: e.position[1] + 1.5, z: e.position[2] } : null;
    });
    if (pose) viewportRef.current?.showPose(pose);
  }, [data, time, editorStudio]);
  // Leaving the cinematic gives the editor camera its own field of view back.
  useEffect(() => () => viewportRef.current?.showPose(null), []);

  useEffect(() => {
    if (!playing || !data) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const n = t + dt;
        if (n >= data.duration) {
          setPlaying(false);
          return data.duration;
        }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, data]);

  if (!h || !data) return null;
  const { edit, env, studio } = h;
  const setTrack = (i: number, t: Track, label: string, merge?: string) => edit(label, (d) => ({ ...d, tracks: replaceAt(d.tracks, i, t) }), merge ? `track${i}|${merge}` : undefined);
  const width = data.duration * PPS + 60;
  const subtitle = data.tracks
    .flatMap((t) => (t.type === 'subtitle' ? t.items : []))
    .filter((s) => time >= s.t && time < s.t + s.duration)
    .pop();
  const timeAt = (clientX: number) => {
    const r = laneRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(0, Math.min(data.duration, (clientX - r.left) / PPS));
  };

  const addCameraKey = () => {
    const pose = viewportRef.current?.cameraPose();
    if (!pose) return;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const key = { t: r2(time), position: pose.position.map(r2) as [number, number, number], target: pose.target.map(r2) as [number, number, number], ease: 'inOutSine' };
    const idx = data.tracks.findIndex((t) => t.type === 'camera');
    if (idx < 0) edit('Clé de caméra', (d) => ({ ...d, tracks: [{ type: 'camera', keys: [key] }, ...d.tracks] }));
    else {
      const track = data.tracks[idx] as Extract<Track, { type: 'camera' }>;
      setTrack(idx, { ...track, keys: [...track.keys.filter((k) => Math.abs(k.t - key.t) > 0.01), key].sort((a, b) => a.t - b.t) }, 'Clé de caméra');
    }
  };

  const addItem = (type: Track['type']) => {
    const t = Math.round(time * 100) / 100;
    studio.history.transaction(`Ajouter : ${TRACK_LABEL[type].toLowerCase()}`, () => {
      let idx = data.tracks.findIndex((x) => x.type === type && type !== 'actor');
      if (type === 'subtitle') {
        const text = studio.newTextKey(`cin.${data.id}.${Math.round(t * 10)}`, 'Nouveau sous-titre.');
        const item = { t, duration: 3, text };
        if (idx < 0) edit('Sous-titre', (d) => ({ ...d, tracks: [...d.tracks, { type: 'subtitle', items: [item] }] }));
        else setTrack(idx, { ...(data.tracks[idx] as Extract<Track, { type: 'subtitle' }>), items: [...(data.tracks[idx] as Extract<Track, { type: 'subtitle' }>).items, item] }, 'Sous-titre');
        return;
      }
      const fresh: Record<Track['type'], Track> = {
        camera: { type: 'camera', keys: [] },
        subtitle: { type: 'subtitle', items: [] },
        actor: { type: 'actor', entity: studio.selection[0] ?? '', keys: [{ t }] },
        audio: { type: 'audio', items: [{ t, sound: '' }] },
        fx: { type: 'fx', items: [{ t, fx: 'flash', color: '#ffffff', seconds: 0.5 }] },
        actions: { type: 'actions', items: [{ t, actions: [] }] },
      };
      if (idx < 0 || type === 'actor') {
        edit(`Piste : ${TRACK_LABEL[type]}`, (d) => ({ ...d, tracks: [...d.tracks, fresh[type]] }));
        idx = data.tracks.length;
        setSel({ track: idx, item: 0 });
        return;
      }
      const track = data.tracks[idx]!;
      const newItem = (fresh[type] as { items?: unknown[] }).items![0];
      setTrack(idx, { ...track, items: [...(track as { items: unknown[] }).items, newItem] } as Track, `Ajouter : ${TRACK_LABEL[type].toLowerCase()}`);
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', height: '100%' }} data-testid="st-cinematic-editor">
      <div className="st-editor" style={{ paddingTop: '0.5rem' }}>
        <div className="st-row" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
          <strong>{data.title ?? data.id}</strong>
          <span className="st-field__key">
            {time.toFixed(2)} s / {data.duration} s
          </span>
          <button type="button" className="st-btn st-btn--small" onClick={() => (time >= data.duration && setTime(0), setPlaying(!playing))}>
            {playing ? '❚❚ Pause' : '▶ Aperçu'}
          </button>
          <button type="button" className="st-btn st-btn--small" onClick={() => (setPlaying(false), setTime(0))}>
            ⏮
          </button>
          <button type="button" className="st-btn st-btn--small" onClick={addCameraKey} title="Ajoute une clé de caméra au temps courant, depuis la vue de l’éditeur">
            ＋ Clé caméra (vue actuelle)
          </button>
          <select className="st-select" style={{ width: 'auto' }} value="" onChange={(e) => e.target.value && addItem(e.target.value as Track['type'])}>
            <option value="">＋ Ajouter…</option>
            <option value="subtitle">Sous-titre</option>
            <option value="actor">Piste d’acteur (entité sélectionnée)</option>
            <option value="audio">Son ou musique</option>
            <option value="fx">Effet d’écran</option>
            <option value="actions">Actions</option>
          </select>
        </div>
        {subtitle && (
          <div style={{ padding: '0.3rem 0.6rem', marginBottom: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 6, fontStyle: 'italic' }}>
            {subtitle.speaker && <strong style={{ color: 'var(--st-accent)' }}>{studio.t(subtitle.speaker)} : </strong>}
            {studio.t(subtitle.text)}
          </div>
        )}
        <div className="st-timeline" style={{ ['--px-per-s' as string]: `${PPS}px` }}>
          <div className="st-timeline__label" style={{ height: 22, fontSize: '0.72rem', color: 'var(--st-faint)' }}>
            Temps (s)
          </div>
          <div style={{ overflowX: 'auto', gridRow: `1 / span ${data.tracks.length + 1}`, gridColumn: 2 }}>
            <div style={{ position: 'relative', width }} ref={laneRef}>
              <div
                style={{ height: 22, position: 'relative', borderBottom: '1px solid var(--st-border)', cursor: 'pointer' }}
                onPointerDown={(e) => {
                  setPlaying(false);
                  setTime(timeAt(e.clientX));
                }}
              >
                {Array.from({ length: Math.floor(data.duration) + 1 }, (_, s) => (
                  <span key={s} style={{ position: 'absolute', left: s * PPS + 2, fontSize: '0.7rem', color: 'var(--st-faint)' }}>
                    {s}
                  </span>
                ))}
              </div>
              {data.tracks.map((track, ti) => (
                <div
                  key={ti}
                  className="st-timeline__lane"
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) {
                      setPlaying(false);
                      setTime(timeAt(e.clientX));
                    }
                  }}
                  onPointerMove={(e) => drag && drag.track === ti && setDrag({ ...drag, t: Math.round(timeAt(e.clientX) * 10) / 10 })}
                  onPointerUp={() => {
                    if (!drag) return;
                    if (drag.t !== drag.t0) setTrack(drag.track, withItemTime(data.tracks[drag.track]!, drag.item, drag.t), 'Déplacer une clé');
                    setDrag(null);
                  }}
                >
                  {itemsOf(track).map((it, ii) => {
                    const t = drag && drag.track === ti && drag.item === ii ? drag.t : it.t;
                    const selected = sel?.track === ti && sel.item === ii;
                    return it.duration !== undefined ? (
                      <div
                        key={ii}
                        className={`st-span ${selected ? 'is-selected' : ''}`}
                        style={{ left: t * PPS, width: Math.max(8, it.duration * PPS) }}
                        title={studio.t(it.label)}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                          setSel({ track: ti, item: ii });
                          setDrag({ track: ti, item: ii, t: it.t, t0: it.t });
                        }}
                      >
                        {studio.t(it.label)}
                      </div>
                    ) : (
                      <div
                        key={ii}
                        className={`st-key ${selected ? 'is-selected' : ''}`}
                        style={{ left: t * PPS }}
                        title={`${t.toFixed(2)} s ${it.label}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                          setSel({ track: ti, item: ii });
                          setDrag({ track: ti, item: ii, t: it.t, t0: it.t });
                          setTime(it.t);
                        }}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="st-playhead" style={{ left: time * PPS }} />
            </div>
          </div>
          {data.tracks.map((track, ti) => (
            <div key={ti} className="st-timeline__label" style={{ gridColumn: 1 }} title={track.type === 'actor' ? track.entity : undefined}>
              {TRACK_LABEL[track.type]}
              {track.type === 'actor' ? ` : ${track.entity || '?'}` : ''}
              <button type="button" className="st-btn st-btn--small st-btn--ghost st-btn--danger" style={{ float: 'right' }} title="Supprimer la piste" onClick={() => edit('Supprimer une piste', (d) => ({ ...d, tracks: removeAt(d.tracks, ti) }))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <h3>À la fin (même si le joueur passe la cinématique)</h3>
        <ActionsEditor value={data.onComplete ?? []} env={{ ...env, keyHint: `cin.${data.id}.fin` }} onChange={(a, m) => edit('Actions de fin', (d) => ({ ...d, onComplete: a }), m ? `end|${m}` : undefined)} />
      </div>
      <div style={{ borderLeft: '1px solid var(--st-border)', overflow: 'auto', background: 'var(--st-panel)' }} className="st-panel__body--pad">
        {sel && data.tracks[sel.track] ? (
          <ItemInspector h={h} track={data.tracks[sel.track]!} trackIndex={sel.track} item={sel.item} onRemoved={() => setSel(null)} setTrack={setTrack} />
        ) : (
          <CinematicSettings h={h} />
        )}
      </div>
    </div>
  );
}

function CinematicSettings({ h }: { h: DocHandle<CinematicDoc> }) {
  const { data, edit } = h;
  const set = <K extends keyof CinematicDoc>(k: K, v: CinematicDoc[K], label: string, merge?: string) => edit(label, (d) => ({ ...d, [k]: v }), merge ? `${String(k)}|${merge}` : undefined);
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Cinématique</h3>
      <Row label="Titre (éditeur)">
        <input className="st-input" value={data.title ?? ''} onChange={(e) => set('title', e.target.value, 'Titre', 'type')} />
      </Row>
      <Row label="Durée (s)">
        <NumberInput value={data.duration} min={0.5} max={300} step={0.5} onChange={(n, m) => set('duration', n, 'Durée', m)} />
      </Row>
      {(
        [
          ['skippable', 'Le joueur peut la passer'],
          ['letterbox', 'Bandes noires'],
          ['lockPlayer', 'Joueur immobilisé'],
          ['hideHud', 'Interface masquée'],
        ] as const
      ).map(([k, l]) => (
        <Row key={k} label="">
          <label className="st-check">
            <input type="checkbox" checked={!!data[k]} onChange={(e) => set(k, e.target.checked as never, l)} />
            {l}
          </label>
        </Row>
      ))}
      <Row label="Retour caméra">
        <select className="st-select" value={data.returnCamera} onChange={(e) => set('returnCamera', e.target.value as CinematicDoc['returnCamera'], 'Retour caméra')}>
          <option value="blend">Fondu vers le joueur</option>
          <option value="cut">Coupe franche</option>
        </select>
      </Row>
      <p className="st-field__help">Cliquez une clé de la frise pour la modifier. Les actions marquées « essentielles » et les actions de fin s’exécutent même si le joueur passe la cinématique.</p>
    </div>
  );
}

function ItemInspector({
  h,
  track,
  trackIndex,
  item,
  onRemoved,
  setTrack,
}: {
  h: DocHandle<CinematicDoc>;
  track: Track;
  trackIndex: number;
  item: number;
  onRemoved: () => void;
  setTrack: (i: number, t: Track, label: string, merge?: string) => void;
}) {
  const { env, studio } = h;
  const remove = () => {
    if (track.type === 'camera' || track.type === 'actor') setTrack(trackIndex, { ...track, keys: removeAt(track.keys as never[], item) } as Track, 'Supprimer une clé');
    else setTrack(trackIndex, { ...track, items: removeAt((track as unknown as { items: unknown[] }).items, item) } as unknown as Track, 'Supprimer un élément');
    onRemoved();
  };
  const header = (
    <div className="st-row" style={{ marginBottom: 6 }}>
      <strong>{TRACK_LABEL[track.type]}</strong>
      <span style={{ flex: 1 }} />
      <button type="button" className="st-btn st-btn--small st-btn--danger" onClick={remove}>
        Supprimer
      </button>
    </div>
  );
  const time = (t: number, onT: (t: number, m?: string) => void) => (
    <Row label="Temps (s)">
      <NumberInput value={t} min={0} step={0.1} onChange={onT} />
    </Row>
  );
  switch (track.type) {
    case 'camera': {
      const k = track.keys[item];
      if (!k) return null;
      const set = (nk: typeof k, label: string, m?: string) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, nk) }, label, m ? `k${item}|${m}` : undefined);
      return (
        <div>
          {header}
          {time(k.t, (t, m) => set({ ...k, t }, 'Temps de la clé', m))}
          <Row label="Position">
            <Vec3Input value={k.position} step={0.25} onChange={(v, m) => set({ ...k, position: v }, 'Position caméra', m)} />
          </Row>
          <Row label="Regarde">
            <Vec3Input value={k.target ?? k.position} step={0.25} onChange={(v, m) => set({ ...k, target: v }, 'Cible caméra', m)} />
          </Row>
          <Row label="Ou suit l’entité">
            <RefInput kind="entity" value={k.lookAt ?? ''} env={env} onChange={(v, m) => set({ ...k, lookAt: v || undefined }, 'Suivi', m)} />
          </Row>
          <Row label="Champ (°)">
            <NumberInput value={k.fov ?? 70} min={10} max={120} step={1} slider onChange={(n, m) => set({ ...k, fov: n }, 'Champ', m)} />
          </Row>
          <Row label="Courbe">
            <select className="st-select" value={k.ease ?? 'inOutSine'} onChange={(e) => set({ ...k, ease: e.target.value }, 'Courbe')}>
              {EASING_NAMES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Row>
          <Row label="">
            <label className="st-check">
              <input type="checkbox" checked={!!k.cut} onChange={(e) => set({ ...k, cut: e.target.checked || undefined }, 'Coupe')} />
              Coupe franche (pas d’interpolation)
            </label>
          </Row>
          <button
            type="button"
            className="st-btn st-btn--small"
            onClick={() => {
              const pose = viewportRef.current?.cameraPose();
              if (pose) set({ ...k, position: pose.position.map((n) => Math.round(n * 100) / 100) as never, target: pose.target.map((n) => Math.round(n * 100) / 100) as never }, 'Clé depuis la vue');
            }}
          >
            Prendre la vue actuelle
          </button>
        </div>
      );
    }
    case 'subtitle': {
      const s = track.items[item];
      if (!s) return null;
      const set = (ns: typeof s, label: string, m?: string) => setTrack(trackIndex, { ...track, items: replaceAt(track.items, item, ns) }, label, m ? `s${item}|${m}` : undefined);
      return (
        <div>
          {header}
          {time(s.t, (t, m) => set({ ...s, t }, 'Temps du sous-titre', m))}
          <Row label="Durée (s)">
            <NumberInput value={s.duration} min={0.3} step={0.1} onChange={(n, m) => set({ ...s, duration: n }, 'Durée du sous-titre', m)} />
          </Row>
          <Row label="Locuteur" help="Clé du nom (ex. memory.npc.oriane) ou entité ; vide : narration">
            <input className="st-input st-input--mono" value={s.speaker ?? ''} onChange={(e) => set({ ...s, speaker: e.target.value || undefined }, 'Locuteur', 'speaker')} />
            {s.speaker && <div className="st-field__key">{studio.t(s.speaker)}</div>}
          </Row>
          <Row label="Texte">
            <TextField value={s.text} multiline env={{ ...env, keyHint: `cin.${h.data.id}` }} onChange={(k, m) => set({ ...s, text: k }, 'Texte du sous-titre', m)} />
          </Row>
        </div>
      );
    }
    case 'actor': {
      const k = track.keys[item];
      return (
        <div>
          {header}
          <Row label="Entité">
            <RefInput kind="entity" value={track.entity} env={env} onChange={(v, m) => setTrack(trackIndex, { ...track, entity: v }, 'Entité de la piste', m)} />
          </Row>
          {k && (
            <>
              {time(k.t, (t, m) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, { ...k, t }) }, 'Temps', m))}
              <Row label="Animation">
                <input className="st-input" value={k.animation ?? ''} placeholder="talk, wave, nod, point…" onChange={(e) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, { ...k, animation: e.target.value || undefined }) }, 'Animation', 'anim')} />
              </Row>
              <Row label="Expression">
                <input className="st-input" value={k.expression ?? ''} placeholder="happy, sad, worried…" onChange={(e) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, { ...k, expression: e.target.value || undefined }) }, 'Expression', 'expr')} />
              </Row>
              <Row label="Regarde">
                <input className="st-input st-input--mono" value={typeof k.lookAt === 'string' ? k.lookAt : ''} placeholder="player ou entité" onChange={(e) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, { ...k, lookAt: e.target.value || undefined }) }, 'Regard', 'look')} />
              </Row>
              <Row label="Va vers">
                <input className="st-input st-input--mono" value={typeof k.moveTo === 'string' ? k.moveTo : ''} placeholder="repère" onChange={(e) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, { ...k, moveTo: e.target.value || undefined }) }, 'Déplacement', 'move')} />
              </Row>
              <Row label="Dit (bulle)">
                <TextField value={k.say ?? ''} env={{ ...env, keyHint: `cin.${h.data.id}.${track.entity}` }} onChange={(v, m) => setTrack(trackIndex, { ...track, keys: replaceAt(track.keys, item, { ...k, say: v || undefined }) }, 'Réplique', m)} />
              </Row>
            </>
          )}
          <button type="button" className="st-btn st-btn--small" onClick={() => setTrack(trackIndex, { ...track, keys: [...track.keys, { t: Math.round(((track.keys.at(-1)?.t ?? 0) + 1) * 10) / 10 }] }, 'Nouvelle clé d’acteur')}>
            ＋ Clé d’acteur
          </button>
        </div>
      );
    }
    case 'audio': {
      const a = track.items[item];
      if (!a) return null;
      const set = (na: typeof a, label: string, m?: string) => setTrack(trackIndex, { ...track, items: replaceAt(track.items, item, na) }, label, m ? `a${item}|${m}` : undefined);
      return (
        <div>
          {header}
          {time(a.t, (t, m) => set({ ...a, t }, 'Temps', m))}
          <Row label="Son">
            <RefInput kind="sound" value={a.sound ?? ''} env={env} onChange={(v, m) => set({ ...a, sound: v || undefined }, 'Son', m)} />
          </Row>
          <Row label="Musique">
            <RefInput kind="music" value={a.music ?? ''} env={env} onChange={(v, m) => set({ ...a, music: v || undefined }, 'Musique', m)} />
          </Row>
          <Row label="Source (entité)">
            <RefInput kind="entity" value={typeof a.at === 'string' ? a.at : ''} env={env} onChange={(v, m) => set({ ...a, at: v || undefined }, 'Source', m)} />
          </Row>
        </div>
      );
    }
    case 'fx': {
      const f = track.items[item];
      if (!f) return null;
      const set = (nf: typeof f, label: string, m?: string) => setTrack(trackIndex, { ...track, items: replaceAt(track.items, item, nf) }, label, m ? `f${item}|${m}` : undefined);
      return (
        <div>
          {header}
          {time(f.t, (t, m) => set({ ...f, t }, 'Temps', m))}
          <Row label="Effet">
            <select className="st-select" value={f.fx} onChange={(e) => set({ ...f, fx: e.target.value }, 'Effet')}>
              <option value="fade">Fondu</option>
              <option value="flash">Éclair</option>
              <option value="shake">Secousse</option>
              <option value="tint">Teinte</option>
            </select>
          </Row>
          {(f.fx === 'flash' || f.fx === 'fade' || f.fx === 'tint') && (
            <Row label="Couleur">
              <ColorInput value={String(f.color ?? (f.fx === 'fade' ? '#000000' : '#ffffff'))} onChange={(v, m) => set({ ...f, color: v }, 'Couleur', m)} />
            </Row>
          )}
          {f.fx === 'fade' && (
            <Row label="Opacité de / vers">
              <div className="st-row">
                <NumberInput value={Number(f.from ?? 0)} min={0} max={1} step={0.1} onChange={(n, m) => set({ ...f, from: n }, 'Fondu', m)} />
                <NumberInput value={Number(f.to ?? 1)} min={0} max={1} step={0.1} onChange={(n, m) => set({ ...f, to: n }, 'Fondu', m)} />
              </div>
            </Row>
          )}
          <Row label="Durée (s)">
            <NumberInput value={Number(f.seconds ?? 0.5)} min={0} step={0.1} onChange={(n, m) => set({ ...f, seconds: n }, 'Durée de l’effet', m)} />
          </Row>
          {f.fx === 'shake' && (
            <Row label="Intensité">
              <NumberInput value={Number(f.intensity ?? 0.3)} min={0} max={2} step={0.05} onChange={(n, m) => set({ ...f, intensity: n }, 'Intensité', m)} />
            </Row>
          )}
        </div>
      );
    }
    case 'actions': {
      const a = track.items[item];
      if (!a) return null;
      const set = (na: typeof a, label: string, m?: string) => setTrack(trackIndex, { ...track, items: replaceAt(track.items, item, na) }, label, m ? `x${item}|${m}` : undefined);
      return (
        <div>
          {header}
          {time(a.t, (t, m) => set({ ...a, t }, 'Temps', m))}
          <Row label="">
            <label className="st-check">
              {/* Items are essential unless marked `essential: false` (see core/story/cinematics.ts). */}
              <input type="checkbox" checked={a.essential !== false} onChange={(e) => set({ ...a, essential: e.target.checked ? undefined : false }, 'Action essentielle')} />
              Essentielle (s’exécute même si la cinématique est passée)
            </label>
          </Row>
          <ActionsEditor value={a.actions} env={{ ...env, keyHint: `cin.${h.data.id}` }} onChange={(list, m) => set({ ...a, actions: list as never }, 'Actions', m)} />
        </div>
      );
    }
  }
}
