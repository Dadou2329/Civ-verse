import { defineEvent } from '@sdk';

/**
 * Events of the Prologue « La place qu'on nous donne ». The two structuring ones carry the stable
 * ids of the scenario (§12); the others mark the local steps. They are emitted by the scene's
 * components, the quest and the logic rules, and documented here for the Studio.
 */
export const prologueEvents = [
  defineEvent({ id: 'mask.prologue.essieu', label: 'Prologue — essieu du chariot aligné', fields: {} }),
  defineEvent({ id: 'mask.prologue.roueFixee', label: 'Prologue — roue fixée au marteau', fields: {} }),
  defineEvent({
    id: 'mask.prologue.workshop_repaired',
    label: 'Prologue — roue réparée',
    description: 'Active l’incident du monte-charge (arrivée de Juno).',
    fields: {},
  }),
  defineEvent({ id: 'mask.prologue.rampe', label: 'Prologue — arrivée au pied du monte-charge', fields: {} }),
  defineEvent({ id: 'mask.prologue.levier', label: 'Prologue — levier de secours tiré', fields: {} }),
  defineEvent({ id: 'mask.prologue.freinLibere', label: 'Prologue — frein libéré par la Braise', fields: {} }),
  defineEvent({
    id: 'mask.prologue.lift_saved',
    label: 'Prologue — incident du monte-charge résolu',
    description: 'Juno propose de présenter le héros à un relais de candidats.',
    fields: {},
  }),
];
