/**
 * Documentation of the engine events for the Studio (rule triggers, objective triggers).
 * The TypeScript payload types live in events/eventMap.ts.
 */
import { defineEvent } from '../packs/definitions';
import { prop } from '../props/props';

export const coreEvents = [
  defineEvent({ id: 'civ.started', label: 'Civilisation démarrée', fields: { civId: prop.string({ label: 'Civilisation' }) } }),
  defineEvent({ id: 'civ.finished', label: 'Civilisation terminée', fields: { civId: prop.string({ label: 'Civilisation' }) } }),
  defineEvent({ id: 'scene.entered', label: 'Entrée dans une scène', fields: { sceneId: prop.scene({ label: 'Scène' }) } }),
  defineEvent({ id: 'zone.entered', label: 'Entrée dans une zone', fields: { zoneId: prop.entity({ label: 'Zone', withComponent: 'core.zone' }) } }),
  defineEvent({ id: 'zone.exited', label: 'Sortie d’une zone', fields: { zoneId: prop.entity({ label: 'Zone', withComponent: 'core.zone' }) } }),
  defineEvent({ id: 'trigger.entered', label: 'Déclencheur atteint', fields: { triggerId: prop.entity({ label: 'Déclencheur', withComponent: 'core.trigger' }) } }),
  defineEvent({ id: 'trigger.exited', label: 'Déclencheur quitté', fields: { triggerId: prop.entity({ label: 'Déclencheur', withComponent: 'core.trigger' }) } }),
  defineEvent({
    id: 'entity.interacted',
    label: 'Interaction avec une entité',
    fields: { entityId: prop.entity({ label: 'Entité' }), interaction: prop.string({ label: 'Interaction' }) },
  }),
  defineEvent({
    id: 'interaction.blocked',
    label: 'Interaction refusée',
    fields: { entityId: prop.entity({ label: 'Entité' }), interaction: prop.string({ label: 'Interaction' }), by: prop.string({ label: 'Composant' }) },
  }),
  defineEvent({ id: 'door.opened', label: 'Porte ouverte', fields: { entityId: prop.entity({ label: 'Porte', withComponent: 'core.door' }) } }),
  defineEvent({ id: 'door.closed', label: 'Porte fermée', fields: { entityId: prop.entity({ label: 'Porte', withComponent: 'core.door' }) } }),
  defineEvent({ id: 'item.acquired', label: 'Objet obtenu', fields: { itemId: prop.item({ label: 'Objet' }) } }),
  defineEvent({ id: 'item.removed', label: 'Objet retiré', fields: { itemId: prop.item({ label: 'Objet' }) } }),
  defineEvent({ id: 'item.used', label: 'Objet utilisé', fields: { itemId: prop.item({ label: 'Objet' }), action: prop.string({ label: 'Action' }) } }),
  defineEvent({ id: 'var.changed', label: 'Variable modifiée', fields: { name: prop.variable({ label: 'Variable' }) } }),
  defineEvent({ id: 'dialogue.started', label: 'Dialogue commencé', fields: { dialogueId: prop.dialogue({ label: 'Dialogue' }) } }),
  defineEvent({ id: 'dialogue.node', label: 'Réplique affichée', fields: { dialogueId: prop.dialogue({ label: 'Dialogue' }), nodeId: prop.string({ label: 'Nœud' }) } }),
  defineEvent({ id: 'dialogue.choice', label: 'Choix de dialogue', fields: { dialogueId: prop.dialogue({ label: 'Dialogue' }), choiceId: prop.string({ label: 'Choix' }) } }),
  defineEvent({ id: 'dialogue.ended', label: 'Dialogue terminé', fields: { dialogueId: prop.dialogue({ label: 'Dialogue' }), lastNode: prop.string({ label: 'Dernier nœud' }) } }),
  defineEvent({ id: 'quest.started', label: 'Quête commencée', fields: { questId: prop.quest({ label: 'Quête' }) } }),
  defineEvent({ id: 'quest.stageChanged', label: 'Étape de quête atteinte', fields: { questId: prop.quest({ label: 'Quête' }), stageId: prop.string({ label: 'Étape' }) } }),
  defineEvent({ id: 'quest.objectiveCompleted', label: 'Objectif accompli', fields: { questId: prop.quest({ label: 'Quête' }), objectiveId: prop.string({ label: 'Objectif' }) } }),
  defineEvent({ id: 'quest.completed', label: 'Quête terminée', fields: { questId: prop.quest({ label: 'Quête' }) } }),
  defineEvent({ id: 'quest.failed', label: 'Quête échouée', fields: { questId: prop.quest({ label: 'Quête' }) } }),
  defineEvent({ id: 'cinematic.started', label: 'Cinématique commencée', fields: { cinematicId: prop.cinematic({ label: 'Cinématique' }) } }),
  defineEvent({ id: 'cinematic.ended', label: 'Cinématique terminée', fields: { cinematicId: prop.cinematic({ label: 'Cinématique' }), skipped: prop.boolean({ label: 'Passée' }) } }),
  defineEvent({ id: 'npc.arrived', label: 'Personnage arrivé', fields: { entityId: prop.entity({ label: 'Personnage', withComponent: 'core.npc' }) } }),
  defineEvent({ id: 'ability.used', label: 'Capacité utilisée', fields: { abilityId: prop.ability({ label: 'Capacité' }) } }),
  defineEvent({ id: 'multiverse.fragmentAcquired', label: 'Fragment multivers obtenu', fields: { fragmentId: prop.string({ label: 'Fragment' }) } }),
  defineEvent({ id: 'player.landed', label: 'Atterrissage du joueur', fields: { fallSpeed: prop.number({ label: 'Vitesse de chute' }) } }),
  defineEvent({ id: 'player.jumped', label: 'Saut du joueur', fields: {} }),
  defineEvent({ id: 'civ.unloading', label: 'Civilisation quittée', fields: { civId: prop.string({ label: 'Civilisation' }) } }),
  defineEvent({ id: 'scene.exiting', label: 'Sortie d’une scène', fields: { sceneId: prop.scene({ label: 'Scène' }) } }),
  defineEvent({ id: 'save.completed', label: 'Partie sauvegardée', fields: { slot: prop.string({ label: 'Emplacement' }) } }),
  defineEvent({ id: 'ui.panelOpened', label: 'Panneau ouvert', fields: { panelId: prop.string({ label: 'Panneau' }) } }),
  defineEvent({ id: 'ui.panelClosed', label: 'Panneau fermé', fields: { panelId: prop.string({ label: 'Panneau' }) } }),
];
