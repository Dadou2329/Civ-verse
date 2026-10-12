/**
 * Babylon rig of a stylized humanoid: bone nodes + one merged mesh per bone, textured with the
 * procedural skin (pixel art, alpha-tested for hair layers and accessories).
 */
import {
  Color3,
  Constants,
  Material,
  Mesh,
  RawTexture,
  StandardMaterial,
  TransformNode,
  VertexData,
  type Scene,
  type ShadowGenerator,
} from '@babylonjs/core';
import type { CharacterDoc } from '../../core/content/schemas';
import { paintCharacter, TEX_SIZE, type BoneName, type BoxPart, type Expression, type FaceName, type SkinResult } from './skin';

const FACE_ORDER: FaceName[] = ['front', 'back', 'right', 'left', 'top', 'bottom'];

/** Corners [TL, TR, BR, BL] as seen from outside each face (see skin.ts for the UV net). */
function corners(face: FaceName, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number[][] {
  switch (face) {
    case 'front':
      return [[x1, y1, z1], [x0, y1, z1], [x0, y0, z1], [x1, y0, z1]];
    case 'back':
      return [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]];
    case 'right':
      return [[x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [x1, y0, z0]];
    case 'left':
      return [[x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [x0, y0, z1]];
    case 'top':
      return [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]];
    case 'bottom':
      return [[x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0]];
  }
}

const NORMALS: Record<FaceName, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
};

function boxesToVertexData(boxes: BoxPart[], scale: number): VertexData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const b of boxes) {
    const [mx, my, mz] = b.min;
    const [sx, sy, sz] = b.size;
    const x0 = mx * scale;
    const y0 = my * scale;
    const z0 = mz * scale;
    const x1 = (mx + sx) * scale;
    const y1 = (my + sy) * scale;
    const z1 = (mz + sz) * scale;
    for (const face of FACE_ORDER) {
      if (b.omit?.includes(face)) continue;
      const r = b.uv[face];
      const base = positions.length / 3;
      const c = corners(face, x0, y0, z0, x1, y1, z1);
      const uvc = [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h],
      ];
      for (let i = 0; i < 4; i++) {
        positions.push(c[i]![0]!, c[i]![1]!, c[i]![2]!);
        normals.push(...NORMALS[face]);
        uvs.push(uvc[i]![0]! / TEX_SIZE, uvc[i]![1]! / TEX_SIZE);
      }
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.indices = indices;
  return vd;
}

export class CharacterRig {
  readonly root: TransformNode;
  readonly bones: Record<BoneName, TransformNode>;
  readonly meshes: Mesh[] = [];
  readonly material: StandardMaterial;
  readonly texture: RawTexture;
  readonly skin: SkinResult;
  readonly scale: number;
  /** Rest positions of bones (for animation offsets). */
  readonly rest: Record<BoneName, [number, number, number]>;
  private expression: Expression = 'neutral';
  private disposed = false;

  constructor(
    scene: Scene,
    readonly doc: CharacterDoc,
    name: string,
    private readonly shadows: ShadowGenerator | null,
  ) {
    this.skin = paintCharacter(doc);
    const layout = this.skin.layout;
    const s = layout.scale;
    this.scale = s;
    this.root = new TransformNode(`${name}_racine`, scene);
    const mk = (bone: BoneName, parent: TransformNode, pivot: [number, number, number]) => {
      const n = new TransformNode(`${name}_${bone}`, scene);
      n.parent = parent;
      n.position.set(pivot[0] * s, pivot[1] * s, pivot[2] * s);
      n.rotationQuaternion = null;
      return n;
    };
    const body = mk('body', this.root, layout.pivots.body);
    this.bones = {
      root: this.root,
      body,
      head: mk('head', body, layout.pivots.head),
      armL: mk('armL', body, layout.pivots.armL),
      armR: mk('armR', body, layout.pivots.armR),
      legL: mk('legL', this.root, layout.pivots.legL),
      legR: mk('legR', this.root, layout.pivots.legR),
    };
    this.rest = {
      root: [0, 0, 0],
      body: [...this.bones.body.position.asArray()] as [number, number, number],
      head: [...this.bones.head.position.asArray()] as [number, number, number],
      armL: [...this.bones.armL.position.asArray()] as [number, number, number],
      armR: [...this.bones.armR.position.asArray()] as [number, number, number],
      legL: [...this.bones.legL.position.asArray()] as [number, number, number],
      legR: [...this.bones.legR.position.asArray()] as [number, number, number],
    };

    this.texture = RawTexture.CreateRGBATexture(this.skin.pixels, TEX_SIZE, TEX_SIZE, scene, true, false, Constants.TEXTURE_NEAREST_NEAREST_MIPLINEAR);
    this.texture.hasAlpha = true;
    this.texture.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
    this.texture.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
    this.material = new StandardMaterial(`${name}_matière`, scene);
    this.material.diffuseTexture = this.texture;
    this.material.specularColor = new Color3(0.04, 0.04, 0.04);
    this.material.transparencyMode = Material.MATERIAL_ALPHATEST;
    this.material.alphaCutOff = 0.5;

    const byBone = new Map<BoneName, BoxPart[]>();
    for (const b of layout.boxes) {
      const list = byBone.get(b.bone) ?? [];
      list.push(b);
      byBone.set(b.bone, list);
    }
    for (const [bone, boxes] of byBone) {
      const mesh = new Mesh(`${name}_${bone}_maillage`, scene);
      boxesToVertexData(boxes, s).applyToMesh(mesh, false);
      mesh.parent = this.bones[bone];
      mesh.material = this.material;
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      shadows?.addShadowCaster(mesh, false);
      this.meshes.push(mesh);
    }
  }

  /** Body part dimensions in model pixels. */
  dims(): SkinResult['layout']['dims'] {
    return this.skin.layout.dims;
  }

  setExpression(expr: Expression): void {
    if (this.disposed || expr === this.expression) return;
    this.expression = expr;
    this.texture.update(this.skin.setExpression(expr));
  }

  get currentExpression(): Expression {
    return this.expression;
  }

  /** Light received at the character's position (from baked voxel light). */
  setLighting(sky: number, block: [number, number, number]): void {
    const k = 0.32 + 0.68 * sky;
    this.material.diffuseColor.set(k, k, k);
    this.material.emissiveColor.set(block[0] * 0.38, block[1] * 0.38, block[2] * 0.38);
  }

  setVisible(v: boolean): void {
    for (const m of this.meshes) m.isVisible = v;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const m of this.meshes) {
      this.shadows?.removeShadowCaster(m, false);
      m.dispose();
    }
    for (const b of Object.values(this.bones)) if (b !== this.root) b.dispose();
    this.root.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
