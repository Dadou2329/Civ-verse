/**
 * Player interactions: what the crosshair targets, the prompt to show, and the interaction
 * pipeline (offers → vetoes from other behaviors → execution → events).
 */
import type { GameSession } from './session';
import type { SourcedOffer } from './behaviorSystem';
import { raycastVoxels } from '../voxel/raycast';
import type { InteractionAttempt } from './api';
import { toError } from '../util/assert';

export const INTERACT_DISTANCE = 3.2;

export interface InteractionTarget {
  entityId: string;
  distance: number;
  primary: SourcedOffer | null;
  secondary: SourcedOffer | null;
}

export class InteractionSystem {
  private current: InteractionTarget | null = null;
  private signature = '';
  private listeners = new Set<() => void>();
  private busy = false;

  constructor(private readonly session: GameSession) {}

  get target(): InteractionTarget | null {
    return this.current;
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  reset(): void {
    this.set(null);
  }

  private blocked(): boolean {
    const s = this.session;
    return s.player.movementLocked || s.dialogue.isActive || s.cinematics.current !== null || s.paused;
  }

  refresh(): void {
    const s = this.session;
    const world = s.world;
    if (!world || this.blocked()) return this.set(null);
    const eye = s.player.eye;
    const dir = s.player.forward;
    const vox = raycastVoxels(world.volume, world.paletteInfo(), eye, dir, INTERACT_DISTANCE);
    const max = vox ? vox.distance : INTERACT_DISTANCE;
    const hit = world.colliders.raycast(eye, dir, max, (c) => c.pickable && c.owner !== 'player');
    if (!hit) return this.set(null);
    const e = world.entities.get(hit.entry.owner);
    if (!e) return this.set(null);
    this.set(this.buildTarget(e.id, hit.distance));
  }

  private buildTarget(entityId: string, distance: number): InteractionTarget | null {
    const e = this.session.world?.entities.get(entityId);
    if (!e) return null;
    const offers = this.session.behaviors.offers(e);
    const primary = offers.find((o) => (o.offer.key ?? 'primary') === 'primary') ?? null;
    const secondary = offers.find((o) => o.offer.key === 'secondary') ?? null;
    if (!primary && !secondary) return null;
    return { entityId, distance, primary, secondary };
  }

  private set(t: InteractionTarget | null): void {
    const sig = t
      ? `${t.entityId}|${t.primary?.offer.label}|${t.primary?.offer.detail}|${t.primary?.offer.enabled}|${t.secondary?.offer.label}|${t.secondary?.offer.enabled}`
      : '';
    this.current = t;
    if (sig !== this.signature) {
      this.signature = sig;
      for (const l of this.listeners) l();
    }
  }

  /** Interacts with the current target (E = primary, F = secondary). */
  async interact(key: 'primary' | 'secondary' = 'primary'): Promise<boolean> {
    const t = this.current;
    if (!t || this.blocked()) return false;
    const so = key === 'primary' ? t.primary : t.secondary;
    if (!so) return false;
    return this.run(t.entityId, so);
  }

  /**
   * Interacts with a given entity without aiming (tests, scripted sequences). Uses the same
   * pipeline as the player and respects vetoes.
   */
  async interactWith(entityId: string, key: 'primary' | 'secondary' = 'primary', offerId?: string): Promise<boolean> {
    const e = this.session.world?.entities.get(entityId);
    if (!e) throw new Error(`Entité introuvable : ${entityId}`);
    const offers = this.session.behaviors.offers(e).filter((o) => (o.offer.key ?? 'primary') === key);
    const so = offerId ? offers.find((o) => o.offer.id === offerId) : offers[0];
    if (!so) return false;
    return this.run(entityId, so);
  }

  private async run(entityId: string, so: SourcedOffer): Promise<boolean> {
    if (this.busy) return false;
    const s = this.session;
    const e = s.world?.entities.get(entityId);
    if (!e) return false;
    const interactionId = so.offer.id ?? so.source;
    if (so.offer.enabled === false) {
      const reason = so.offer.detail ?? s.t('core.interaction.unavailable');
      s.notify(reason, 'denied');
      s.bus.emit('interaction.blocked', { entityId, interaction: interactionId, reason, by: so.source });
      return false;
    }
    const attempt: InteractionAttempt = { entityId, offer: so.offer, source: so.source };
    for (const record of e.components.values()) {
      const inst = record.instance;
      if (!inst?.beforeInteract || record.faulted) continue;
      let block;
      try {
        block = inst.beforeInteract(attempt);
      } catch (err) {
        s.log.error(`Erreur de veto ${entityId}/${record.type}`, toError(err));
        continue;
      }
      if (block) {
        s.notify(block.reason, 'denied');
        if (block.sound) s.presentation.emit({ type: 'sound', id: block.sound, handle: s.presentation.newHandle(), at: e.position });
        s.bus.emit('interaction.blocked', { entityId, interaction: interactionId, reason: block.reason, by: record.type, ...(block.data ?? {}) });
        return false;
      }
    }
    const record = e.components.get(so.source);
    this.busy = true;
    try {
      await record?.instance?.onInteract?.(attempt);
    } catch (err) {
      s.log.error(`Erreur d’interaction ${entityId}/${so.source}`, toError(err));
      return false;
    } finally {
      this.busy = false;
    }
    s.bus.emit('entity.interacted', { entityId, interaction: interactionId });
    this.refresh();
    return true;
  }
}
