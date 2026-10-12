/**
 * Built-in world components. They only use the public behavior API (the same as packs).
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';

const ANCHOR_OFFSET = prop.vec3({ label: 'Décalage', default: [0, 0, 0], advanced: true });

export const spawnBehavior = defineBehavior({
  id: 'core.spawn',
  label: 'Point d’apparition',
  category: 'Monde',
  description: 'Position et orientation où le joueur apparaît (référencée par son identifiant d’entité).',
  props: {
    isDefault: prop.boolean({ label: 'Point par défaut de la scène', default: false }),
  },
  create() {},
});

export const markerBehavior = defineBehavior({
  id: 'core.marker',
  label: 'Repère',
  category: 'Monde',
  description: 'Point nommé utilisé par les patrouilles, déplacements scriptés et cinématiques.',
  props: {
    note: prop.string({ label: 'Note (éditeur)' }),
  },
  create() {},
});

export const modelBehavior = defineBehavior({
  id: 'core.model',
  label: 'Modèle 3D',
  category: 'Monde',
  description: 'Affiche un modèle (accessoire, mobilier, machine). La collision est indépendante du visuel.',
  props: {
    model: prop.model({ label: 'Modèle' }),
    collider: prop.enum(
      [
        { value: 'auto', label: 'Automatique (boîte englobante)' },
        { value: 'none', label: 'Aucune' },
        { value: 'custom', label: 'Personnalisée' },
      ],
      { label: 'Collision', default: 'auto' },
    ),
    size: prop.vec3({ label: 'Taille personnalisée (m)', default: [1, 1, 1], advanced: true }),
    offset: ANCHOR_OFFSET,
    solid: prop.boolean({ label: 'Bloque le passage', default: true }),
    castShadow: prop.boolean({ label: 'Projette une ombre', default: true }),
    light: prop.boolean({ label: 'Émet la lumière du modèle', default: true }),
  },
  create(ctx) {
    const apply = () => {
      const p = ctx.props;
      const info = p.model ? ctx.world.modelInfo(p.model) : null;
      if (p.collider === 'none') ctx.entity.setCollider('model', null);
      else if (p.collider === 'custom') {
        const [sx, sy, sz] = p.size;
        const [ox, oy, oz] = p.offset;
        ctx.entity.setCollider('model', { minX: ox - sx / 2, minY: oy, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy, maxZ: oz + sz / 2 }, { solid: p.solid, pickable: true });
      } else if (info) {
        const b = info.bounds;
        ctx.entity.setCollider('model', { minX: b.min[0], minY: b.min[1], minZ: b.min[2], maxX: b.max[0], maxY: b.max[1], maxZ: b.max[2] }, { solid: p.solid, pickable: info.pickable });
      } else ctx.entity.setCollider('model', null);
      ctx.entity.setLights(info?.light && p.light ? [info.light] : []);
    };
    apply();
    return { onPropsChanged: apply };
  },
});

export const colliderBehavior = defineBehavior({
  id: 'core.collider',
  label: 'Collision invisible',
  category: 'Monde',
  description: 'Mur ou volume invisible bloquant le passage (indépendant du décor).',
  props: {
    size: prop.vec3({ label: 'Taille (m)', default: [1, 2, 1] }),
    offset: ANCHOR_OFFSET,
    solid: prop.boolean({ label: 'Bloque le passage', default: true }),
    pickable: prop.boolean({ label: 'Ciblable', default: false }),
  },
  create(ctx) {
    const apply = () => {
      const [sx, sy, sz] = ctx.props.size;
      const [ox, oy, oz] = ctx.props.offset;
      ctx.entity.setCollider('volume', { minX: ox - sx / 2, minY: oy, minZ: oz - sz / 2, maxX: ox + sx / 2, maxY: oy + sy, maxZ: oz + sz / 2 }, { solid: ctx.props.solid, pickable: ctx.props.pickable });
    };
    apply();
    return { onPropsChanged: apply };
  },
});

export const lightBehavior = defineBehavior({
  id: 'core.light',
  label: 'Source de lumière',
  category: 'Monde',
  description: 'Lumière colorée intégrée à l’éclairage voxel (aucun coût au rendu).',
  props: {
    color: prop.color({ label: 'Couleur', default: '#ffb366' }),
    level: prop.integer({ label: 'Intensité (0–15)', default: 12, min: 0, max: 15, slider: true }),
    offset: prop.vec3({ label: 'Décalage', default: [0, 0.5, 0] }),
  },
  create(ctx) {
    const apply = () => ctx.entity.setLights([{ offset: ctx.props.offset, level: ctx.props.level, color: ctx.props.color }]);
    apply();
    return { onPropsChanged: apply };
  },
});

export const soundBehavior = defineBehavior({
  id: 'core.sound',
  label: 'Son ambiant',
  category: 'Audio',
  description: 'Émetteur sonore spatialisé en boucle (fontaine, machine, foule...).',
  props: {
    sound: prop.sound({ label: 'Son' }),
    volume: prop.number({ label: 'Volume', default: 0.6, min: 0, max: 2, step: 0.05 }),
  },
  create(ctx) {
    let handle: { stop(): void } | null = null;
    const start = () => {
      handle?.stop();
      handle = ctx.props.sound && ctx.entity.visible ? ctx.audio.play(ctx.props.sound, { at: ctx.entity.id, loop: true, volume: ctx.props.volume }) : null;
    };
    start();
    return {
      onPropsChanged: start,
      onVisibilityChanged: start,
      dispose: () => handle?.stop(),
    };
  },
});

export const particlesBehavior = defineBehavior({
  id: 'core.particles',
  label: 'Particules',
  category: 'Effets',
  description: 'Effet de particules (poussière, braises, éclats de mémoire...). Purement visuel.',
  props: {
    preset: prop.enum(
      [
        { value: 'dust', label: 'Poussière' },
        { value: 'embers', label: 'Braises' },
        { value: 'motes', label: 'Lucioles' },
        { value: 'smoke', label: 'Fumée' },
        { value: 'sparks', label: 'Étincelles' },
        { value: 'memory', label: 'Éclats de mémoire' },
        { value: 'stars', label: 'Étoiles' },
      ],
      { label: 'Préréglage', default: 'dust' },
    ),
    color: prop.color({ label: 'Couleur', default: '#ffd9a0' }),
    rate: prop.number({ label: 'Densité', default: 1, min: 0, max: 5, step: 0.1 }),
    size: prop.vec3({ label: 'Zone (m)', default: [3, 2, 3] }),
  },
  create() {},
});

export const signBehavior = defineBehavior({
  id: 'core.sign',
  label: 'Panneau / inscription',
  category: 'Monde',
  description: 'Texte lisible affiché dans le monde (enseigne, plaque, affiche).',
  props: {
    text: prop.text({ label: 'Texte', multiline: true }),
    size: prop.vec3({ label: 'Taille (m, l × h × épaisseur)', default: [1, 0.5, 0.05] }),
    color: prop.color({ label: 'Couleur du texte', default: '#2a1d12' }),
    background: prop.color({ label: 'Fond', default: '#d9c39a' }),
    style: prop.enum(
      [
        { value: 'plaque', label: 'Plaque' },
        { value: 'poster', label: 'Affiche' },
        { value: 'carved', label: 'Gravure' },
        { value: 'glow', label: 'Lumineux' },
      ],
      { label: 'Style', default: 'plaque' },
    ),
  },
  create() {},
});
