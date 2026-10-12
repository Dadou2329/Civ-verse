/**
 * Voxel materials.
 *
 * StandardMaterial (so sun lighting, shadows and fog keep working) extended by a material plugin
 * that adds the baked voxel light: a per-vertex `voxLight` attribute (rgb = colored block light,
 * a = sky exposure × face shading) multiplied by the scene's ambient sky color. Ambient occlusion
 * arrives through vertex colors.
 */
import {
  Color3,
  Constants,
  MaterialPluginBase,
  RawTexture,
  StandardMaterial,
  type AbstractMesh,
  Material,
  type MaterialDefines,
  type Scene,
  type UniformBuffer,
} from '@babylonjs/core';
import type { AtlasLayout } from '../core/voxel/textures/atlas';

export class VoxelLightPlugin extends MaterialPluginBase {
  /** Ambient sky color × intensity added where sky light reaches. */
  skyColor = new Color3(0.55, 0.6, 0.7);
  /** Multiplier of baked block light (lanterns...). */
  blockScale = 1;
  /** Minimum ambient so that caves are never pitch black. */
  minAmbient = 0.035;

  constructor(material: Material) {
    super(material, 'VoxelLight', 200, { VOXLIGHT: false });
    this._enable(true);
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines['VOXLIGHT'] = true;
  }

  override getClassName(): string {
    return 'VoxelLightPlugin';
  }

  override getAttributes(attributes: string[], _scene: Scene, _mesh: AbstractMesh): void {
    attributes.push('voxLight');
  }

  override getUniforms() {
    return {
      ubo: [
        { name: 'voxSky', size: 3, type: 'vec3' },
        { name: 'voxParams', size: 4, type: 'vec4' },
      ],
      fragment: `#ifdef VOXLIGHT
        uniform vec3 voxSky;
        uniform vec4 voxParams;
      #endif`,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateColor3('voxSky', this.skyColor);
    uniformBuffer.updateFloat4('voxParams', this.blockScale, this.minAmbient, 0, 0);
  }

  override getCustomCode(shaderType: string): { [pointName: string]: string } | null {
    if (shaderType === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `#ifdef VOXLIGHT
          attribute vec4 voxLight;
          varying vec4 vVoxLight;
        #endif`,
        CUSTOM_VERTEX_MAIN_END: `#ifdef VOXLIGHT
          vVoxLight = voxLight;
        #endif`,
      };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef VOXLIGHT
        varying vec4 vVoxLight;
      #endif`,
      CUSTOM_FRAGMENT_BEFORE_FOG: `#ifdef VOXLIGHT
        vec3 voxAmbient = voxSky * vVoxLight.a + vVoxLight.rgb * voxParams.x + vec3(voxParams.y);
        color.rgb += baseColor.rgb * voxAmbient;
      #endif`,
    };
  }
}

export interface VoxelMaterials {
  opaque: StandardMaterial;
  cutout: StandardMaterial;
  translucent: StandardMaterial;
  emissive: StandardMaterial;
  plugins: VoxelLightPlugin[];
  texture: RawTexture;
  dispose(): void;
}

export function createAtlasTexture(scene: Scene, atlas: AtlasLayout): RawTexture {
  const tex = RawTexture.CreateRGBATexture(
    new Uint8Array(atlas.pixels.buffer, atlas.pixels.byteOffset, atlas.pixels.byteLength),
    atlas.width,
    atlas.height,
    scene,
    true,
    false,
    Constants.TEXTURE_NEAREST_LINEAR_MIPLINEAR,
  );
  tex.name = 'atlas-blocs';
  tex.anisotropicFilteringLevel = 4;
  tex.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  tex.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
  tex.hasAlpha = true;
  return tex;
}

export function createVoxelMaterials(scene: Scene, texture: RawTexture): VoxelMaterials {
  const plugins: VoxelLightPlugin[] = [];
  const make = (name: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseTexture = texture;
    m.specularColor = new Color3(0, 0, 0);
    m.ambientColor = new Color3(0, 0, 0);
    m.backFaceCulling = true;
    plugins.push(new VoxelLightPlugin(m));
    return m;
  };
  const opaque = make('voxels-opaques');
  const cutout = make('voxels-découpe');
  // The alpha test runs on the final alpha (explicit transparency mode): it must include the
  // atlas alpha, or the transparent texels of leaves, grilles and plants would be drawn black.
  cutout.useAlphaFromDiffuseTexture = true;
  cutout.transparencyMode = Material.MATERIAL_ALPHATEST;
  cutout.alphaCutOff = 0.5;
  (cutout.diffuseTexture as RawTexture).hasAlpha = true;
  cutout.backFaceCulling = false;
  const translucent = make('voxels-translucides');
  translucent.useAlphaFromDiffuseTexture = true;
  translucent.transparencyMode = Material.MATERIAL_ALPHABLEND;
  translucent.backFaceCulling = false;
  const emissive = new StandardMaterial('voxels-émissifs', scene);
  emissive.diffuseTexture = texture;
  emissive.emissiveTexture = texture;
  emissive.disableLighting = true;
  emissive.specularColor = new Color3(0, 0, 0);
  return {
    opaque,
    cutout,
    translucent,
    emissive,
    plugins,
    texture,
    dispose() {
      for (const m of [opaque, cutout, translucent, emissive]) m.dispose(false, false);
      texture.dispose();
    },
  };
}
