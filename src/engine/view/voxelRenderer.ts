/**
 * Renders a SceneWorld's voxels as chunked meshes (one mesh per chunk and render layer).
 * Edits and light updates mark chunks dirty; dirty chunks are rebuilt within a per-frame budget.
 */
import { Mesh, VertexData, type Scene, type Light, type ShadowGenerator } from '@babylonjs/core';
import type { SceneWorld } from '../core/world/sceneWorld';
import { BlockRegistry } from '../core/voxel/blocks';
import { buildAtlas, type AtlasLayout } from '../core/voxel/textures/atlas';
import { CHUNK_SIZE, chunkCounts, meshChunk, type MeshArrays, type MesherContext } from '../core/voxel/mesher';
import type { Box3i } from '../core/voxel/volume';
import { createAtlasTexture, createVoxelMaterials, type VoxelMaterials } from './voxelMaterial';
import type { AtlasTile } from '../core/voxel/textures/atlas';

type LayerName = 'opaque' | 'cutout' | 'translucent' | 'emissive';
const LAYERS: LayerName[] = ['opaque', 'cutout', 'translucent', 'emissive'];

export interface VoxelRendererOptions {
  shadows?: ShadowGenerator | null;
  /** Lights that must not affect voxels (their ambient comes from baked light). */
  excludeFromLights?: Light[];
  /** Milliseconds per frame allowed for re-meshing. */
  budgetMs?: number;
  /** Called for every emissive chunk mesh (glow layer registration). */
  onEmissiveMesh?: (mesh: Mesh) => void;
}

export class VoxelRenderer {
  readonly atlas: AtlasLayout;
  readonly materials: VoxelMaterials;
  private chunks = new Map<string, Mesh[]>();
  private dirty = new Set<string>();
  private ctx: MesherContext;
  private unsub: () => void;
  private shadows: ShadowGenerator | null;
  private excluded: Light[];
  private budget: number;
  private atlasRevision: number;
  private onEmissiveMesh: ((mesh: Mesh) => void) | null;
  /** Total vertices currently rendered (diagnostics). */
  vertexCount = 0;

  constructor(
    private readonly scene: Scene,
    private readonly world: SceneWorld,
    private readonly blocks: BlockRegistry,
    opts: VoxelRendererOptions = {},
  ) {
    this.shadows = opts.shadows ?? null;
    this.excluded = opts.excludeFromLights ?? [];
    this.budget = opts.budgetMs ?? 6;
    this.onEmissiveMesh = opts.onEmissiveMesh ?? null;
    this.atlas = buildAtlasFor(blocks);
    this.atlasRevision = blocks.revision;
    this.materials = createVoxelMaterials(scene, createAtlasTexture(scene, this.atlas));
    this.ctx = { volume: world.volume, info: world.paletteInfo(), atlas: this.atlas, light: world.light };
    this.unsub = world.onVoxelsChanged((box) => this.markBox(box, 1));
  }

  get chunkCount(): number {
    return this.chunks.size;
  }

  get pendingChunks(): number {
    return this.dirty.size;
  }

  /** Builds every chunk synchronously (scene load). */
  buildAll(): number {
    const t0 = performance.now();
    const [cx, cy, cz] = chunkCounts(this.world.volume);
    for (let y = 0; y < cy; y++) for (let z = 0; z < cz; z++) for (let x = 0; x < cx; x++) this.rebuild(x, y, z);
    this.dirty.clear();
    return performance.now() - t0;
  }

  /** Marks chunks overlapping a cell box (plus a margin for faces/AO of neighbors). */
  markBox(box: Box3i, margin = 1): void {
    const [cx, cy, cz] = chunkCounts(this.world.volume);
    const c0 = box.min.map((v) => Math.max(0, Math.floor((v - margin) / CHUNK_SIZE)));
    const c1 = box.max.map((v, i) => Math.min([cx, cy, cz][i]! - 1, Math.floor((v + margin) / CHUNK_SIZE)));
    for (let y = c0[1]!; y <= c1[1]!; y++) for (let z = c0[2]!; z <= c1[2]!; z++) for (let x = c0[0]!; x <= c1[0]!; x++) this.dirty.add(`${x},${y},${z}`);
  }

  /** Rebuilds dirty chunks within the frame budget. Returns the number rebuilt. */
  update(): number {
    if (this.blocks.revision !== this.atlasRevision) this.reloadAtlas();
    if (this.dirty.size === 0) return 0;
    const t0 = performance.now();
    let n = 0;
    for (const key of this.dirty) {
      this.dirty.delete(key);
      const [x, y, z] = key.split(',').map(Number) as [number, number, number];
      this.rebuild(x, y, z);
      n++;
      if (performance.now() - t0 > this.budget) break;
    }
    return n;
  }

