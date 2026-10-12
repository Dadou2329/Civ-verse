/**
 * HUD of the item in hand and of combat: hotbar, worn items, mouse-button verbs, progress ring,
 * hit marker, player health, boss bar, health bars above hurt enemies, the direction of a blow
 * taken, and the defeat screen.
 *
 * Each part only appears when it has something to show: civilizations without holdable items or
 * combat never see them. They use the civilization's theme colors (--civ-*) and can be hidden
 * (and replaced by a civilization HUD) with the HUD elements 'hotbar', 'health', 'bossBar' and
 * 'handHints'.
 */
import { useEffect, useReducer, useRef } from 'react';
import { useController, useSession, useT } from '../hooks';
import { KeyCap } from '../ui/common';
import { iconDataUrl } from '../ui/icons';
import { keyLabel } from '@engine/input/inputManager';

/** Re-renders on every animation frame while `active`. */
function useFrame(active: boolean): void {
  const [, bump] = useReducer((x: number) => x + 1, 0);
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
}

/** Re-renders when the hotbar, the selection or worn items change. */
function useEquipmentRevision(): number {
  const session = useSession();
  const [n, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const d = session.equipment.onChange(bump);
    return () => d.dispose();
  }, [session]);
  return n;
}

const HOTBAR_ACTIONS = ['hotbar1', 'hotbar2', 'hotbar3', 'hotbar4', 'hotbar5', 'hotbar6'] as const;

