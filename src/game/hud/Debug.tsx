import { useController, useInterval, useT } from '../hooks';

/**
 * F3 developer overlay: performance, location, story state, mechanics, recent logic, errors.
 * Player builds show the performance line only: identifiers of variables, quests, entities and
 * mechanics are never displayed to players (the Studio's playtest runs in development).
 */
export function DebugOverlay() {
  useInterval(250);
  const controller = useController();
  const t = useT();
  const st = controller.view?.stats;
  return (
    <div className="cv-debug" data-testid="debug">
      <div>
        <b>{t('ui.debug.performance')}</b> {st
          ? t('ui.debug.stats', {
              fps: st.fps.toFixed(0),
              ms: st.frameMs.toFixed(1),
              calls: st.drawCalls,
              vertices: st.vertices,
              chunks: st.chunks,
              pending: st.pendingChunks,
              entities: st.entities,
            })
          : '—'}
      </div>
      {import.meta.env.DEV && <DevDetails />}
      <div className="cv-muted">{t('ui.debug.keys')}</div>
    </div>
  );
}

function DevDetails() {
  const controller = useController();
  const t = useT();
  const s = controller.session;
  const p = s.player.position;
  const target = s.interaction.target;
  const civ = s.civ;
  const vars = civ ? Object.entries(s.vars.snapshot(civ.id)) : [];
  const errors = s.logHub.errors().slice(-4);
  const missing = s.i18n.missing();
  const traces = s.interpreter.traces().slice(-12).reverse();
  return (
    <>
      <div>
        <b>{t('ui.debug.location')}</b> {civ?.id ?? '—'} / {s.world?.id ?? '—'} · x {p.x.toFixed(2)} y {p.y.toFixed(2)} z {p.z.toFixed(2)} · {s.player.body.grounded ? t('ui.debug.grounded') : t('ui.debug.airborne')}
      </div>
      <div>
        <b>{t('ui.debug.target')}</b> {target ? `${target.entityId} (${target.distance.toFixed(2)} m)` : '—'}
      </div>
      <div>
        <b>{t('ui.debug.quests')}</b> {s.quests.active().map((q) => `${q}:${s.quests.stage(q)}`).join(', ') || '—'}
      </div>
      <div>
        <b>{t('ui.debug.mechanics')}</b>{' '}
        {civ
          ? [...civ.mechanics.entries()].map(([id, m]) => (m.failed ? `${id} ⚠` : id)).join(', ')
          : '—'}
      </div>
      <div>
        <b>{t('ui.debug.locks')}</b> {s.player.lockReasons().join(', ') || '—'} · {t('ui.debug.listeners')} {s.leakedListeners}
      </div>
      {missing.length > 0 && (
        <div className="cv-debug__errors">
          ⚠ {t('ui.debug.missingTexts', { count: missing.length })} {missing.slice(0, 6).join(', ')}
        </div>
      )}
      <details>
        <summary>{t('ui.debug.vars', { count: vars.length })}</summary>
        <pre>{vars.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n')}</pre>
      </details>
      <details>
        <summary>{t('ui.debug.logic', { count: traces.length })}</summary>
        <pre>
          {traces
            .map((e) => `${e.time.toFixed(1)} s ${e.ok ? '✓' : '✗'} ${t(`ui.debug.trace.${e.kind}`)} ${e.type} — ${e.origin}${e.detail ? ` (${e.detail})` : ''}`)
            .join('\n')}
        </pre>
      </details>
      {errors.length > 0 && (
        <div className="cv-debug__errors">
          {errors.map((e, i) => (
            <div key={i}>
              ⚠ [{e.source}] {e.message} {typeof e.data === 'string' ? `— ${e.data}` : ''}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
