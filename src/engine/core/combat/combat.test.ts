/**
 * Equipment and combat foundations, headless: hotbar and item in hand, item uses (strike,
 * charged strike, guard, parry, tool on a target), worn items and their abilities, enemies with
 * telegraphed attacks, projectiles reflected by a parry, shockwaves avoided by jumping, defeat and
 * return to the checkpoint, encounters that start over, saves.
 */
import { describe, expect, it } from 'vitest';
import { MemoryContentProvider, type MemoryPack } from '../packs/memoryProvider';
import { definePack } from '../packs/pack';
import { defineAbility, defineMechanic } from '../packs/definitions';
import { VoxelVolume } from '../voxel/volume';
import { fillBox } from '../voxel/construct';
import { volumeToDoc } from '../world/sceneVoxels';
import { advance, createHeadlessGame, flush } from '../testing/headless';
import { parseSave } from '../save/saveFormat';
import { validateCivilization } from '../packs/validate';
import { pitchTowards, yawTowards, type Vec3 } from '../util/math';
import type { GameSession } from '../sim/session';
import type { HealthApi, CombatantApi } from './combat';
import type { EncounterApi } from '../behaviors/combat';

const ENV = {
  sky: { top: '#3366aa', horizon: '#aaccee', bottom: '#556677', stars: 0, sunDisc: true },
  sun: { direction: [-0.4, -1, -0.3], color: '#ffeedd', intensity: 1 },
  ambient: { color: '#8899aa', intensity: 0.6 },
  hemi: { sky: '#aabbcc', ground: '#554433', intensity: 0.5 },
  fog: { color: '#aaccee', density: 0.01 },
  blockLight: 1,
  particles: null,
  music: null,
  ambience: null,
  post: { exposure: 1, contrast: 1, saturation: 1, bloom: 0.3, vignette: 0.3 },
};

const fightSetup = defineMechanic({
  id: 'fight.setup',
  label: 'Combat de test',
  setup(ctx) {
    ctx.combat.enablePlayer({ maxHealth: 100, regenDelay: 4, regenRate: 10, respawnDelay: 2 });
    ctx.equipment.guardSwitch((change) => {
      if (change.to === 'fight:interdit') return { allow: false, reason: 'Trop chaud pour le prendre.' };
      if (change.to === 'fight:masque_outil') return { drawTime: 1.2 };
      return undefined;
    });
  },
});

const elan = defineAbility({ id: 'fight.elan', label: 'Élan', key: 'KeyV', activate: () => true });

function arenaScene() {
  const v = new VoxelVolume(48, 16, 48);
  fillBox(v, [0, 0, 0], [47, 0, 47], 'fight:sol');
  // A pillar to stand on (shockwave test).
  fillBox(v, [40, 1, 40], [41, 1, 41], 'fight:sol');
  return {
    format: 'civverse.scene',
    version: 1,
    id: 'arene',
    name: 'fight.scene',
    environment: ENV,
    voxels: volumeToDoc(v),
    entities: [
      { id: 'depart', position: [8.5, 1, 8.5], components: { 'core.spawn': { isDefault: true } } },
      { id: 'mannequin', position: [8.5, 1, 10.5], components: { 'core.health': { max: 25, faction: 'neutral', onDefeat: 'stay' } } },
      {
        id: 'automate',
        position: [20.5, 1, 20.5],
        components: {
          'core.health': { max: 30 },
          'core.combatant': {
            engageOn: 'manual',
            keepDistance: 1.5,
            attacks: [{ id: 'coup', kind: 'melee', range: 2, windup: 0.6, active: 0.2, recover: 0.8, cooldown: 1.2, damage: 15, knockback: 0 }],
          },
        },
      },
      {
        id: 'tireur',
        position: [30.5, 1, 8.5],
        components: {
          'core.health': { max: 20 },
          'core.combatant': {
            engageOn: 'manual',
            speed: 0,
            keepDistance: 8,
            attacks: [{ id: 'tir', kind: 'projectile', range: 14, windup: 0.5, active: 0.1, recover: 1, cooldown: 3, damage: 10, speed: 14, knockback: 0 }],
          },
        },
      },
      { id: 'pompe', position: [6.5, 1, 8.5], components: { 'core.toolTarget': { tool: 'cle', holdSeconds: 1, label: 'fight.repair', onUse: [{ type: 'core.setVar', var: 'fight.repaired', value: true }] } } },
      { id: 'arene_auto', position: [20.5, 1, 18.5], components: { 'core.encounter': { startOn: 'manual', waves: [{ enemies: ['automate'], delay: 0 }] } } },
      { id: 'repere', position: [12.5, 1, 12.5], rotation: [0, 90, 0], components: { 'core.checkpoint': { size: [2, 3, 2] } } },
    ],
  };
}

