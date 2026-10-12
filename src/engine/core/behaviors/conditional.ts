/**
 * World states driven by the story: shows/hides/enables an entity according to conditions
 * (e.g. a guard appears after a choice, a barricade disappears when a quest is complete,
 * a character moves to a new place in the epilogue).
 */
import { defineBehavior } from '../packs/definitions';
import { prop } from '../props/props';

export const conditionalBehavior = defineBehavior({
  id: 'core.conditional',
  label: 'États conditionnels',
  category: 'Narration',
  description: 'Applique le premier état dont la condition est vraie (visibilité, activation, position).',
  props: {
    states: prop.list(
      prop.object({
        when: prop.condition({ label: 'Quand' }),
        visible: prop.enum(
          [
            { value: 'keep', label: 'Inchangée' },
            { value: 'show', label: 'Visible' },
            { value: 'hide', label: 'Cachée' },
          ],
          { label: 'Visibilité', default: 'keep' },
        ),
        enabled: prop.enum(
          [
            { value: 'keep', label: 'Inchangé' },
            { value: 'on', label: 'Actif' },
            { value: 'off', label: 'Inactif' },
          ],
          { label: 'Activation', default: 'keep' },
        ),
        moveTo: prop.entity({ label: 'Placer sur le repère' }),
      }),
      { label: 'États (le premier vrai s’applique)' },
    ),
    otherwise: prop.enum(
      [
        { value: 'keep', label: 'Ne rien changer' },
        { value: 'show', label: 'Visible' },
        { value: 'hide', label: 'Cachée' },
      ],
      { label: 'Si aucun état ne s’applique', default: 'keep' },
    ),
  },
  create(ctx) {
    let applied = -2;
    const evaluate = () => {
      const scope = { self: ctx.entity.id, origin: `états ${ctx.entity.id}` };
      const idx = ctx.props.states.findIndex((s) => ctx.logic.test(s.when, scope));
      if (idx === applied) return;
      applied = idx;
      if (idx < 0) {
        if (ctx.props.otherwise === 'show') ctx.entity.visible = true;
        else if (ctx.props.otherwise === 'hide') ctx.entity.visible = false;
        return;
      }
      const s = ctx.props.states[idx]!;
      if (s.visible === 'show') ctx.entity.visible = true;
      else if (s.visible === 'hide') ctx.entity.visible = false;
      if (s.enabled === 'on') ctx.entity.enabled = true;
      else if (s.enabled === 'off') ctx.entity.enabled = false;
      if (s.moveTo) {
        const marker = ctx.world.entity(s.moveTo);
        if (marker) {
          ctx.entity.setPosition(marker.position);
          ctx.entity.setYaw(marker.yaw);
        }
      }
    };
    evaluate();
    ctx.events.onAny((name) => {
      if (name === 'player.jumped' || name === 'player.landed') return;
      evaluate();
    });
    return { onPropsChanged: () => ((applied = -2), evaluate()) };
  },
});
