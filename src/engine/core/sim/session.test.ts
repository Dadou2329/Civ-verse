import { describe, expect, it } from 'vitest';
import { MemoryContentProvider, type MemoryPack } from '../packs/memoryProvider';
import { definePack } from '../packs/pack';
import { defineBehavior, defineCondition, defineMechanic } from '../packs/definitions';
import { prop } from '../props/props';
import { VoxelVolume } from '../voxel/volume';
import { fillBox } from '../voxel/construct';
import { volumeToDoc } from '../world/sceneVoxels';
import { createHeadlessGame, advance, flush, skipCinematics, talk, walkTo } from '../testing/headless';
import { parseSave } from '../save/saveFormat';
import type { SceneDoc } from '../content/schemas';

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

function blocksModule(prefix: string) {
  return {
    [`./mechanics/blocks.ts`]: {
      blocks: [
        { __kind: 'block', id: `${prefix}:ground`, label: 'Sol', textures: { all: { gen: 'stone', colors: ['#777777'] } } },
        { __kind: 'block', id: `${prefix}:wall`, label: 'Mur', textures: { all: { gen: 'bricks', colors: ['#995533'] } } },
      ],
    },
  };
}

function villageScene(): SceneDoc {
  const v = new VoxelVolume(32, 16, 32);
  fillBox(v, [0, 0, 0], [31, 0, 31], 'testciv:ground');
  fillBox(v, [0, 1, 20], [31, 4, 20], 'testciv:wall');
  v.set(15, 1, 20, null);
  v.set(15, 2, 20, null);
  return {
    format: 'civverse.scene',
    version: 1,
    id: 'village',
    name: 'testciv.scene.village',
    environment: ENV as never,
    voxels: volumeToDoc(v),
    entities: [
      { id: 'start', position: [10.5, 1, 10.5], components: { 'core.spawn': { isDefault: true } } },
      {
        id: 'mira',
        position: [12.5, 1, 12.5],
        components: { 'core.npc': { name: 'testciv.npc.mira', dialogue: 'mira_talk' } },
      },
      {
        id: 'gate_door',
        position: [15.5, 1, 20.5],
        components: { 'core.door': { model: '' }, 'testciv.lock': { requiredVar: 'testciv.canOpen' } },
      },
      { id: 'key_pickup', position: [8.5, 1, 12.5], components: { 'core.pickup': { item: 'testciv:key' } } },
      { id: 'gate_trigger', position: [15.5, 1, 25.5], components: { 'core.trigger': { size: [3, 3, 3] } } },
    ],
  };
}

const lockBehavior = defineBehavior({
  id: 'testciv.lock',
  label: 'Serrure de test',
  props: { requiredVar: prop.variable({ label: 'Variable requise' }) },
  create(ctx) {
    const open = () => !!ctx.vars.get(ctx.props.requiredVar);
    return {
      beforeInteract: (attempt) => (attempt.offer.id === 'open' && !open() ? { reason: ctx.t('testciv.locked') } : null),
      decorateOffer: (offer) => (open() ? offer : { ...offer, detail: ctx.t('testciv.locked'), tone: 'locked' }),
    };
  },
});

const counterMechanic = defineMechanic({
  id: 'testciv.counter',
  label: 'Compteur de test',
  state: { version: 1, initial: () => ({ ticks: 0, doors: 0 }) },
  setup(ctx, state) {
    ctx.time.every(1, () => {
      state.ticks++;
    });
    ctx.events.on('door.opened', () => {
      state.doors++;
    });
    return {
      get ticks() {
        return state.ticks;
      },
    };
  },
});

const hasMetMira = defineCondition({
  id: 'testciv.metMira',
  label: 'A rencontré Mira',
  props: {},
  test: (ctx) => !!ctx.vars.get('testciv.metMira'),
});

