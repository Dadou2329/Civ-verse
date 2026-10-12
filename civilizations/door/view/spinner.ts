import { defineBehavior, prop } from '@sdk';
import { defineVisual, TransformNode } from '@sdk/view';

/**
 * Turning gears of the Archives' mechanism. The behavior only carries the settings; the visual
 * (view SDK) rotates the entity's model. Headless runs and tests ignore it entirely.
 */
export const spinner = defineBehavior({
  id: 'door.spinner',
  label: 'Rotation continue (décor)',
  category: 'Décor',
  description: 'Fait tourner le modèle de l’entité (engrenages, roues). Purement visuel.',
  props: {
    speed: prop.number({ label: 'Vitesse (°/s)', default: 10, min: -360, max: 360 }),
    axis: prop.enum(['x', 'y', 'z'] as const, { label: 'Axe local', default: 'z' }),
  },
  create() {},
});

export const spinnerVisual = defineVisual({
  id: 'door.spinnerVisual',
  component: 'door.spinner',
  create(_view, entity) {
    return {
      update(dt) {
        const p = entity.props<{ speed?: number; axis?: 'x' | 'y' | 'z' }>('door.spinner');
        const delta = ((p.speed ?? 10) * Math.PI * dt) / 180;
        const axis = p.axis ?? 'z';
        for (const child of entity.root.getChildren()) {
          if (child instanceof TransformNode) child.rotation[axis] += delta;
        }
      },
      dispose() {},
    };
  },
});