  /** Applies scene environment values to the voxel materials. */
  setAmbient(r: number, g: number, b: number, blockScale: number): void {
    for (const p of this.materials.plugins) {
      p.skyColor.set(r, g, b);
      p.blockScale = blockScale;
    }
  }

  opaqueMeshes(): Mesh[] {
    const out: Mesh[] = [];
    for (const list of this.chunks.values()) for (const m of list) if (m.metadata?.layer === 'opaque' || m.metadata?.layer === 'cutout') out.push(m);
    return out;
  }

  private reloadAtlas(): void {
    // A pack registered new blocks (Studio hot reload): rebuild textures and every chunk.
    this.atlasRevision = this.blocks.revision;
    const atlas = buildAtlasFor(this.blocks);
    (this as { atlas: AtlasLayout }).atlas = atlas;
    const tex = createAtlasTexture(this.scene, atlas);
    const old = this.materials.texture;
    for (const m of [this.materials.opaque, this.materials.cutout, this.materials.translucent]) m.diffuseTexture = tex;
    this.materials.emissive.diffuseTexture = tex;
    this.materials.emissive.emissiveTexture = tex;
    (this.materials as { texture: typeof tex }).texture = tex;
    old.dispose();
    this.ctx = { volume: this.world.volume, info: this.world.paletteInfo(), atlas, light: this.world.light };
    for (const key of this.chunks.keys()) this.dirty.add(key);
    this.markBox({ min: [0, 0, 0], max: [this.world.volume.sizeX, this.world.volume.sizeY, this.world.volume.sizeZ] }, 0);
  }

  private rebuild(cx: number, cy: number, cz: number): void {
    const key = `${cx},${cy},${cz}`;
    this.disposeChunk(key);
    const info = this.world.paletteInfo();
    if (info !== this.ctx.info) this.ctx = { ...this.ctx, info, tileCache: [] as (AtlasTile | null)[] };
    const result = meshChunk(this.ctx, cx, cy, cz);
    const meshes: Mesh[] = [];
    for (const layer of LAYERS) {
      const arr = result.layers[layer];
      if (!arr) continue;
      meshes.push(this.createMesh(`chunk_${key}_${layer}`, arr, layer));
    }
    if (meshes.length) this.chunks.set(key, meshes);
  }

  private createMesh(name: string, arr: MeshArrays, layer: LayerName): Mesh {
    const mesh = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = arr.positions;
    vd.normals = arr.normals;
    vd.uvs = arr.uvs;
    vd.colors = arr.colors;
    vd.indices = arr.indices;
    vd.applyToMesh(mesh, false);
    mesh.setVerticesData('voxLight', arr.light, false, 4);
    mesh.hasVertexAlpha = false;
    mesh.material = this.materials[layer];
    mesh.isPickable = false;
    mesh.metadata = { layer, voxel: true };
    mesh.receiveShadows = layer !== 'emissive';
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    if (layer === 'translucent') mesh.alphaIndex = 10;
    for (const l of this.excluded) l.excludedMeshes.push(mesh);
    if (this.shadows && (layer === 'opaque' || layer === 'cutout')) this.shadows.addShadowCaster(mesh, false);
    if (layer === 'emissive') this.onEmissiveMesh?.(mesh);
    this.vertexCount += arr.vertexCount;
    return mesh;
  }

  private disposeChunk(key: string): void {
    const list = this.chunks.get(key);
    if (!list) return;
    for (const m of list) {
      this.vertexCount -= m.getTotalVertices();
      if (this.shadows) this.shadows.removeShadowCaster(m, false);
      for (const l of this.excluded) {
        const i = l.excludedMeshes.indexOf(m);
        if (i >= 0) l.excludedMeshes.splice(i, 1);
      }
      m.dispose(false, false);
    }
    this.chunks.delete(key);
  }

  dispose(): void {
    this.unsub();
    for (const key of [...this.chunks.keys()]) this.disposeChunk(key);
    this.materials.dispose();
  }
}

function buildAtlasFor(blocks: BlockRegistry): AtlasLayout {
  const specs = blocks.all().flatMap((d) => [0, 1, 2, 3, 4, 5].map((f) => BlockRegistry.faceTexture(d, f)));
  return buildAtlas(specs);
}