function testPack(): MemoryPack {
  return {
    manifest: {
      format: 'civverse.pack',
      version: 1,
      id: 'testciv',
      kind: 'civilization',
      name: 'testciv.name',
      description: 'testciv.description',
      packVersion: '1.0.0',
      engineApi: '^1.0.0',
      entry: { scene: 'village', spawn: 'start' },
      scenes: ['village'],
      stateVersion: 1,
      globalWrites: ['fragments.test', 'flags.testciv.*'],
      fragments: [{ id: 'test', name: 'testciv.fragment', hint: 'testciv.fragment.hint' }],
    },
    module: definePack({
      modules: { ...blocksModule('testciv'), './mechanics/main.ts': { lockBehavior, counterMechanic, hasMetMira } },
    }),
    files: {
      'content/scenes/village.scene.json': villageScene(),
      'content/items.json': {
        format: 'civverse.items',
        version: 1,
        items: [{ id: 'testciv:key', name: 'testciv.item.key', description: 'testciv.item.key.desc', icon: { shape: 'key', color: '#ccaa44' }, category: 'key' }],
      },
      'content/dialogues/mira_talk.dialogue.json': {
        format: 'civverse.dialogue',
        version: 1,
        id: 'mira_talk',
        start: 'route',
        nodes: [
          { id: 'route', text: '', branches: [{ condition: { type: 'testciv.metMira' }, next: 'again' }], next: 'hello' },
          {
            id: 'hello',
            speaker: 'mira',
            text: 'testciv.dlg.hello',
            actions: [{ type: 'core.setVar', var: 'testciv.metMira', value: true }],
            choices: [
              { id: 'ask_key', text: 'testciv.dlg.askKey', next: 'key' },
              { id: 'bye', text: 'testciv.dlg.bye', next: null },
            ],
          },
          {
            id: 'key',
            speaker: 'mira',
            text: 'testciv.dlg.key',
            actions: [
              { type: 'core.setVar', var: 'testciv.canOpen', value: true },
              { type: 'core.completeObjective', quest: 'Q1', objective: 'talk' },
            ],
            end: true,
          },
          { id: 'again', speaker: 'mira', text: 'testciv.dlg.again', end: true },
        ],
      },
      'content/quests/Q1.quest.json': {
        format: 'civverse.quest',
        version: 1,
        id: 'Q1',
        title: 'testciv.q1.title',
        summary: 'testciv.q1.summary',
        autoStart: true,
        stages: [
          { id: 's1', description: 'testciv.q1.s1', objectives: [{ id: 'talk', text: 'testciv.q1.talk', target: 'mira' }] },
          {
            id: 's2',
            description: 'testciv.q1.s2',
            objectives: [{ id: 'through', text: 'testciv.q1.through', completeOn: { event: 'trigger.entered', where: { triggerId: 'gate_trigger' } } }],
            onComplete: [{ type: 'core.grantFragment', fragment: 'test' }],
          },
        ],
      },
      'content/cinematics/intro.cinematic.json': {
        format: 'civverse.cinematic',
        version: 1,
        id: 'intro',
        duration: 3,
        tracks: [
          { type: 'camera', keys: [{ t: 0, position: [5, 5, 5], target: [10, 1, 10] }, { t: 3, position: [8, 3, 8], lookAt: 'mira' }] },
          { type: 'subtitle', items: [{ t: 0.5, duration: 2, speaker: 'mira', text: 'testciv.dlg.hello' }] },
          { type: 'actions', items: [{ t: 1, actions: [{ type: 'core.setVar', var: 'testciv.introSeen', value: true }] }] },
        ],
        onComplete: [{ type: 'core.setVar', var: 'testciv.introDone', value: true }],
      },
      'content/logic/main.logic.json': {
        format: 'civverse.logic',
        version: 1,
        id: 'main',
        rules: [
          { id: 'intro', once: true, when: { event: 'civ.started' }, then: [{ type: 'core.playCinematic', cinematic: 'intro', wait: false }] },
          { id: 'gate', when: { event: 'door.opened', where: { entityId: 'gate_door' } }, then: [{ type: 'core.setVar', var: 'testciv.gateOpened', value: true }] },
        ],
      },
      'locales/fr-FR.json': {
        'testciv.name': 'Civilisation de test',
        'testciv.description': 'Une civilisation pour les tests.',
        'testciv.scene.village': 'Le Village',
        'testciv.npc.mira': 'Mira',
        'testciv.locked': 'Verrouillée',
        'testciv.item.key': 'Clé',
        'testciv.item.key.desc': 'Une clé.',
        'testciv.dlg.hello': 'Bonjour, étranger.',
        'testciv.dlg.askKey': 'Comment ouvrir la porte ?',
        'testciv.dlg.bye': 'Au revoir.',
        'testciv.dlg.key': 'Elle est ouverte pour toi.',
        'testciv.dlg.again': 'Encore toi ?',
        'testciv.q1.title': 'Le passage',
        'testciv.q1.summary': 'Franchir la porte.',
        'testciv.q1.s1': 'Parler à Mira.',
        'testciv.q1.s2': 'Franchir la porte.',
        'testciv.q1.talk': 'Parler à Mira',
        'testciv.q1.through': 'Passer la porte',
        'testciv.fragment': 'Fragment de test',
        'testciv.fragment.hint': 'Un indice.',
      },
    },
  };
}

