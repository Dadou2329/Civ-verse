/**
 * GameController: owns the session, the 3D view, saves and screen transitions.
 * React components drive the game exclusively through this class.
 */
import { GameSession } from '@engine/core/sim/session';
import { GlobContentProvider } from '@engine/platform/globContent';
import { BrowserSaveStorage } from '@engine/platform/idbSaveStorage';
import type { ContentProvider } from '@engine/core/packs/pack';
import type { RunMode } from '@engine/core/sim/api';
import type { SaveStorage } from '@engine/core/save/storage';
import type { Vec3 } from '@engine/core/util/math';
import { loadSettings, saveSettings, type GameSettings } from '@engine/platform/settings';
import { GameView } from '@engine/view/gameView';
import { parseSave, SaveLoadError } from '@engine/core/save/saveFormat';
import type { SaveSlotInfo } from '@engine/core/save/storage';
import { ReactUiBridge, useUi, handlePresentationForUi, type Overlay } from './state/uiStore';
import { loadKeyboardLayout } from '@engine/input/inputManager';
import { toError } from '@engine/core/util/assert';

export const SAVE_SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

const AUTOSAVE_SECONDS = 120;

export interface ControllerOptions {
  provider?: ContentProvider;
  mode?: RunMode;
  /** Civilization Studio's playtest passes an in-memory storage: real saves are never touched. */
  storage?: SaveStorage;
}

export class GameController {
  readonly storage: SaveStorage;
  view: GameView | null = null;
  settings: GameSettings;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();

  private constructor(
    readonly session: GameSession,
    storage: SaveStorage,
  ) {
    this.storage = storage;
    this.settings = loadSettings();
    session.presentation.subscribe(handlePresentationForUi);
    // Autosave at meaningful moments.
    session.bus.on('quest.completed', () => void this.autosave());
    session.bus.on('quest.stageChanged', () => void this.autosave());
    session.bus.on('scene.entered', () => void this.autosave());
    session.bus.on('civ.finished', () => void this.finishCiv());
  }

  static async create(opts: ControllerOptions = {}): Promise<GameController> {
    void loadKeyboardLayout();
    const session = await GameSession.create({ mode: opts.mode ?? 'play', provider: opts.provider ?? new GlobContentProvider(), ui: new ReactUiBridge(), locale: 'fr-FR' });
    const c = new GameController(session, opts.storage ?? new BrowserSaveStorage());
    if (import.meta.env.DEV) (window as unknown as { __civ: unknown }).__civ = { controller: c, session };
    return c;
  }

  /**
   * Civilization Studio's PLAY: starts a fresh run of a civilization, either from its beginning
   * or « ici » (a scene and a position, without the opening events).
   */
  async startPlaytest(civId: string, opts: { scene?: string; place?: { position: Vec3; yaw?: number; pitch?: number }; quietStart?: boolean } = {}): Promise<void> {
    const ui = useUi.getState();
    const manifest = this.session.manifests.get(civId);
    ui.set({ screen: 'loading', overlay: null, loadingLabel: manifest ? this.session.t(manifest.name) : civId, error: null, endScreen: null, document: null, panels: [] });
    try {
      await this.session.loadCivilization(civId, { fresh: true, ...opts });
      this.enterPlaying();
    } catch (err) {
      this.fail(err);
    }
  }

  /** Releases the 3D view and the session (end of a Studio playtest). */
  dispose(): void {
    this.stopAutosave();
    this.view?.dispose();
    this.view = null;
    this.session.dispose();
    this.listeners.clear();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    if (this.view) return;
    this.view = new GameView({ canvas, session: this.session, settings: this.settings });
    this.view.start();
  }

  applySettings(next: GameSettings): void {
    this.settings = next;
    saveSettings(next);
    this.view?.applySettings(next);
    this.session.i18n.setLocale(next.locale);
    this.changed();
  }

  // -------------------------------------------------------------------------------------------
  // Game flow
  // -------------------------------------------------------------------------------------------

  async listSaves(): Promise<SaveSlotInfo[]> {
    try {
      return await this.storage.list();
    } catch (err) {
      this.session.log.error('Lecture des sauvegardes impossible', err);
      return [];
    }
  }