const items = [
  {
    id: 'fight:baton',
    name: 'fight.item.baton',
    description: 'fight.item.desc',
    icon: { shape: 'key', color: '#aa7744' },
    category: 'equipment',
    held: {
      primary: { type: 'core.melee', damage: 10, charge: { seconds: 0.8, damage: 30, knockback: 0 }, knockback: 0 },
      secondary: { type: 'core.guard' },
    },
  },
  {
    id: 'fight:bouclier',
    name: 'fight.item.bouclier',
    description: 'fight.item.desc',
    icon: { shape: 'circle', color: '#8899aa' },
    category: 'equipment',
    held: { secondary: { type: 'core.guard', reflect: true } },
  },
  {
    id: 'fight:cle',
    name: 'fight.item.cle',
    description: 'fight.item.desc',
    icon: { shape: 'key', color: '#ccaa44' },
    category: 'tool',
    held: { primary: { type: 'core.useOnTarget', tool: 'cle' } },
  },
  { id: 'fight:interdit', name: 'fight.item.interdit', description: 'fight.item.desc', icon: { shape: 'gem', color: '#ff0000' }, category: 'misc', held: {} },
  { id: 'fight:masque_outil', name: 'fight.item.masqueOutil', description: 'fight.item.desc', icon: { shape: 'gem', color: '#44ccff' }, category: 'equipment', held: {} },
  { id: 'fight:masque', name: 'fight.item.masque', description: 'fight.item.desc', icon: { shape: 'ring', color: '#ffffff' }, category: 'equipment', slot: 'masque', grants: ['fight.elan'] },
];

function fightPack(): MemoryPack {
  return {
    manifest: {
      format: 'civverse.pack',
      version: 1,
      id: 'fight',
      kind: 'civilization',
      name: 'fight.name',
      description: 'fight.description',
      packVersion: '1.0.0',
      engineApi: '^1.0.0',
      entry: { scene: 'arene', spawn: 'depart' },
      scenes: ['arene'],
      stateVersion: 1,
    },
    module: definePack({
      modules: {
        './mechanics/blocks.ts': { blocks: [{ __kind: 'block', id: 'fight:sol', label: 'Sol', textures: { all: { gen: 'stone', colors: ['#777777'] } } }] },
        './mechanics/fight.ts': { fightSetup, elan },
      },
    }),
    files: {
      'content/scenes/arene.scene.json': arenaScene(),
      'content/items.json': { format: 'civverse.items', version: 1, items },
      'locales/fr-FR.json': {
        'fight.name': 'Combat',
        'fight.description': 'Civilisation de test du combat.',
        'fight.scene': 'L’arène',
        'fight.repair': 'Réparer la pompe',
        'fight.item.baton': 'Bâton',
        'fight.item.bouclier': 'Bouclier',
        'fight.item.cle': 'Clé d’atelier',
        'fight.item.interdit': 'Braise vive',
        'fight.item.masqueOutil': 'Outil de masque',
        'fight.item.masque': 'Masque',
        'fight.item.desc': 'Un objet de test.',
      },
    },
  };
}

async function start(): Promise<GameSession> {
  const { session } = await createHeadlessGame(new MemoryContentProvider({ fight: fightPack() }));
  await session.loadCivilization('fight', { fresh: true });
  return session;
}

function aimAt(session: GameSession, p: Vec3): void {
  const eye = session.player.eye;
  session.player.setLook(yawTowards(eye, p), pitchTowards(eye, p));
}

function health(session: GameSession, id: string): HealthApi {
  return session.combat.healthOf(id)!;
}

function events(session: GameSession, names: string[]): { name: string; payload: Record<string, unknown> }[] {
  const out: { name: string; payload: Record<string, unknown> }[] = [];
  session.bus.onAny((name, payload) => {
    if (names.includes(name)) out.push({ name, payload: payload as Record<string, unknown> });
  });
  return out;
}

/** Advances in small steps until `done` (or fails after `max` seconds). */
async function until(session: GameSession, done: () => boolean, max = 5): Promise<void> {
  for (let t = 0; t < max; t += 1 / 60) {
    if (done()) return;
    await advance(session, 1 / 60, 1 / 60);
  }
  throw new Error('Condition jamais atteinte.');
}

