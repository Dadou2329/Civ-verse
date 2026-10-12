/**
 * Runtime entities: a scene document entity brought to life (transform, visibility, component
 * records with their behavior instances and persistent state, colliders).
 */
import type { EntityDoc } from '../content/schemas';
import type { BehaviorDefinition } from '../packs/definitions';
import type { BehaviorContext, BehaviorInstance } from '../sim/api';
import type { PropSchema } from '../props/props';
import type { JsonValue } from '../util/json';
import type { Vec3 } from '../util/math';
import type { AABB } from '../physics/aabb';

export interface ComponentRecord {
  type: string;
  def: BehaviorDefinition<PropSchema, unknown> | null;
  /** Props as stored in the scene document. */
  baseProps: Record<string, unknown>;
  /** Runtime overrides (persisted in saves). */
  overrides: Record<string, JsonValue>;
  /** Effective props (normalized base + overrides). */
  props: Record<string, unknown>;
  state: unknown;
  instance: BehaviorInstance | null;
  ctx: BehaviorContext<Record<string, unknown>, unknown> | null;
  /** Set when the behavior threw: the instance is no longer updated. */
  faulted: string | null;
}

export interface ColliderPart {
  local: AABB;
  solid: boolean;
  pickable: boolean;
}

export class RuntimeEntity {
  readonly id: string;
  readonly doc: EntityDoc;
  position: Vec3;
  /** Degrees: [x, y, z]. */
  rotation: [number, number, number];
  scale: [number, number, number];
  tags: string[];
  visible = true;
  enabled = true;
  readonly components = new Map<string, ComponentRecord>();
  readonly colliderParts = new Map<string, ColliderPart>();
  /** Spawned at runtime (not in the scene document). */
  readonly spawned: boolean;
  /** Whether a spawned entity is written to saves. */
  readonly persistent: boolean;
  /** Presentation state read by the view. */
  view = {
    animation: 'idle' as string,
    animationLoop: true,
    expression: 'neutral' as string,
    lookAt: null as Vec3 | null,
    /** Movement speed (m/s) for walk cycles. */
    speed: 0,
    /** Free-form flags for pack visuals. */
    flags: {} as Record<string, unknown>,
  };
  /** Incremented when transform/visibility changes (view sync). */
  revision = 0;

  constructor(doc: EntityDoc, spawned = false, persistent = true) {
    this.id = doc.id;
    this.doc = doc;
    this.position = { x: doc.position[0], y: doc.position[1], z: doc.position[2] };
    this.rotation = [...(doc.rotation ?? [0, 0, 0])] as [number, number, number];
    this.scale = [...(doc.scale ?? [1, 1, 1])] as [number, number, number];
    this.tags = [...(doc.tags ?? [])];
    this.spawned = spawned;
    this.persistent = persistent;
  }

  get yaw(): number {
    return this.rotation[1];
  }

  has(type: string): boolean {
    return this.components.has(type);
  }

  /** True if the transform or visibility differ from the scene document. */
  transformChanged(): boolean {
    const d = this.doc;
    const r = d.rotation ?? [0, 0, 0];
    return (
      this.position.x !== d.position[0] ||
      this.position.y !== d.position[1] ||
      this.position.z !== d.position[2] ||
      this.rotation[1] !== r[1]
    );
  }
}
