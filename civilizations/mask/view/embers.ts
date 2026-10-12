import { defineViewEffect, Color3, MeshBuilder, StandardMaterial, Vector3, type Mesh } from '@sdk/view';

/**
 * Ember burst of a Braise strike, in front of the camera: glowing chips of ash that fly out and
 * fall. Purely visual (`ctx.fx.custom('mask.embers', { strength })`).
 */
export const embersEffect = defineViewEffect({
  id: 'mask.embersEffect',
  channel: 'mask.embers',
  handle(view, payload) {
    const scene = view.scene;
    const cam = scene.activeCamera;
    if (!cam) return;
    const strength = Math.max(0.1, Math.min(1, Number(payload.strength ?? 1)));
    const forward = cam.getForwardRay(1).direction;
    const origin = cam.position.add(forward.scale(1.1));
    const mat = new StandardMaterial('braise_étincelles', scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(1, 0.45, 0.12);
    const sparks: { mesh: Mesh; v: Vector3; life: number }[] = [];
    const n = Math.round(10 + 16 * strength);
    for (let i = 0; i < n; i++) {
      const m = MeshBuilder.CreateBox('braise', { size: 0.035 + Math.random() * 0.03 }, scene);
      m.material = mat;
      m.isPickable = false;
      m.position.copyFrom(origin);
      view.addGlow(m);
      const spread = new Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4, (Math.random() - 0.5) * 2);
      sparks.push({ mesh: m, v: forward.scale(1.5 + Math.random() * 2.5 * strength).add(spread.scale(1.6 * strength)), life: 0.4 + Math.random() * 0.4 });
    }
    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
      let alive = 0;
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.dispose();
          continue;
        }
        alive++;
        s.v.y -= 9 * dt;
        s.mesh.position.addInPlace(s.v.scale(dt));
        s.mesh.scaling.setAll(Math.max(0.2, s.life * 2));
      }
      if (alive === 0) {
        scene.onBeforeRenderObservable.remove(obs);
        mat.dispose();
      }
    });
  },
});
