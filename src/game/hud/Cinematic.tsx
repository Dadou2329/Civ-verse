import { useEffect, useReducer } from 'react';
import { useController, useSession, useT } from '../hooks';
import { KeyCap } from '../ui/common';
import { useUi } from '../state/uiStore';

function useCinematicState() {
  const session = useSession();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => session.cinematics.onChange(bump), [session]);
  return { doc: session.cinematics.current, subtitle: session.cinematics.subtitleView() };
}

export function CinematicOverlay() {
  const { doc, subtitle } = useCinematicState();
  const t = useT();
  const { settings } = useController();
  const size = settings.subtitles;
  return (
    <>
      <div className={`cv-letterbox ${doc?.letterbox ? 'is-on' : ''}`} aria-hidden="true">
        <div className="cv-letterbox__bar cv-letterbox__bar--top" />
        <div className="cv-letterbox__bar cv-letterbox__bar--bottom" />
      </div>
      {doc && subtitle && (
        <div className={`cv-subtitle cv-subtitle--${size}`} data-testid="subtitle">
          {subtitle.speaker && <span className="cv-subtitle__speaker">{subtitle.speaker} : </span>}
          {subtitle.text}
        </div>
      )}
      {doc?.skippable && (
        <div className="cv-skip">
          <KeyCap code={settings.bindings.skip[0]} /> {t('ui.cinematic.skip')}
        </div>
      )}
    </>
  );
}

export function useCinematicHidesHud(): boolean {
  const { doc } = useCinematicState();
  return !!doc && doc.hideHud;
}

export function ScreenFx() {
  const fade = useUi((s) => s.fade);
  const flash = useUi((s) => s.flash);
  const tint = useUi((s) => s.tint);
  return (
    <>
      <div
        className="cv-fade"
        style={{ opacity: fade.opacity, background: fade.color, transitionDuration: `${fade.seconds}s` }}
        aria-hidden="true"
      />
      {flash && <div key={flash.key} className="cv-flash" style={{ background: flash.color, animationDuration: `${flash.seconds}s` }} aria-hidden="true" />}
      <div
        className="cv-tint"
        style={{ background: tint.color ?? 'transparent', opacity: tint.color ? tint.strength : 0, transitionDuration: `${tint.seconds}s` }}
        aria-hidden="true"
      />
    </>
  );
}

/** Short lines above characters, positioned every frame from the 3D camera. */
export function Barks() {
  const barks = useUi((s) => s.barks);
  const controller = useController();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (barks.length === 0) return;
    let raf = 0;
    const loop = () => {
      bump();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [barks.length]);
  const view = controller.view;
  const world = controller.session.world;
  if (!view || !world) return null;
  return (
    <>
      {barks.map((b) => {
        const e = world.entities.get(b.entityId);
        if (!e || !e.visible) return null;
        const p = view.project({ x: e.position.x, y: e.position.y + 2.15, z: e.position.z });
        if (!p) return null;
        return (
          <div key={b.id} className="cv-bark" style={{ left: p.x, top: p.y }}>
            {b.text}
          </div>
        );
      })}
    </>
  );
}
