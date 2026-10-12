import { useEffect, useState } from 'react';
import { useController, useT } from '../hooks';
import { Button, Modal, formatDate, formatDuration } from '../ui/common';
import { SAVE_SLOTS, type SaveSlot } from '../controller';
import type { SaveSlotInfo } from '@engine/core/save/storage';
import { useUi } from '../state/uiStore';

export function PauseMenu() {
  const controller = useController();
  const t = useT();
  const set = useUi((s) => s.set);
  return (
    <Modal onClose={() => controller.closeOverlay()} className="cv-pause" labelledBy="cv-pause-title">
      <h2 id="cv-pause-title">{t('ui.pause.title')}</h2>
      <div className="cv-menu-list">
        <Button variant="primary" autoFocus onClick={() => controller.closeOverlay()} testId="pause-resume">
          {t('ui.pause.resume')}
        </Button>
        <Button onClick={() => set({ overlay: 'journal' })}>{t('ui.pause.journal')}</Button>
        <Button onClick={() => set({ overlay: 'inventory' })}>{t('ui.pause.inventory')}</Button>
        <Button onClick={() => set({ overlay: 'save' })} testId="pause-save">
          {t('ui.pause.save')}
        </Button>
        <Button onClick={() => set({ overlay: 'load' })}>{t('ui.pause.load')}</Button>
        <Button onClick={() => set({ overlay: 'settings' })}>{t('ui.pause.settings')}</Button>
        <Button variant="danger" onClick={() => void controller.quitToMenu()} testId="pause-quit">
          {t('ui.pause.quit')}
        </Button>
      </div>
    </Modal>
  );
}

export function SaveSlots({ mode }: { mode: 'save' | 'load' }) {
  const controller = useController();
  const t = useT();
  const set = useUi((s) => s.set);
  const [infos, setInfos] = useState<SaveSlotInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void controller.listSaves().then(setInfos);
  }, [controller]);
  const label = (slot: SaveSlot) => (slot === 'auto' ? t('ui.save.auto') : t('ui.save.slot', { n: Number(slot.slice(4)) }));
  const slots = SAVE_SLOTS.filter((s) => mode === 'load' || s !== 'auto');
  return (
    <Modal onClose={() => set({ overlay: 'pause' })} className="cv-saves" labelledBy="cv-saves-title">
      <h2 id="cv-saves-title">{mode === 'save' ? t('ui.save.title') : t('ui.load.title')}</h2>
      <div className="cv-saves__list">
        {slots.map((slot) => {
          const info = infos?.find((i) => i.slot === slot);
          return (
            <button
              key={slot}
              type="button"
              className="cv-saves__slot"
              disabled={busy || (mode === 'load' && !info)}
              data-testid={`slot-${slot}`}
              onClick={async () => {
                setBusy(true);
                if (mode === 'save') {
                  await controller.save(slot);
                  setInfos(await controller.listSaves());
                  setBusy(false);
                } else {
                  await controller.loadSlot(slot);
                }
              }}
            >
              <span className="cv-saves__name">{label(slot)}</span>
              {info ? (
                <span className="cv-saves__meta">
                  {info.label} · {formatDate(info.savedAt)} · {formatDuration(info.playTime)}
                </span>
              ) : (
                <span className="cv-saves__meta cv-muted">{t('ui.save.emptySlot')}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="cv-modal__actions">
        <Button onClick={() => set({ overlay: 'pause' })}>{t('ui.common.back')}</Button>
      </div>
    </Modal>
  );
}
