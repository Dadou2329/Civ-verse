import { defineViewEffect, defineVisual, Color3, MeshBuilder, StandardMaterial, Vector3, type Mesh, type TransformNode } from '@sdk/view';

/**
 * Visuals of Chapter I: the needle of the sorting automaton and the training wheel turn with
 * their adjustment (view flag `calibrage`), the shower falls over the footbridge (flag `averse`),
 * and the blue filament of the split Fil mask reaches for the hero (`mask.filament`).
 */

/** Finds a named part of the entity's model (created by `core.model` under the entity root). */
function partOf(root: TransformNode, entityId: string, part: string): TransformNode | null {
  return root.getChildTransformNodes(false).find((n) => n.name === `${entityId}_${part}`) ?? null;
}

export const calibrageVisual = defineVisual({
  id: 'mask.calibrageVisual',
  component: 'mask.calibrage',
  create(_view, entity) {
    let needle: TransformNode | null = null;
    let wheel: TransformNode | null = null;
    let shown = 0;
    return {
      update(dt) {
        if (!needle && !wheel) {
          needle = partOf(entity.root, entity.id, 'aiguille');
          wheel = partOf(entity.root, entity.id, 'roue');
        }
        const flag = entity.flags.calibrage;
        if (wheel) {
          // A wheel keeps turning once adjusted (it drives the course's second ladder).
          if (typeof flag === 'number') shown = flag;
          else shown = (shown + dt / 1.6) % 1;
          wheel.rotation.z = (shown - 0.5) * Math.PI * 2;
        }
        if (needle && typeof flag === 'number') {
          // The needle sweeps the dial from -60° to +60°.
          needle.rotation.z = (0.5 - flag) * (Math.PI / 1.5);
        }
      },
      dispose() {},
    };
  },
});

export const averseVisual = defineVisual({
  id: 'mask.averseVisual',
  component: 'mask.averse',
  create(view, entity) {
    let rain: ReturnType<typeof view.createParticles> | null = null;
    return {
      update() {
        const raining = entity.flags.averse === true;
        if (raining && !rain) {
          const size = (entity.props<{ size?: [number, number, number] }>('mask.averse').size ?? [12, 8, 12]) as [number, number, number];
          rain = view.createParticles('rain', entity.root.position.clone(), { color: '#c8d4e2', size, rate: 1.2 });
        } else if (!raining && rain) {
          rain.stop();
          const old = rain;
          // Let the last drops fall before freeing the system.
          setTimeout(() => old.dispose(), 1500);
          rain = null;
        }
      },
      dispose() {
        rain?.dispose();
        rain = null;
      },
    };
  },
});

/**
 * The split Fil mask answers the hero's weave: a thread of blue light that leaves the mask, wavers
 * toward the camera and snaps (`ctx.fx.custom('mask.filament', { from: [x, y, z], seconds })`).
 */
export const filamentEffect = defineViewEffect({
  id: 'mask.filamentEffect',
  channel: 'mask.filament',
  handle(view, payload) {
    const scene = view.scene;
    const cam = scene.activeCamera;
    const from = Array.isArray(payload.from) ? payload.from.map(Number) : null;
    if (!cam || !from || from.length !== 3) return;
    const seconds = Math.max(0.3, Math.min(6, Number(payload.seconds ?? 1.6)));
    const start = new Vector3(from[0], from[1], from[2]);
    const mat = new StandardMaterial('filament', scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(0.45, 0.85, 1);
    const beads: Mesh[] = [];
    const n = 40;
    for (let i = 0; i < n; i++) {
      const m = MeshBuilder.CreateBox('filament_perle', { size: 1 }, scene);
      m.material = mat;
      m.isPickable = false;
      view.addGlow(m);
      beads.push(m);
    }
    let t = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
      t += dt;
      // The thread grows from the mask toward the eyes — it ends low on the right of the view, as if
      // it reached for the face —, wavers, then snaps back. Everything is measured in the camera's
      // frame and scaled by the distance to the eyes, so it looks the same on screen however close
      // the camera is.
      const forward = cam.getDirection(Vector3.Forward());
      const right = cam.getDirection(Vector3.Right());
      const up = cam.getDirection(Vector3.Up());
      const depth = Math.min(0.45, Vector3.Distance(start, cam.position) * 0.5);
      const half = depth * Math.tan(cam.fov / 2);
      const end = cam.position.add(forward.scale(depth)).add(right.scale(half * 0.6)).add(up.scale(-half * 0.55));
      const grow = Math.min(1, t / (seconds * 0.35));
      const fade = t > seconds * 0.8 ? Math.max(0, 1 - (t - seconds * 0.8) / (seconds * 0.2)) : 1;
      for (let i = 0; i < n; i++) {
        const k = (i / (n - 1)) * grow;
        const p = Vector3.Lerp(start, end, k);
        const d = Vector3.Distance(p, cam.position);
        const arc = Math.sin(k * Math.PI);
        p.addInPlace(up.scale((0.08 + Math.sin(k * 14 - t * 9) * 0.05) * arc * d));
        p.addInPlace(right.scale(Math.cos(k * 11 + t * 7) * 0.04 * arc * d));
        beads[i]!.position.copyFrom(p);
        beads[i]!.scaling.setAll(Vector3.Distance(p, cam.position) * 0.008 * fade * (0.75 + 0.35 * Math.sin(t * 20 + i)));
      }
      if (t >= seconds) {
        scene.onBeforeRenderObservable.remove(obs);
        for (const b of beads) b.dispose();
        mat.dispose();
      }
    });
  },
});
