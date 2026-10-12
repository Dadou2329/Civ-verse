/**
 * View SDK — custom rendering for civilization packs (Babylon.js).
 *
 * Gameplay never depends on visuals: a visual only *shows* a component (it reads props, state and
 * view flags) and can be replaced or removed without changing the simulation.
 *
 *   export const spinnerVisual = defineVisual({
 *     id: 'door.spinnerVisual',
 *     component: 'door.spinner',
 *     create(view, entity) {
 *       return { update(dt) { for (const c of entity.root.getChildren()) ... }, dispose() {} };
 *     },
 *   });
 *
 * `defineViewEffect` handles `ctx.fx.custom(channel, payload)` requests sent by the simulation.
 * Visuals run wherever a session is rendered: the game, the Studio playtest and the Studio's editor
 * viewport (never headless).
 */
import type { VisualDefinition, ViewEffectDefinition } from '../engine/core/packs/definitions';
import type { ViewContext, VisualEntity } from '../engine/view/entityViews';

export type { ViewContext, VisualEntity };
export { Vector3, Color3, Color4, Mesh, MeshBuilder, StandardMaterial, TransformNode, type AbstractMesh, type Scene } from '@babylonjs/core';

export interface VisualInstance {
  update?(dt: number): void;
  dispose(): void;
}

export function defineVisual(def: { id: string; component: string; create(view: ViewContext, entity: VisualEntity): VisualInstance }): VisualDefinition {
  return { __kind: 'visual', id: def.id, component: def.component, create: def.create as VisualDefinition['create'] };
}

export function defineViewEffect(def: { id: string; channel: string; handle(view: ViewContext, payload: Record<string, unknown>): void }): ViewEffectDefinition {
  return { __kind: 'viewEffect', id: def.id, channel: def.channel, handle: def.handle as ViewEffectDefinition['handle'] };
}
