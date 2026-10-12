import { Component, useEffect, type ComponentType, type ReactNode } from 'react';
import { CivUiContext, type PanelProps } from '@sdk/ui';
import { useUi } from '../state/uiStore';
import { useController, useSession } from '../hooks';
import type { HudSlot } from '@engine/core/sim/api';

/** Isolates civilization UI errors: a broken component never takes the whole HUD down. */
class CivErrorBoundary extends Component<{ name: string; children: ReactNode; onError: (err: Error) => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: Error) {
    this.props.onError(err);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function CivHudSlot({ slot }: { slot: HudSlot }) {
  const huds = useUi((s) => s.huds);
  const session = useSession();
  const civ = session.civ;
  if (!civ) return null;
  const items = huds.filter((h) => h.def.slot === slot && h.civId === civ.id).sort((a, b) => (a.def.order ?? 0) - (b.def.order ?? 0));
  if (items.length === 0) return null;
  return (
    <CivUiContext.Provider value={civ.ctx}>
      <div className={`cv-civ-slot cv-civ-slot--${slot}`}>
        {items.map(({ def }) => {
          if (def.visibleWhen && !session.interpreter.test(def.visibleWhen, { origin: `hud ${def.id}` })) return null;
          const C = def.component as unknown as ComponentType;
          return (
            <CivErrorBoundary key={def.id} name={def.id} onError={(err) => session.log.error(`Élément d'interface ${def.id}`, err)}>
              <C />
            </CivErrorBoundary>
          );
        })}
      </div>
    </CivUiContext.Provider>
  );
}

export function CivPanels() {
  const panels = useUi((s) => s.panels);
  const controller = useController();
  const session = controller.session;
  const open = panels.length > 0;
  useEffect(() => {
    controller.setModal(open);
  }, [open, controller]);
  const civ = session.civ;
  if (!civ || !open) return null;
  return (
    <CivUiContext.Provider value={civ.ctx}>
      {panels.map(({ def, props }) => {
        const C = def.component as unknown as ComponentType<PanelProps>;
        return (
          <div key={def.id} className="cv-panel-host" role="dialog" aria-modal="true">
            <CivErrorBoundary
              name={def.id}
              onError={(err) => {
                session.log.error(`Panneau ${def.id}`, err);
                session.closePanel(def.id, null);
              }}
            >
              <C props={props} close={(result) => session.closePanel(def.id, result)} />
            </CivErrorBoundary>
          </div>
        );
      })}
    </CivUiContext.Provider>
  );
}
