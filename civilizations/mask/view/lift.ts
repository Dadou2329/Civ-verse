import { Color4, defineVisual, Vector3 } from '@sdk/view';

/**
 * The runaway wagon, seen: smoke from its overheated brake (« Tu vois la fumée ? ») until it is
 * stopped, sparks under its wheels while it rolls, a last puff of steam when the brake bites.
 * Reads the view flag `lift` written by the behavior `mask.monteCharge`.
 */
export const liftVisual = defineVisual({
  id: 'mask.monteChargeVisual',
  component: 'mask.monteCharge',
  create(view, entity) {
    // Pale and dense enough to read against the dark loading dock, from the foot of the rail.
    const smoke = view.createParticles('smoke', entity.root.position.clone(), { color: '#a49c94', size: [0.8, 0.3, 0.8], rate: 6 });
    const sparks = view.createParticles('sparks', entity.root.position.clone(), { color: '#ffb35a', size: [1.2, 0.1, 1.8], rate: 2 });
    // Thicker than the generic smoke preset: an overheated brake, not a chimney.
    smoke.color1 = new Color4(0.66, 0.62, 0.58, 0.62);
    smoke.color2 = new Color4(0.52, 0.49, 0.46, 0.48);
    smoke.colorDead = new Color4(0.5, 0.48, 0.46, 0);
    smoke.minSize = 0.7;
    smoke.maxSize = 1.8;
    const smokeRate = smoke.emitRate;
    const sparksRate = sparks.emitRate;
    let stoppedFor = 0;
    const back = new Vector3();
    return {
      update(dt) {
        const status = String(entity.flags.lift ?? 'idle');
        // The smoke rises above the wagon from its brake and drifts the way it rolls (out of the
        // loading dock), so that it reads from below.
        const yaw = (entity.yaw * Math.PI) / 180;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        back.set(entity.position.x - fx * 0.5, entity.position.y + 1.1, entity.position.z - fz * 0.5);
        (smoke.emitter as Vector3).copyFrom(back);
        smoke.direction1.set(fx * 0.25 - 0.1, 0.45, fz * 0.25 - 0.1);
        smoke.direction2.set(fx * 0.6 + 0.1, 0.8, fz * 0.6 + 0.1);
        (sparks.emitter as Vector3).set(entity.position.x, entity.position.y + 0.1, entity.position.z);
        if (status === 'stopped') {
          // A last cloud of steam, then nothing.
          stoppedFor += dt;
          smoke.emitRate = stoppedFor < 2.5 ? smokeRate * 2.5 : Math.max(0, smokeRate * (1 - (stoppedFor - 2.5) / 3));
          sparks.emitRate = 0;
        } else {
          stoppedFor = 0;
          smoke.emitRate = status === 'idle' ? smokeRate : smokeRate * 1.3;
          sparks.emitRate = status === 'running' ? sparksRate : 0;
        }
      },
      dispose() {
        smoke.dispose();
        sparks.dispose();
      },
    };
  },
});
