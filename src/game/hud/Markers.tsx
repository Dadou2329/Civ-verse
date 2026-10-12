import { useEffect, useReducer } from 'react';
import type { QuestView } from '@engine/core/story/quests';
import { useController, useQuestViews, useT } from '../hooks';

/** The quest shown by the objective tracker: the tracked one, else the first active one. */
export function displayedQuest(quests: QuestView[]): QuestView | undefined {
  return quests.find((x) => x.tracked && x.status === 'active') ?? quests.find((x) => x.status === 'active');
}

const EDGE = 34;

/** Moves a screen point along the line from the centre until it sits inside the margins. */
function pinToEdge(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy || 1e-6;
  const s = Math.min((cx - EDGE) / Math.max(Math.abs(dx), 1e-6), (cy - EDGE) / Math.abs(dy));
  return { x: cx + dx * s, y: cy + dy * s };
}

/**
 * Markers on the targets of the displayed quest's open objectives (objective `target`, in the
 * current scene), with the distance. A target out of view is pinned to the screen edge on its
 * side. Setting « Afficher les repères d’objectif »; hidden while the player is talking or aims
 * at the target (the interaction prompt takes over).
 */
export function ObjectiveMarkers() {
  const controller = useController();
  const quests = useQuestViews();
  const t = useT();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const session = controller.session;
  const world = session.world;
  const quest = displayedQuest(quests);
  const targets =
    controller.settings.showMarkers && world && quest
      ? quest.objectives.filter((o) => !o.done && o.target && (!o.targetScene || o.targetScene === world.id))
      : [];
  const active = targets.length > 0;
  // Positions follow the camera: re-render every frame while there is something to mark.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      bump();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const view = controller.view;
  const markers: { id: string; x: number; y: number; edge: boolean; optional: boolean; distance: number }[] = [];
  if (view && world && !session.dialogue.isActive) {
    const { width: w, height: h } = view.screenSize;
    const eye = session.player.eye;
    const f = session.player.forward;
    for (const o of targets) {
      const e = world.entities.get(o.target!);
      if (!e || !e.visible || !e.enabled || session.interaction.target?.entityId === e.id) continue;
      const p = world.markerPoint(e);
      const distance = Math.hypot(p.x - eye.x, p.z - eye.z);
      const ahead = (p.x - eye.x) * f.x + (p.y - eye.y) * f.y + (p.z - eye.z) * f.z;
      let s: { x: number; y: number } | null;
      let edge = false;
      if (ahead > 0.05 && (s = view.project(p)) && s.x >= EDGE && s.x <= w - EDGE && s.y >= EDGE && s.y <= h - EDGE) {
        markers.push({ id: o.id, x: s.x, y: s.y, edge, optional: o.optional, distance });
        continue;
      }
      // Out of view: mirror a point behind the camera in front of it (same side), then pin it.
      edge = true;
      const back = ahead > 0.05 ? p : { x: p.x - 2 * (ahead - 0.1) * f.x, y: p.y - 2 * (ahead - 0.1) * f.y, z: p.z - 2 * (ahead - 0.1) * f.z };
      s = view.project(back);
      if (!s) continue;
      markers.push({ id: o.id, ...pinToEdge(s.x, s.y, w, h), edge, optional: o.optional, distance });
    }
  }
  // Markers pinned to the same place (several targets out of view on one side) are stacked.
  for (let i = 1; i < markers.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = markers[i]!;
      const b = markers[j]!;
      if (Math.abs(a.x - b.x) < 44 && Math.abs(a.y - b.y) < 32) a.y = b.y + 32;
    }
  }
  return (
    <div className="cv-markers" aria-hidden="true">
      {markers.map((m) => (
        <div
          key={m.id}
          className={`cv-marker ${m.edge ? 'is-edge' : ''} ${m.optional ? 'is-optional' : ''}`}
          style={{ left: m.x, top: m.y }}
          data-testid="objective-marker"
        >
          <span className="cv-marker__gem" />
          <span className="cv-marker__distance">{t('ui.marker.distance', { n: Math.round(m.distance) })}</span>
        </div>
      ))}
    </div>
  );
}