function otherPack(): MemoryPack {
  const v = new VoxelVolume(16, 8, 16);
  fillBox(v, [0, 0, 0], [15, 0, 15], 'other:ground');
  return {
    manifest: {
      format: 'civverse.pack',
      version: 1,
      id: 'other',
      kind: 'civilization',
      name: 'other.name',
      description: 'other.description',
      packVersion: '1.0.0',
      engineApi: '^1.0.0',
      entry: { scene: 'plain', spawn: 'start' },
      scenes: ['plain'],
    },
    module: definePack({ modules: blocksModule('other') }),
    files: {
      'content/scenes/plain.scene.json': {
        format: 'civverse.scene',
        version: 1,
        id: 'plain',
        name: 'other.scene',
        environment: ENV,
        voxels: volumeToDoc(v),
        entities: [{ id: 'start', position: [8.5, 1, 8.5], components: { 'core.spawn': {} } }],
      },
      'locales/fr-FR.json': { 'other.name': 'Autre', 'other.description': 'Autre civilisation.', 'other.scene': 'Plaine' },
    },
  };
}

async function setup() {
  const provider = new MemoryContentProvider({ testciv: testPack(), other: otherPack() });
  return createHeadlessGame(provider);
}

describe('GameSession (headless integration)', () => {
  it('loads a civilization, spawns the player and plays the intro cinematic (skippable)', async () => {
    const { session } = await setup();
    expect(session.civilizations().map((c) => c.id)).toEqual(['testciv', 'other']);
    await session.loadCivilization('testciv');
    expect(session.world?.id).toBe('village');
    expect(session.player.position.x).toBeCloseTo(10.5);
    expect(session.player.position.y).toBeCloseTo(1);
    await flush();
    expect(session.cinematics.current?.id).toBe('intro');
    expect(session.player.movementLocked).toBe(true);
    await skipCinematics(session);
    await flush();
    expect(session.vars.get('testciv.introSeen')).toBe(true);
    expect(session.vars.get('testciv.introDone')).toBe(true);
    expect(session.player.movementLocked).toBe(false);
    expect(session.contentIssues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('moves the player with input intents and collides with the world', async () => {
    const { session } = await setup();
    await session.loadCivilization('testciv');
    await skipCinematics(session);
    session.player.setLook(0, 0);
    session.player.intent.forward = 1;
    await advance(session, 4);
    session.player.intent.forward = 0;
    // The wall at z = 20 stops the player (doorway at x = 15 is closed by the door).
    expect(session.player.position.z).toBeCloseTo(20 - 0.3, 2);
  });

  it('runs the full story loop: locked door, dialogue choice, quest, trigger, fragment', async () => {
    const { session, ui } = await setup();
    await session.loadCivilization('testciv');
    await skipCinematics(session);
    expect(session.quests.status('Q1')).toBe('active');

    // The lock vetoes the door and explains why.
    await walkTo(session, 'gate_door');
    const target = session.interaction.target;
    expect(target?.primary?.offer.detail).toBe('Verrouillée');
    expect(await session.interaction.interactWith('gate_door')).toBe(false);
    expect(ui.notifications.at(-1)?.text).toBe('Verrouillée');
    await expect(walkTo(session, 'gate_trigger')).rejects.toThrow(/Inaccessible/);

    // Dialogue with a choice unlocks the door and advances the quest.
    await talk(session, 'mira', ['ask_key']);
    expect(session.vars.get('testciv.canOpen')).toBe(true);
    expect(session.quests.stage('Q1')).toBe('s2');

    // Second conversation takes another branch.
    await talk(session, 'mira');
    expect(session.dialogue.seen('mira_talk', 'again')).toBe(true);

    await walkTo(session, 'gate_door');
    expect(await session.interaction.interactWith('gate_door')).toBe(true);
    expect(session.vars.get('testciv.gateOpened')).toBe(true);

    // The trigger behind the door is now reachable and completes the quest.
    await walkTo(session, 'gate_trigger', { reach: 0.6 });
    await advance(session, 0.3);
    expect(session.quests.status('Q1')).toBe('completed');
    expect(session.multiverse.hasFragment('test')).toBe(true);

    // Pickup.
    await walkTo(session, 'key_pickup');
    expect(await session.interaction.interactWith('key_pickup')).toBe(true);
    expect(session.inventory.count('testciv:key')).toBe(1);
    expect(session.world!.entities.get('key_pickup')!.visible).toBe(false);
  });

  it('saves and restores local and global state through the versioned save format', async () => {
    const { session } = await setup();
    await session.loadCivilization('testciv');
    await skipCinematics(session);
    await talk(session, 'mira', ['ask_key']);
    await walkTo(session, 'gate_door');
    await session.interaction.interactWith('gate_door');
    await walkTo(session, 'key_pickup');
    await session.interaction.interactWith('key_pickup');
    await advance(session, 2.5);
    const ticks = (session.civ!.mechanics.get('testciv.counter')!.api as { ticks: number }).ticks;
    // One tick per simulated second (helpers also advance time while walking).
    expect(ticks).toBe(Math.floor(session.clock.now + 1e-6));
    const json = JSON.stringify(session.buildSaveGame('auto', 'Test'));

    const { session: s2 } = await setup();
    const { save } = parseSave(JSON.parse(json));
    await s2.applySaveGame(save);
    await s2.loadCivilization('testciv');
    await flush();
    expect(s2.cinematics.current).toBeNull(); // intro rule was "once"
    expect(s2.vars.get('testciv.canOpen')).toBe(true);
    expect(s2.quests.stage('Q1')).toBe('s2');
    expect(s2.inventory.count('testciv:key')).toBe(1);
    expect(s2.world!.entities.get('key_pickup')!.visible).toBe(false);
    const door = s2.entityApi('gate_door')!.behavior<{ isOpen: boolean }>('core.door');
    expect(door?.isOpen).toBe(true);
    expect((s2.civ!.mechanics.get('testciv.counter')!.api as { ticks: number }).ticks).toBe(ticks);
    expect(s2.player.position.z).toBeCloseTo(session.player.position.z, 3);
  });

  it('isolates civilizations: switching unloads listeners, timers and registrations', async () => {
    const { session } = await setup();
    const baselineTimers = session.clock.timerCount;
    await session.loadCivilization('testciv');
    await skipCinematics(session);
    await advance(session, 3.2);
    const ticksBefore = (session.civ!.mechanics.get('testciv.counter')!.api as { ticks: number }).ticks;
    expect(ticksBefore).toBe(3);
    expect(session.logicRegistry.condition('testciv.metMira')).toBeDefined();

    await session.loadCivilization('other');
    expect(session.civ?.id).toBe('other');
    expect(session.logicRegistry.condition('testciv.metMira')).toBeUndefined();
    expect(session.behaviorDefs.has('testciv.lock')).toBe(false);
    expect(session.blocks.has('testciv:wall')).toBe(false);
    expect(session.vars.get('testciv.canOpen')).toBeUndefined();
    expect(session.i18n.has('testciv.dlg.hello')).toBe(false);
    // The pack's name stays readable for the civilization selection screen.
    expect(session.i18n.has('testciv.name')).toBe(true);
    await advance(session, 5);
    // The testciv state kept in memory did not keep ticking while "other" runs.
    expect((session.civStates.get('testciv')!.mechanics['testciv.counter']!.state as { ticks: number }).ticks).toBe(3);

    await session.unloadCivilization();
    expect(session.leakedListeners).toBe(0);
    expect(session.clock.timerCount).toBe(baselineTimers);
    expect(session.player.modifierCount).toBe(0);
  });

  it('refuses writes outside the civilization namespace and undeclared global writes', async () => {
    const { session } = await setup();
    await session.loadCivilization('testciv');
    const ctx = session.civ!.ctx;
    expect(() => ctx.vars.set('other.secret', 1)).toThrow(/ne peut écrire/);
    expect(() => ctx.multiverse.grantFragment('remanence')).toThrow(/globalWrites/);
    ctx.multiverse.setFlag('testciv.done', true);
    expect(session.multiverse.getFlag('testciv.done')).toBe(true);
    expect(session.vars.get('global.flags.testciv.done')).toBe(true);
  });
});
