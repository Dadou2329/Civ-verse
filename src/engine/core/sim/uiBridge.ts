/**
 * Bridge between the simulation and the user interface. The game and the Studio implement it
 * with the React HUD; headless runs use HeadlessUi which records everything and resolves
 * documents/end screens immediately.
 */
import type { DocumentSpec, HudElement, NotifyOptions } from './api';
import type { HudDefinition, PanelDefinition } from '../packs/definitions';
import { type Disposable, toDisposable } from '../util/disposable';

export interface UiNotification {
  id: number;
  text: string;
  kind: NonNullable<NotifyOptions['kind']>;
  icon?: string;
  duration: number;
}

export interface UiBridge {
  notify(n: UiNotification): void;
  showLocation(title: string, subtitle?: string): void;
  showDocument(doc: DocumentSpec): Promise<void>;
  openPanel(def: PanelDefinition, civId: string, props: Record<string, unknown>): void;
  closePanel(id: string): void;
  setHudVisible(element: HudElement, visible: boolean): void;
  registerHud(def: HudDefinition, civId: string): Disposable;
  showEndScreen(spec: { title: string; subtitle?: string; lines?: string[] }): Promise<void>;
  confirm(spec: { title: string; message: string; confirm: string; cancel: string }): Promise<boolean>;
  /** Called when a civilization is unloaded: remove every civ-specific UI. */
  resetCiv(civId: string): void;
}

export class HeadlessUi implements UiBridge {
  readonly notifications: UiNotification[] = [];
  readonly locations: string[] = [];
  readonly documents: DocumentSpec[] = [];
  readonly endScreens: { title: string; subtitle?: string; lines?: string[] }[] = [];
  readonly openPanels = new Map<string, Record<string, unknown>>();
  readonly huds = new Map<string, HudDefinition>();
  readonly hudVisibility = new Map<HudElement, boolean>();
  /** Answer used by confirm() in headless runs. */
  confirmAnswer = true;

  notify(n: UiNotification): void {
    this.notifications.push(n);
  }
  showLocation(title: string): void {
    this.locations.push(title);
  }
  showDocument(doc: DocumentSpec): Promise<void> {
    this.documents.push(doc);
    return Promise.resolve();
  }
  openPanel(def: PanelDefinition, _civId: string, props: Record<string, unknown>): void {
    this.openPanels.set(def.id, props);
  }
  closePanel(id: string): void {
    this.openPanels.delete(id);
  }
  setHudVisible(element: HudElement, visible: boolean): void {
    this.hudVisibility.set(element, visible);
  }
  registerHud(def: HudDefinition): Disposable {
    this.huds.set(def.id, def);
    return toDisposable(() => this.huds.delete(def.id));
  }
  showEndScreen(spec: { title: string; subtitle?: string; lines?: string[] }): Promise<void> {
    this.endScreens.push(spec);
    return Promise.resolve();
  }
  confirm(): Promise<boolean> {
    return Promise.resolve(this.confirmAnswer);
  }
  resetCiv(): void {
    this.openPanels.clear();
    this.huds.clear();
    this.hudVisibility.clear();
  }
}
