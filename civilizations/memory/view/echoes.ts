import { defineViewEffect, Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Mesh, type ViewContext } from '@sdk/view';

/**
 * Rendering of memory echoes: translucent silhouettes walking (sometimes backwards, like a
 * rewound scene) and remembered objects appearing in order. Purely visual: the simulation only
 * sends `ctx.fx.custom('memory.echo', …)`.
 */
interface GhostSpec {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  reverse: boolean;
  height: number;
}
interface ObjectSpec {
  model: string;
  at: [number, number, number];
  t: number;
}

function ghostMesh(view: ViewContext, color: string, height: number): { root: TransformNode; mat: StandardMaterial; legs: Mesh[] } {
  const scene = view.scene;
  const root = new TransformNode('écho_silhouette', scene);
  const mat = new StandardMaterial('écho_silhouette_mat', scene);
  const c = Color3.FromHexString(color);
  mat.emissiveColor = c;
  mat.diffuseColor = c.scale(0.3);
  mat.disableLighting = true;
  mat.alpha = 0;
  const k = height / 1.75;
  const part = (name: string, w: number, h: number, d: number, y: number, x = 0) => {
    const m = MeshBuilder.CreateBox(name, { width: w * k, height: h * k, depth: d * k }, scene);
    m.material = mat;
    m.parent = root;
    m.position.set(x * k, y * k, 0);
    m.isPickable = false;
    view.addGlow(m);
    return m;
  };
  part('tête', 0.42, 0.42, 0.42, 1.55);
  part('torse', 0.5, 0.68, 0.28, 1.0);
  part('bras_g', 0.16, 0.62, 0.16, 1.02, -0.34);
  part('bras_d', 0.16, 0.62, 0.16, 1.02, 0.34);
  const legs = [part('jambe_g', 0.2, 0.66, 0.2, 0.33, -0.12), part('jambe_d', 0.2, 0.66, 0.2, 0.33, 0.12)];
  return { root, mat, legs };
}

export const echoEffect = defineViewEffect({
  id: 'memory.echoEffect',
  channel: 'memory.echo',
  handle(view, payload) {
    const duration = Number(payload.duration ?? 8);
    const ghosts = (payload.ghosts as GhostSpec[] | undefined) ?? [];
    const objects = (payload.objects as ObjectSpec[] | undefined) ?? [];
    const scene = view.scene;
    const made: { update(t: number): void; dispose(): void }[] = [];

    for (const g of ghosts) {
      const { root, mat, legs } = ghostMesh(view, g.color || '#d6b4ff', g.height || 1.75);
      const from = new Vector3(...g.from);
      const to = new Vector3(...g.to);
      const dir = to.subtract(from);
      // A rewound walk faces the other way: the silhouette walks backwards.
      root.rotation.y = Math.atan2(dir.x, dir.z) + (g.reverse ? Math.PI : 0);
      made.push({
        update(t) {
          const k = Math.min(1, t / duration);
          root.position = Vector3.Lerp(from, to, k);
          mat.alpha = 0.55 * Math.min(1, t / 0.6, (duration - t) / 0.8);
          const swing = Math.sin(t * 7) * 0.5;
          legs[0]!.rotation.x = swing;
          legs[1]!.rotation.x = -swing;
        },
        dispose() {
          root.dispose(false, true);
          mat.dispose();
        },
      });
    }
    for (const o of objects) {
      const inst = view.createModel(o.model, 'écho_objet');
      if (!inst) continue;
      inst.root.position.set(o.at[0], o.at[1], o.at[2]);
      inst.root.setEnabled(false);
      made.push({
        update(t) {
          const visible = t >= o.t && t <= duration - 0.3;
          inst.root.setEnabled(visible);
          if (visible) {
            const s = Math.min(1, (t - o.t) / 0.4);
            inst.root.scaling.setAll(s);
            inst.root.rotation.y += 0.02;
            inst.root.position.y = o.at[1] + Math.sin(t * 2) * 0.05;
          }
        },
        dispose() {
          inst.dispose(null);
        },
      });
    }
    let t = 0;
    const obs = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;
      for (const m of made) m.update(t);
      if (t >= duration) {
        scene.onBeforeRenderObservable.remove(obs);
        for (const m of made) m.dispose();
      }
    });
  },
});