export function Hotbar() {
  const session = useSession();
  const { settings } = useController();
  const t = useT();
  useEquipmentRevision();
  const eq = session.equipment;
  const worn = [...eq.worn.entries()];
  if (!eq.hotbar.some(Boolean) && worn.length === 0) return null;
  const heldDef = eq.held ? session.items.get(eq.held) : undefined;
  return (
    <div className="cv-hotbar-wrap">
      {heldDef && (
        <div key={eq.hand.serial} className="cv-hotbar__name" data-testid="held-name">
          {t(heldDef.name)}
        </div>
      )}
      <div className="cv-hotbar" role="list" aria-label={t('ui.hotbar.label')} data-testid="hotbar">
        {worn.length > 0 && (
          <div className="cv-hotbar__worn" data-testid="worn">
            {worn.map(([slot, id]) => {
              const def = session.items.get(id);
              return (
                <div key={slot} className="cv-hotbar__worn-item" title={def ? `${t('ui.inventory.worn')} : ${t(def.name)}` : id}>
                  {def && <img src={iconDataUrl(def.icon)} alt="" />}
                </div>
              );
            })}
          </div>
        )}
        {eq.hotbar.map((id, i) => {
          const def = id ? session.items.get(id) : undefined;
          const selected = i === eq.selected;
          const key = settings.bindings[HOTBAR_ACTIONS[i]!]?.[0];
          return (
            <div
              key={i}
              role="listitem"
              className={`cv-hotbar__slot ${selected ? 'is-selected' : ''} ${def ? '' : 'is-empty'}`}
              data-testid={`hotbar-slot-${i + 1}`}
              title={def ? t(def.name) : undefined}
            >
              {def && <img src={iconDataUrl(def.icon)} alt="" />}
              {selected && def && eq.hand.drawDuration > 0.05 && (
                <span key={eq.hand.serial} className="cv-hotbar__draw" style={{ animationDuration: `${eq.hand.drawDuration}s` }} />
              )}
              {key && <span className="cv-hotbar__key">{keyLabel(key)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mouse-button verbs of the item in hand, a progress ring for long uses, the hit marker. */
export function HandHints() {
  const session = useSession();
  const { settings } = useController();
  useEquipmentRevision();
  const eq = session.equipment;
  const active = eq.held !== null || eq.progress !== null || session.combat.enabled;
  useFrame(active);
  const marker = useFlash(session.combat.hitMarker.serial);
  if (!active || session.dialogue.isActive || session.combat.player.defeated) return null;
  const rows = [
    eq.hints.primary && { key: settings.bindings.attack[0], verb: eq.hints.primary, button: 'primary' },
    eq.hints.secondary && { key: settings.bindings.block[0], verb: eq.hints.secondary, button: 'secondary' },
  ].filter(Boolean) as { key: string | undefined; verb: string; button: string }[];
  const progress = eq.progress;
  const ringR = 15;
  const circumference = 2 * Math.PI * ringR;
  return (
    <>
      {progress && (
        <div className="cv-use-progress" data-testid="use-progress">
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <circle cx="22" cy="22" r={ringR} className="cv-use-progress__track" />
            <circle cx="22" cy="22" r={ringR} className="cv-use-progress__fill" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress.value)} />
          </svg>
          <span className="cv-use-progress__label">{progress.label}</span>
        </div>
      )}
      {marker !== null && <div key={marker} className={`cv-hit-marker cv-hit-marker--${session.combat.hitMarker.outcome}`} aria-hidden="true" />}
      {rows.length > 0 && !progress && (
        <div className="cv-hand-hints" data-testid="hand-hints">
          {rows.map((r) => (
            <span key={r.button} className={`cv-hand-hints__row ${eq.ready(r.button as 'primary' | 'secondary') ? '' : 'is-waiting'}`}>
              <KeyCap code={r.key} />
              <span>{r.verb}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** Returns the serial while a short flash should be visible after it changed, else null. */
function useFlash(serial: number, ms = 260): number | null {
  const last = useRef(serial);
  const until = useRef(0);
  if (serial !== last.current) {
    last.current = serial;
    until.current = performance.now() + ms;
  }
  return performance.now() < until.current ? serial : null;
}

export function HealthBar() {
  const session = useSession();
  const t = useT();
  const c = session.combat;
  useFrame(c.enabled);
  const hurt = useFlash(c.hurt.serial, 700);
  if (!c.enabled) return null;
  const ratio = Math.max(0, Math.min(1, c.player.health / c.player.maxHealth));
  const low = ratio < 0.3 && !c.player.defeated;
  return (
    <div className={`cv-health ${low ? 'is-low' : ''} ${hurt !== null ? 'is-hurt' : ''}`} data-testid="health" role="meter" aria-valuenow={Math.round(c.player.health)} aria-valuemax={c.player.maxHealth} aria-label={t('ui.combat.health')}>
      <span className="cv-health__label">{t('ui.combat.health')}</span>
      <div className="cv-health__bar">
        <div className="cv-health__trail" style={{ width: `${ratio * 100}%` }} />
        <div className="cv-health__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export function BossBar() {
  const session = useSession();
  const bar = session.combat.bossBar;
  useFrame(session.combat.enabled);
  if (!bar) return null;
  const ratio = Math.max(0, Math.min(1, bar.health / bar.max));
  return (
    <div className="cv-boss" data-testid="boss-bar">
      <div className="cv-boss__name">{bar.name}</div>
      {bar.title && <div className="cv-boss__title">{bar.title}</div>}
      <div className="cv-boss__bar">
        <div className="cv-boss__trail" style={{ width: `${ratio * 100}%` }} />
        <div className="cv-boss__fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

/** Small health bars above enemies that were just hit, and the direction of blows taken. */
export function CombatOverlay() {
  const controller = useController();
  const session = controller.session;
  const c = session.combat;
  useFrame(c.enabled);
  const hurt = useFlash(c.hurt.serial, 800);
  const view = controller.view;
  const world = session.world;
  if (!c.enabled || !view || !world) return null;
  const bars: { id: string; x: number; y: number; ratio: number }[] = [];
  const eye = session.player.eye;
  const f = session.player.forward;
  for (const e of world.entities.values()) {
    const flags = e.view.flags;
    if (!flags.healthBar || !e.visible) continue;
    const p = world.markerPoint(e);
    if ((p.x - eye.x) * f.x + (p.y - eye.y) * f.y + (p.z - eye.z) * f.z < 0.3) continue;
    const s = view.project({ x: p.x, y: p.y + 0.35, z: p.z });
    if (s) bars.push({ id: e.id, x: s.x, y: s.y, ratio: Number(flags.health ?? 1) });
  }
  let hurtAngle: number | null = null;
  if (hurt !== null && c.hurt.from) {
    const dx = c.hurt.from.x - session.player.position.x;
    const dz = c.hurt.from.z - session.player.position.z;
    if (Math.hypot(dx, dz) > 0.2) hurtAngle = Math.atan2(dx, dz) - session.player.yaw;
  }
  return (
    <div className="cv-combat-overlay" aria-hidden="true">
      {bars.map((b) => (
        <div key={b.id} className="cv-enemy-bar" style={{ left: b.x, top: b.y }} data-testid="enemy-bar">
          <div className="cv-enemy-bar__fill" style={{ width: `${Math.max(0, Math.min(1, b.ratio)) * 100}%` }} />
        </div>
      ))}
      {hurtAngle !== null && <div key={hurt} className="cv-hurt-arc" style={{ transform: `translate(-50%, -50%) rotate(${hurtAngle}rad)` }} />}
    </div>
  );
}

export function DefeatOverlay() {
  const session = useSession();
  const t = useT();
  useFrame(session.combat.enabled);
  if (!session.combat.player.defeated) return null;
  return (
    <div className="cv-defeat" data-testid="defeat" role="status">
      <div className="cv-defeat__title">{t('ui.combat.defeated')}</div>
      <div className="cv-defeat__hint">{t('ui.combat.respawn')}</div>
    </div>
  );
}