describe('équipement : barre d’objets et objet en main', () => {
  it('range les objets tenables dans la barre, les prend en main et attend le geste de sortie', async () => {
    const session = await start();
    const seen = events(session, ['item.held']);
    expect(session.combat.enabled).toBe(true);
    session.civ!.ctx.inventory.add('fight:baton', 1, { silent: true });
    session.civ!.ctx.inventory.add('fight:cle', 1, { silent: true });
    session.civ!.ctx.inventory.add('fight:masque', 1, { silent: true });
    expect(session.equipment.hotbar.slice(0, 3)).toEqual(['fight:baton', 'fight:cle', null]);
    expect(session.equipment.held).toBe('fight:baton');
    expect(seen.map((e) => e.payload.itemId)).toEqual(['fight:baton']);
    // Not usable while it is being drawn.
    expect(session.equipment.press('primary')).toBe(false);
    await advance(session, 0.35);
    expect(session.equipment.ready('primary')).toBe(true);
    // Number keys and the wheel.
    expect(session.equipment.select(1)).toBe(true);
    expect(session.equipment.held).toBe('fight:cle');
    expect(session.equipment.cycle(1)).toBe(true);
    expect(session.equipment.held).toBe('fight:baton');
    // Losing the item in hand empties the hand.
    session.civ!.ctx.inventory.remove('fight:baton', 1, { silent: true });
    expect(session.equipment.held).toBe(null);
    expect(session.equipment.hotbar[0]).toBe(null);
  });

  it('applique les règles de changement de la civilisation (refus, accordage)', async () => {
    const session = await start();
    const ctx = session.civ!.ctx;
    ctx.inventory.add('fight:baton', 1, { silent: true });
    ctx.inventory.add('fight:interdit', 1, { silent: true });
    ctx.inventory.add('fight:masque_outil', 1, { silent: true });
    await advance(session, 0.4);
    expect(ctx.equipment.hold('fight:interdit')).toBe(false);
    expect(session.equipment.held).toBe('fight:baton');
    expect(ctx.equipment.hold('fight:masque_outil')).toBe(true);
    expect(ctx.equipment.drawRemaining).toBeCloseTo(1.2, 5);
    await advance(session, 0.6);
    expect(ctx.equipment.ready()).toBe(false);
    await advance(session, 0.7);
    expect(ctx.equipment.drawRemaining).toBe(0);
  });

  it('porte un objet dans son emplacement et accorde ses capacités tant qu’il est porté', async () => {
    const session = await start();
    const ctx = session.civ!.ctx;
    ctx.inventory.add('fight:masque', 1, { silent: true });
    expect(ctx.player.abilities.has('fight.elan')).toBe(false);
    expect(ctx.equipment.equip('fight:masque')).toBe(true);
    expect(ctx.equipment.worn('masque')).toBe('fight:masque');
    expect(ctx.player.abilities.has('fight.elan')).toBe(true);
    // An ability only granted by an item is not saved as owned.
    expect(session.snapshotCivState().player.abilities).not.toContain('fight.elan');
    ctx.equipment.unequip('masque');
    expect(ctx.player.abilities.has('fight.elan')).toBe(false);
    // Granted by the story, it stays when the item is removed.
    ctx.equipment.equip('fight:masque');
    ctx.player.abilities.grant('fight.elan');
    ctx.equipment.unequip('masque');
    expect(ctx.player.abilities.has('fight.elan')).toBe(true);
  });
});

