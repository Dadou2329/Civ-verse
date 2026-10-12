import { defineBehavior, defineEvent, prop } from '@sdk';

/**
 * DoorMemory — some doors of Verrou remember being touched.
 *
 * Every attempt (open, refused, examined) increments the door's memory; its description (the
 * « Examiner » prompt, key F) changes with the number of touches. The state is saved with the
 * game, so a door still remembers after a reload.
 */
export const doorMemory = defineBehavior({
  id: 'door.memory',
  label: 'Mémoire de la porte',
  category: 'Verrou',
  description: 'Compte les contacts du joueur et change la description de la porte en conséquence.',
  props: {
    descriptions: prop.list(prop.text({ label: 'Description' }), { label: 'Descriptions (1er contact, 2e, 3e…)' }),
    examineVar: prop.variable({ label: 'Variable mise à vrai au premier examen' }),
  },
  state: { version: 1, initial: () => ({ touches: 0 }) },
  create(ctx) {
    const description = () => {
      const list = ctx.props.descriptions;
      if (list.length === 0) return '';
      return ctx.t(list[Math.min(ctx.state.touches, list.length - 1)]!);
    };
    const touch = (kind: string) => {
      ctx.state.touches++;
      ctx.events.emit('door.touched', { entityId: ctx.entity.id, count: ctx.state.touches, kind });
    };
    // Opened or refused: both count as a touch (whatever the order of the components).
    ctx.events.on('entity.interacted', (e) => {
      if (e.entityId === ctx.entity.id && e.interaction !== 'examine') touch(e.interaction);
    });
    ctx.events.on('interaction.blocked', (e) => {
      if (e.entityId === ctx.entity.id) touch('refused');
    });
    return {
      api: {
        get touches() {
          return ctx.state.touches;
        },
      },
      interaction: () => (ctx.props.descriptions.length ? { id: 'examine', label: ctx.t('door.prompt.examineDoor'), key: 'secondary', priority: -1 } : null),
      onInteract: (attempt) => {
        if (attempt.source !== 'door.memory') return;
        const text = description();
        touch('examine');
        if (ctx.props.examineVar && !ctx.vars.get(ctx.props.examineVar)) ctx.vars.set(ctx.props.examineVar, true);
        if (text) ctx.ui.notify(text, { kind: 'discovery', duration: 6 });
      },
    };
  },
});

export const touchedEvent = defineEvent({
  id: 'door.touched',
  label: 'Porte touchée (mémoire)',
  fields: { entityId: prop.entity({ label: 'Porte' }), count: prop.integer({ label: 'Nombre de contacts' }) },
});
