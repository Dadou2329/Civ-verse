/**
 * Acceptance test D — Story progression.
 *
 * "Start a quest, trigger its objectives, finish it, and verify state changes."
 *
 * Played on the real packs: the Door prologue quest (DOOR_Q00_REVEIL) from start to finish, and
 * the first stage of the Memory prologue (MEM_Q00_EVEIL). Every objective is triggered through
 * gameplay (walking, interacting, dialogue choices), never by setting quest state directly.
 * The complete stories, on every branch, are played by civilizations/{door,memory}/tests.
 */
import { describe, expect, it } from 'vitest';
import { advance, advanceDialogue, choose, doorIsOpen, flush, goTo, norm, openDoor, skipCinematics, startCiv, talk, walkTo } from './helpers';

describe('Test D — story progression', () => {
  it('Door: DOOR_Q00_REVEIL starts, its objectives are triggered by play, it completes and opens the next quest', async () => {
    const { session, ui } = await startCiv('door');
    const events: string[] = [];
    for (const name of ['quest.started', 'quest.objectiveCompleted', 'quest.stageChanged', 'quest.completed'] as const) {
      session.bus.on(name, (p) => events.push(`${name}:${Object.values(p).join('/')}`));
    }

    // The awakening cinematic plays first; skipping it must not break the quest state.
    expect(session.cinematics.current?.id).toBe('C01_eveil');
    await skipCinematics(session);
    await flush();
    expect(session.quests.status('DOOR_Q00_REVEIL')).toBe('active');
    expect(session.quests.status('DOOR_Q01_EMPREINTE')).not.toBe('active');
    expect(session.quests.isObjectiveDone('DOOR_Q00_REVEIL', 'sortir')).toBe(false);
    expect(session.vars.get('door.rank')).toBe(-1);
    // The objective names its target, which the HUD marks just above the door.
    const sortir = session.quests.view().find((q) => q.id === 'DOOR_Q00_REVEIL')?.objectives.find((o) => o.id === 'sortir');
    expect(sortir).toMatchObject({ target: 'cell_door', targetScene: null, done: false });
    const door = session.world!.entities.get('cell_door')!;
    const mark = session.world!.markerPoint(door);
    expect(mark.y).toBeGreaterThan(door.position.y + 1.5);
    expect(Math.hypot(mark.x - door.position.x, mark.z - door.position.z)).toBeLessThan(1);

    // Objective 1 — leave the cell: the handleless door answers the palm.
    await openDoor(session, 'cell_door');
    expect(doorIsOpen(session, 'cell_door')).toBe(true);
    expect(session.vars.get('door.palmRevealed')).toBe(true);
    await goTo(session, 'trig_cell_exit', 0.3);
    expect(session.quests.isObjectiveDone('DOOR_Q00_REVEIL', 'sortir')).toBe(true);
    expect(events).toContain('quest.objectiveCompleted:DOOR_Q00_REVEIL/sortir');

    // Objective 2 — talk to Noé (dialogue with choices): rank 0 plaque, quest completed.
    await talk(session, 'noe', ['from', 'thanks']);
    expect(session.dialogue.seen('noe', 'intro1')).toBe(true);
    expect(session.quests.status('DOOR_Q00_REVEIL')).toBe('completed');
    expect(events).toContain('quest.completed:DOOR_Q00_REVEIL');

    // State changes that the rest of the story depends on.
    expect(session.vars.get('door.rank')).toBe(0);
    expect(session.civ!.ctx.inventory.has('door:plaque_r0')).toBe(true);
    expect(session.quests.status('DOOR_Q01_EMPREINTE')).toBe('active');
    expect(events).toContain('quest.started:DOOR_Q01_EMPREINTE');
    // The journal shows the completed quest and the new one, in French.
    const journal = session.quests.view();
    const q0 = journal.find((q) => q.id === 'DOOR_Q00_REVEIL');
    const q1 = journal.find((q) => q.id === 'DOOR_Q01_EMPREINTE');
    expect(q0?.status).toBe('completed');
    expect(norm(q1?.title)).toBe('Le prix d’une poignée');
    // The player was told.
    expect(ui.notifications.length).toBeGreaterThan(0);
  });

  it('Memory: MEM_Q00_EVEIL objectives are completed by examining a shard and following the first echo', async () => {
    const { session } = await startCiv('memory');
    expect(session.cinematics.current?.id).toBe('M01_marche');
    await skipCinematics(session);
    await flush();
    expect(session.quests.status('MEM_Q00_EVEIL')).toBe('active');
    const stageBefore = session.quests.stage('MEM_Q00_EVEIL');

    // Examining the amber shard (memory chamber mechanic) completes an objective.
    const chamber = session.civ!.mechanics.get('memory.chamber')!.api as { examine(id: string): void };
    chamber.examine('ambre');
    await advance(session, 0.2);
    expect(session.quests.isObjectiveDone('MEM_Q00_EVEIL', 'examiner')).toBe(true);

    // Walking to the sign of the Métier plays the first echo, then Oriane speaks.
    await talk(session, 'jules', ['keep']);
    await walkTo(session, 'echo_enseigne', { reach: 1.5 });
    await advance(session, 0.5);
    expect(session.cinematics.current?.id).toBe('M02_premier_echo');
    await skipCinematics(session);
    await advance(session, 1);
    expect(session.vars.get('memory.firstEcho')).toBe(true);
    expect(session.dialogue.view()?.dialogueId).toBe('oriane');

    // The stage advanced: the quest moved on because of what the player did.
    await choose(session, 'nothing');
    await advanceDialogue(session);
    expect(session.vars.get('memory.metOriane')).toBe(true);
    expect(session.quests.stage('MEM_Q00_EVEIL')).toBe('atelier');
    expect(session.quests.stage('MEM_Q00_EVEIL')).not.toBe(stageBefore);
  });
});