describe('combat : coups du joueur', () => {
  it('frappe ce qui est devant, respecte le délai entre deux coups et charge un coup puissant', async () => {
    const session = await start();
    const seen = events(session, ['combat.hit', 'combat.defeated']);
    session.civ!.ctx.inventory.add('fight:baton', 1, { silent: true });
    await advance(session, 0.35);
    aimAt(session, { x: 8.5, y: 2, z: 10.5 });
    expect(session.equipment.press('primary')).toBe(true);
    session.equipment.release('primary');
    expect(health(session, 'mannequin').health).toBe(15);
    expect(session.equipment.press('primary')).toBe(false);
    await advance(session, 0.5);
    // Charged strike: hold past the charge time, then release.
    expect(session.equipment.press('primary')).toBe(true);
    expect(health(session, 'mannequin').health).toBe(5);
    await advance(session, 0.9);
    expect(session.equipment.progress?.value).toBe(1);
    session.equipment.release('primary');
    expect(health(session, 'mannequin').defeated).toBe(true);
    expect(seen.filter((e) => e.name === 'combat.hit').map((e) => e.payload.outcome)).toEqual(['hit', 'hit', 'defeated']);
    expect(seen.some((e) => e.name === 'combat.defeated' && e.payload.entityId === 'mannequin')).toBe(true);
  });

  it('ne frappe pas ce qui est derrière le joueur', async () => {
    const session = await start();
    session.civ!.ctx.inventory.add('fight:baton', 1, { silent: true });
    await advance(session, 0.35);
    aimAt(session, { x: 8.5, y: 2, z: 2 });
    session.equipment.press('primary');
    session.equipment.release('primary');
    expect(health(session, 'mannequin').health).toBe(25);
  });

  it('répare une cible en maintenant le clic avec le bon outil', async () => {
    const session = await start();
    const seen = events(session, ['tool.used']);
    session.civ!.ctx.inventory.add('fight:cle', 1, { silent: true });
    await advance(session, 0.35);
    aimAt(session, { x: 6.5, y: 1.5, z: 8.5 });
    await advance(session, 1 / 30);
    expect(session.equipment.hints.primary).toBe('Réparer la pompe');
    expect(session.equipment.press('primary')).toBe(true);
    await advance(session, 0.5);
    expect(session.equipment.progress?.label).toBe('Réparer la pompe');
    expect(session.vars.get('fight.repaired')).toBeUndefined();
    await advance(session, 0.6);
    expect(session.vars.get('fight.repaired')).toBe(true);
    expect(seen).toHaveLength(1);
    session.equipment.release('primary');
    expect(session.equipment.progress).toBe(null);
    // Done once: nothing left to repair.
    await advance(session, 0.3);
    expect(session.equipment.hints.primary).toBe(null);
  });
});

describe('combat : adversaires, garde et parade', () => {
  async function facingAutomate(session: GameSession): Promise<void> {
    session.civ!.ctx.inventory.add('fight:baton', 1, { silent: true });
    session.player.teleport({ x: 20.5, y: 1, z: 18.8 });
    aimAt(session, { x: 20.5, y: 2.2, z: 20.5 });
    await advance(session, 0.35);
    (session.world!.entities.get('arene_auto')!.components.get('core.encounter')!.instance!.api as EncounterApi).start();
  }

  const automate = (session: GameSession) => session.combat.combatantOf('automate')!;
  const telegraph = (session: GameSession) => session.world!.entities.get('automate')!.view.flags.telegraph as { progress: number } | undefined;

  it('prépare son coup de façon visible puis frappe le joueur sans garde', async () => {
    const session = await start();
    await facingAutomate(session);
    await until(session, () => automate(session).state === 'windup');
    expect(telegraph(session)).toBeDefined();
    await until(session, () => automate(session).state !== 'windup');
    await advance(session, 0.05);
    expect(session.combat.player.health).toBe(85);
  });

  it('bloque une partie des dégâts avec la garde levée tôt', async () => {
    const session = await start();
    await facingAutomate(session);
    await until(session, () => automate(session).state === 'windup');
    expect(session.equipment.press('secondary')).toBe(true);
    await until(session, () => automate(session).state !== 'windup');
    await advance(session, 0.05);
    expect(session.combat.player.health).toBeCloseTo(97, 5);
  });

  it('pare un coup au dernier moment : aucun dégât, l’adversaire vacille et la riposte double les dégâts', async () => {
    const session = await start();
    const seen = events(session, ['combat.parried']);
    await facingAutomate(session);
    await until(session, () => (telegraph(session)?.progress ?? 0) > 0.85);
    session.equipment.press('secondary');
    await until(session, () => automate(session).state === 'stagger', 0.5);
    expect(session.combat.player.health).toBe(100);
    expect(seen).toHaveLength(1);
    session.equipment.release('secondary');
    // Riposte: the next strike hits twice as hard.
    await advance(session, 0.2);
    aimAt(session, { x: 20.5, y: 2.2, z: 20.5 });
    expect(session.equipment.press('primary')).toBe(true);
    session.equipment.release('primary');
    expect(health(session, 'automate').health).toBe(10);
  });

  it('renvoie un projectile paré avec un bouclier qui réfléchit', async () => {
    const session = await start();
    const seen = events(session, ['combat.reflected', 'combat.hit']);
    session.civ!.ctx.inventory.add('fight:bouclier', 1, { silent: true });
    session.player.teleport({ x: 30.5, y: 1, z: 1.5 });
    aimAt(session, { x: 30.5, y: 2, z: 8.5 });
    await advance(session, 0.35);
    session.combat.combatantOf('tireur')!.engage();
    await until(session, () => session.combat.projectiles.length > 0, 3);
    await until(session, () => {
      const p = session.combat.projectiles[0];
      return !!p && Math.hypot(p.position.x - 30.5, p.position.z - 1.5) < 2.2;
    }, 2);
    session.equipment.press('secondary');
    await until(session, () => seen.some((e) => e.name === 'combat.hit'), 2);
    expect(seen.some((e) => e.name === 'combat.reflected')).toBe(true);
    expect(session.combat.player.health).toBe(100);
    expect(health(session, 'tireur').health).toBe(10);
  });

  it('une onde de choc touche le joueur au sol mais pas celui qui est au-dessus', async () => {
    const session = await start();
    session.player.teleport({ x: 30.5, y: 1, z: 30.5 });
    await advance(session, 0.1);
    session.combat.spawnWave({ center: { x: 27.5, y: 1, z: 30.5 }, speed: 8, maxRadius: 6, damage: 20, knockback: 0 });
    await advance(session, 0.8);
    expect(session.combat.player.health).toBe(80);
    session.player.teleport({ x: 40.9, y: 2, z: 40.9 });
    await advance(session, 0.6);
    session.combat.spawnWave({ center: { x: 37.5, y: 1, z: 40.9 }, speed: 8, maxRadius: 6, damage: 20, knockback: 0 });
    await advance(session, 0.8);
    expect(session.combat.player.health).toBe(80);
  });
});

