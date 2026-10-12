/**
 * Renders micro-voxel models with hardware instancing: one hidden source mesh per model part and
 * layer, one instance per entity. Each instance gets a brightness factor sampled from the baked
 * voxel light so props darken correctly indoors.
 */
import {
  Color3,
  Color4,
  Material,
  Mesh,
  StandardMaterial,
  TransformNode,
  VertexData,
  type InstancedMesh,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { ModelRegistry } from '../core/voxel/modelRegistry';
import type { BuiltModel, ModelMeshArrays } from '../core/voxel/microModel';

interface SourcePart {
  name: string;
  pivot: [number, number, number];
  meshes: { mesh: Mesh; layer: 'opaque' | 'emissive' | 'transparent'; glow: Color3 }[];
}

interface ModelSource {
  built: BuiltModel;
  parts: SourcePart[];
}

export class ModelInstance {
  readonly root: TransformNode;
  readonly parts = new Map<string, TransformNode>();
  readonly instances: InstancedMesh[] = [];
  private brightness = 1;

  constructor(
    readonly modelId: string,
    readonly built: BuiltModel,
    root: TransformNode,
  ) {
    this.root = root;
  }

  setBrightness(k: number): void {
    if (Math.abs(k - this.brightness) < 0.01) return;
    this.brightness = k;
    for (const inst of this.instances) {
      if (inst.metadata?.layer === 'emissive') continue;
      (inst.instancedBuffers.color as Color4).set(k, k, k, 1);
    }
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
  }

  dispose(shadows: ShadowGenerator | null): void {
    for (const i of this.instances) {
      shadows?.removeShadowCaster(i, false);
      i.dispose();
    }
    for (const p of this.parts.values()) p.dispose();
    this.root.dispose();
  }
}

export class ModelRenderer {
  private sources = new Map<string, ModelSource>();
  private sourceRevision: number;
  readonly opaqueMaterial: StandardMaterial;
  readonly emissiveMaterial: StandardMaterial;
  readonly transparentMaterial: StandardMaterial;
  /** Called for each new emissive instance (glow layer registration). */
  onEmissiveInstance: ((inst: InstancedMesh, color: Color3) => void) | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly models: ModelRegistry,
    private readonly shadows: ShadowGenerator | null,
  ) {
    this.sourceRevision = models.revision;
    this.opaqueMaterial = new StandardMaterial('modèles-opaques', scene);
    this.opaqueMaterial.specularColor = new Color3(0.03, 0.03, 0.03);
    this.emissiveMaterial = new StandardMaterial('modèles-émissifs', scene);
    this.emissiveMaterial.disableLighting = true;
    this.emissiveMaterial.emissiveColor = new Color3(1, 1, 1);
    this.transparentMaterial = new StandardMaterial('modèles-transparents', scene);
    this.transparentMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
    this.transparentMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
  }

  /** Creates an instance of a model under a new root node. Returns null for unknown models. */
  instantiate(modelId: string, name: string): ModelInstance | null {
    if (this.models.revision !== this.sourceRevision) this.invalidate();
    const src = this.source(modelId);
    if (!src) return null;
    const root = new TransformNode(`${name}_modèle`, this.scene);
    const inst = new ModelInstance(modelId, src.built, root);
    for (const part of src.parts) {
      const node = new TransformNode(`${name}_${part.name}`, this.scene);
      node.parent = root;
      node.position.set(part.pivot[0], part.pivot[1], part.pivot[2]);
      inst.parts.set(part.name, node);
      for (const { mesh, layer, glow } of part.meshes) {
        const i = mesh.createInstance(`${name}_${part.name}_${layer}`);
        i.parent = node;
        i.isPickable = false;
        i.metadata = { layer, entityModel: modelId };
        i.instancedBuffers.color = new Color4(1, 1, 1, 1);
        if (layer === 'opaque') this.shadows?.addShadowCaster(i, false);
        if (layer === 'emissive') this.onEmissiveInstance?.(i, glow);
        inst.instances.push(i);
      }
    }
    return inst;
  }

  private source(modelId: string): ModelSource | null {
    let src = this.sources.get(modelId);
    if (src) return src;
    if (!this.models.has(modelId)) return null;
    const built = this.models.build(modelId);
    src = { built, parts: [] };
    for (const p of built.parts) {
      const part: SourcePart = { name: p.name, pivot: p.pivot, meshes: [] };
      const add = (arr: ModelMeshArrays | null, layer: 'opaque' | 'emissive' | 'transparent') => {
        if (!arr) return;
        const mesh = new Mesh(`src_${modelId}_${p.name}_${layer}`, this.scene);
        const vd = new VertexData();
        vd.positions = arr.positions;
        vd.normals = arr.normals;
        vd.colors = arr.colors;
        vd.indices = arr.indices;
        vd.applyToMesh(mesh, false);
        mesh.hasVertexAlpha = layer === 'transparent';
        mesh.material = layer === 'opaque' ? this.opaqueMaterial : layer === 'emissive' ? this.emissiveMaterial : this.transparentMaterial;
        mesh.registerInstancedBuffer('color', 4);
        mesh.instancedBuffers.color = new Color4(1, 1, 1, 1);
        mesh.isVisible = false;
        mesh.isPickable = false;
        mesh.receiveShadows = layer !== 'emissive';
        part.meshes.push({ mesh, layer, glow: averageColor(arr) });
      };
      add(p.opaque, 'opaque');
      add(p.emissive, 'emissive');
      add(p.transparent, 'transparent');
      src.parts.push(part);
    }
    this.sources.set(modelId, src);
    return src;
  }

  /** Model definitions changed (Studio hot reload): rebuild sources on next use. */
  invalidate(): void {
    this.sourceRevision = this.models.revision;
    for (const s of this.sources.values()) for (const p of s.parts) for (const m of p.meshes) m.mesh.dispose();
    this.sources.clear();
  }

  dispose(): void {
    this.invalidate();
    this.opaqueMaterial.dispose();
    this.emissiveMaterial.dispose();
    this.transparentMaterial.dispose();
  }
}

function averageColor(arr: ModelMeshArrays): Color3 {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = arr.vertexCount;
  for (let i = 0; i < n; i++) {
    r += arr.colors[i * 4]!;
    g += arr.colors[i * 4 + 1]!;
    b += arr.colors[i * 4 + 2]!;
  }
  return n ? new Color3(r / n, g / n, b / n) : new Color3(1, 1, 1);
}