  /** Starts (or continues) a civilization from the selection screen. */
  async startCiv(civId: string, opts: { fresh?: boolean } = {}): Promise<void> {
    const ui = useUi.getState();
    const manifest = this.session.manifests.get(civId);
    ui.set({ screen: 'loading', overlay: null, loadingLabel: manifest ? this.session.t(manifest.name) : civId, error: null });
    try {
      await new Promise((r) => setTimeout(r, 30));
      await this.session.loadCivilization(civId, { fresh: opts.fresh });
      this.enterPlaying();
      await this.autosave();
    } catch (err) {
      this.fail(err);
    }
  }

  async newGame(): Promise<void> {
    await this.session.resetAll();
    await this.storage.delete('auto').catch(() => undefined);
    useUi.getState().set({ screen: 'civs', overlay: null });
  }

  async continueGame(slot: SaveSlot = 'auto'): Promise<void> {
    await this.loadSlot(slot);
  }

  async loadSlot(slot: SaveSlot): Promise<void> {
    const ui = useUi.getState();
    ui.set({ screen: 'loading', overlay: null, loadingLabel: this.session.t('ui.loading.save'), error: null });
    try {
      const raw = await this.storage.load(slot);
      if (!raw) throw new SaveLoadError(this.session.t('ui.save.empty'));
      const { save, warnings } = parseSave(raw);
      for (const w of warnings) this.session.log.info(w);
      await this.session.applySaveGame(save);
      if (save.currentCiv) {
        await this.session.loadCivilization(save.currentCiv);
        this.enterPlaying();
      } else {
        useUi.getState().set({ screen: 'civs' });
      }
    } catch (err) {
      this.fail(err);
    }
  }

  async save(slot: SaveSlot): Promise<boolean> {
    if (!this.session.civ) return false;
    try {
      const label = `${this.session.t(this.session.civ.manifest.name)} — ${this.session.world ? this.session.t(this.session.world.doc.name) : ''}`;
      const data = this.session.buildSaveGame(slot, label);
      await this.storage.save(slot, data);
      if (slot !== 'auto') this.session.notify(this.session.t('ui.save.done'), 'success');
      this.session.bus.emit('save.completed', { slot });
      return true;
    } catch (err) {
      this.session.log.error('Sauvegarde impossible', err);
      this.session.notify(this.session.t('ui.save.failed'), 'warning');
      return false;
    }
  }

  async autosave(): Promise<void> {
    if (!this.session.civ || this.session.isLoading) return;
    await this.save('auto');
  }

  async quitToMenu(): Promise<void> {
    await this.autosave();
    this.stopAutosave();
    this.setPlaying(false);
    await this.session.unloadCivilization();
    useUi.getState().set({ screen: 'menu', overlay: null });
    this.changed();
  }

  /** Back to the civilization selection after an ending. */
  async finishCiv(): Promise<void> {
    await this.autosave();
    this.stopAutosave();
    this.setPlaying(false);
    await this.session.unloadCivilization();
    await this.save('auto').catch(() => undefined);
    useUi.getState().set({ screen: 'civs', overlay: null });
    this.changed();
  }

  private enterPlaying(): void {
    useUi.getState().set({ screen: 'playing', overlay: null });
    this.setPlaying(true);
    this.startAutosave();
    this.changed();
  }

  private fail(err: unknown): void {
    const e = toError(err);
    this.session.log.error('Erreur de chargement', e);
    useUi.getState().set({ screen: 'error', error: e.message });
  }

  private startAutosave(): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(() => void this.autosave(), AUTOSAVE_SECONDS * 1000);
  }

  private stopAutosave(): void {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.autosaveTimer = null;
  }

  // -------------------------------------------------------------------------------------------
  // Play state, overlays and pause
  // -------------------------------------------------------------------------------------------

  setPlaying(playing: boolean): void {
    if (!this.view) return;
    this.view.playing = playing;
    this.view.input.enabled = playing;
    if (playing) this.view.input.requestPointerLock();
    else this.view.input.exitPointerLock();
  }

  openOverlay(overlay: Exclude<Overlay, null>): void {
    useUi.getState().set({ overlay });
    this.session.setPaused('menu', true);
    this.setPlaying(false);
  }

  closeOverlay(): void {
    useUi.getState().set({ overlay: null });
    this.session.setPaused('menu', false);
    this.setPlaying(true);
  }

  /** Called when UI modal content (document, panel, end screen, confirm) opens or closes. */
  setModal(open: boolean): void {
    if (!this.view) return;
    this.view.playing = !open && useUi.getState().overlay === null && useUi.getState().screen === 'playing';
    this.view.input.enabled = this.view.playing;
    if (open) this.view.input.exitPointerLock();
  }
}