describe('combat : défaite, point de reprise et sauvegarde', () => {
  it('se relève au point de reprise, la rencontre recommence et l’adversaire est relevé', async () => {
    const session = await start();
    const seen = events(session, ['combat.playerDefeated', 'combat.playerRespawned', 'combat.encounterReset']);
    // Cross the checkpoint first.
    session.player.teleport({ x: 12.5, y: 1, z: 12.5 });
    await advance(session, 0.1);
    session.player.teleport({ x: 20.5, y: 1, z: 18.8 });
    aimAt(session, { x: 20.5, y: 2.2, z: 20.5 });
    const enc = session.world!.entities.get('arene_auto')!.components.get('core.encounter')!.instance!.api as EncounterApi;
    enc.start();
    await advance(session, 0.2);
    session.combat.damage('automate', { amount: 12, source: 'player' });
    session.combat.damagePlayer({ amount: 500, unblockable: true });
    expect(session.combat.player.defeated).toBe(true);
    expect(session.player.movementLocked).toBe(true);
    await advance(session, 2.2);
    expect(session.combat.player.defeated).toBe(false);
    expect(session.combat.player.health).toBe(100);
    expect(session.player.position.x).toBeCloseTo(12.5, 1);
    expect(session.player.position.z).toBeCloseTo(12.5, 1);
    expect(new Set(seen.map((e) => e.name))).toEqual(new Set(['combat.playerDefeated', 'combat.encounterReset', 'combat.playerRespawned']));
    expect(enc.status).toBe('idle');
    expect(health(session, 'automate').health).toBe(30);
    expect((session.combat.combatantOf('automate') as CombatantApi).state).toBe('idle');
  });

  it('sauvegarde la barre d’objets, l’objet en main, les objets portés et la vie', async () => {
    const session = await start();
    const ctx = session.civ!.ctx;
    ctx.inventory.add('fight:baton', 1, { silent: true });
    ctx.inventory.add('fight:cle', 1, { silent: true });
    ctx.inventory.add('fight:masque', 1, { silent: true });
    ctx.equipment.equip('fight:masque');
    ctx.equipment.select(1);
    session.combat.damagePlayer({ amount: 30, unblockable: true });
    const save = parseSave(JSON.parse(JSON.stringify(session.buildSaveGame('test', 'Test')))).save;
    await session.applySaveGame(save);
    await session.loadCivilization('fight');
    await flush();
    expect(session.equipment.hotbar.slice(0, 2)).toEqual(['fight:baton', 'fight:cle']);
    expect(session.equipment.held).toBe('fight:cle');
    expect(session.equipment.wornIn('masque')).toBe('fight:masque');
    expect(session.player.abilities.has('fight.elan')).toBe(true);
    expect(session.combat.player.health).toBe(70);
  });

  it('valide la civilisation de test sans erreur', async () => {
    const { session } = await createHeadlessGame(new MemoryContentProvider({ fight: fightPack() }));
    const report = await validateCivilization(session, 'fight');
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
