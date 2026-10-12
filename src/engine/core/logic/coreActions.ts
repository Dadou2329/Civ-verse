/**
 * Built-in logic actions ("core.*"). Packs add their own with defineAction().
 */
import { defineAction } from '../packs/definitions';
import { prop } from '../props/props';
import type { JsonValue } from '../util/json';
import type { CivContext } from '../sim/api';
import { fromTuple, type Vec3 } from '../util/math';

const entityPos = (ctx: CivContext, ref: string, fallback?: [number, number, number]): Vec3 | null => {
  if (ref === 'player') return ctx.player.position;
  if (ref) return ctx.world.entity(ref)?.position ?? null;
  return fallback ? fromTuple(fallback) : null;
};

export const coreActions = [
  // ---- Variables -------------------------------------------------------------------------
  defineAction({
    id: 'core.setVar',
    label: 'Définir une variable',
    category: 'Variables',
    props: { var: prop.variable({ label: 'Variable' }), value: prop.json({ label: 'Valeur', default: true }) },
    run: (ctx, p) => ctx.vars.set(p.var, p.value as JsonValue),
    summarize: (p) => `${p.var} = ${JSON.stringify(p.value)}`,
  }),
  defineAction({
    id: 'core.addVar',
    label: 'Ajouter à une variable',
    category: 'Variables',
    props: { var: prop.variable({ label: 'Variable' }), amount: prop.number({ label: 'Quantité', default: 1 }) },
    run: (ctx, p) => void ctx.vars.add(p.var, p.amount),
    summarize: (p) => `${p.var} += ${p.amount}`,
  }),
  defineAction({
    id: 'core.toggleVar',
    label: 'Inverser une variable',
    category: 'Variables',
    props: { var: prop.variable({ label: 'Variable' }) },
    run: (ctx, p) => void ctx.vars.toggle(p.var),
  }),
  // ---- Flow --------------------------------------------------------------------------------
  defineAction({
    id: 'core.wait',
    label: 'Attendre',
    category: 'Déroulement',
    props: { seconds: prop.number({ label: 'Secondes', default: 1, min: 0, max: 600 }) },
    run: (ctx, p, scope) => (scope.skipping ? undefined : ctx.time.wait(p.seconds)),
    essential: false,
    summarize: (p) => `Attendre ${p.seconds} s`,
  }),
  defineAction({
    id: 'core.if',
    label: 'Si… alors… sinon',
    category: 'Déroulement',
    props: {
      condition: prop.condition({ label: 'Condition' }),
      then: prop.actions({ label: 'Alors' }),
      else: prop.actions({ label: 'Sinon' }),
    },
    run: (ctx, p, scope) => ctx.logic.run(ctx.logic.test(p.condition, scope) ? p.then : p.else, scope),
  }),
  defineAction({
    id: 'core.parallel',
    label: 'En parallèle',
    category: 'Déroulement',
    props: { branches: prop.list(prop.actions({ label: 'Branche' }), { label: 'Branches' }) },
    run: async (ctx, p, scope) => {
      await Promise.all(p.branches.map((b) => ctx.logic.run(b, scope)));
    },
  }),
  defineAction({
    id: 'core.emit',
    label: 'Émettre un événement',
    category: 'Déroulement',
    props: { event: prop.event({ label: 'Événement' }), payload: prop.json({ label: 'Données', default: {} }) },
    run: (ctx, p) => ctx.events.emit(p.event, (p.payload && typeof p.payload === 'object' ? p.payload : {}) as Record<string, unknown>),
  }),
  defineAction({
    id: 'core.log',
    label: 'Journal de débogage',
    category: 'Déroulement',
    props: { message: prop.string({ label: 'Message' }) },
    run: (ctx, p) => ctx.log.info(p.message),
    essential: false,
  }),
  // ---- Interface ---------------------------------------------------------------------------
  defineAction({
    id: 'core.notify',
    label: 'Afficher une notification',
    category: 'Interface',
    props: {
      text: prop.text({ label: 'Texte' }),
      kind: prop.enum(['info', 'success', 'warning', 'denied', 'quest', 'item', 'memory', 'discovery'] as const, { label: 'Type', default: 'info' }),
    },
    run: (ctx, p) => ctx.ui.notify(ctx.t(p.text), { kind: p.kind }),
  }),
  defineAction({
    id: 'core.showLocation',
    label: 'Afficher un titre de lieu',
    category: 'Interface',
    props: { title: prop.text({ label: 'Titre' }), subtitle: prop.text({ label: 'Sous-titre' }) },
    run: (ctx, p) => ctx.ui.showLocation(ctx.t(p.title), p.subtitle ? ctx.t(p.subtitle) : undefined),
    essential: false,
  }),
  defineAction({
    id: 'core.showDocument',
    label: 'Afficher un document',
    category: 'Interface',
    props: {
      title: prop.text({ label: 'Titre' }),
      pages: prop.list(prop.text({ label: 'Paragraphe', multiline: true }), { label: 'Contenu' }),
      style: prop.enum(['paper', 'register', 'poster', 'letter', 'plaque', 'book'] as const, { label: 'Style', default: 'paper' }),
    },
    run: (ctx, p) => ctx.ui.showDocument({ title: ctx.t(p.title), body: p.pages.map((k) => ctx.t(k)), style: p.style }),
  }),
  defineAction({
    id: 'core.openPanel',
    label: 'Ouvrir un panneau',
    category: 'Interface',
    props: { panel: prop.panel({ label: 'Panneau' }), wait: prop.boolean({ label: 'Attendre la fermeture', default: true }) },
    run: async (ctx, p) => {
      const r = ctx.ui.openPanel(p.panel);
      if (p.wait) await r;
    },
  }),
  defineAction({
    id: 'core.showEndScreen',
    label: 'Écran de fin',
    category: 'Interface',
    props: {
      title: prop.text({ label: 'Titre' }),
      subtitle: prop.text({ label: 'Sous-titre' }),
      lines: prop.list(prop.text({ label: 'Ligne' }), { label: 'Lignes' }),
    },
    run: (ctx, p) =>
      ctx.ui.showEndScreen({ title: ctx.t(p.title), subtitle: p.subtitle ? ctx.t(p.subtitle) : undefined, lines: p.lines.map((l) => ctx.t(l)) }),
  }),
  defineAction({
    id: 'core.setHudVisible',
    label: 'Afficher/masquer un élément d’interface',
    category: 'Interface',
    props: {
      element: prop.enum(['crosshair', 'prompt', 'objectives', 'notifications', 'inventory', 'abilities', 'location'] as const, { label: 'Élément', default: 'objectives' }),
      visible: prop.boolean({ label: 'Visible', default: true }),
    },
    run: (ctx, p) => ctx.ui.setHudVisible(p.element, p.visible),
  }),
  // ---- Inventory ---------------------------------------------------------------------------
  defineAction({
    id: 'core.giveItem',
    label: 'Donner un objet',
    category: 'Inventaire',
    props: { item: prop.item({ label: 'Objet' }), count: prop.integer({ label: 'Quantité', default: 1, min: 1 }), silent: prop.boolean({ label: 'Sans notification' }) },
    run: (ctx, p) => void ctx.inventory.add(p.item, p.count, { silent: p.silent }),
    summarize: (p) => `Donner ${p.count} × ${p.item}`,
  }),
  defineAction({
    id: 'core.takeItem',
    label: 'Retirer un objet',
    category: 'Inventaire',
    props: { item: prop.item({ label: 'Objet' }), count: prop.integer({ label: 'Quantité', default: 1, min: 1 }), silent: prop.boolean({ label: 'Sans notification' }) },
    run: (ctx, p) => void ctx.inventory.remove(p.item, p.count, { silent: p.silent }),
    summarize: (p) => `Retirer ${p.count} × ${p.item}`,
  }),
  // ---- Equipment ---------------------------------------------------------------------------
  defineAction({
    id: 'core.holdItem',
    label: 'Mettre un objet en main',
    category: 'Équipement',
    props: { item: prop.item({ label: 'Objet (vide = main nue)' }) },
    run: (ctx, p) => void ctx.equipment.hold(p.item || null),
    summarize: (p) => (p.item ? `Prendre en main ${p.item}` : 'Vider la main'),
  }),
  defineAction({
    id: 'core.equipItem',
    label: 'Porter un objet',
    category: 'Équipement',
    props: { item: prop.item({ label: 'Objet (avec un emplacement)' }) },
    run: (ctx, p) => void ctx.equipment.equip(p.item),
    summarize: (p) => `Porter ${p.item}`,
  }),
  defineAction({
    id: 'core.unequipSlot',
    label: 'Retirer l’objet porté',
    category: 'Équipement',
    props: { slot: prop.string({ label: 'Emplacement', default: 'masque' }) },
    run: (ctx, p) => ctx.equipment.unequip(p.slot),
  }),
  // ---- Combat ------------------------------------------------------------------------------
  defineAction({
    id: 'core.damagePlayer',
    label: 'Blesser le joueur',
    category: 'Combat',
    props: {
      amount: prop.number({ label: 'Dégâts', default: 10, min: 0 }),
      from: prop.entity({ label: 'Venant de (optionnel)' }),
      knockback: prop.number({ label: 'Recul (m/s)', default: 0, min: 0 }),
      unblockable: prop.boolean({ label: 'Imparable', default: true }),
    },
    run: (ctx, p) => void ctx.combat.damagePlayer({ amount: p.amount, source: p.from || null, kind: 'environment', knockback: p.knockback, unblockable: p.unblockable }),
  }),
  defineAction({
    id: 'core.healPlayer',
    label: 'Soigner le joueur',
    category: 'Combat',
    props: { amount: prop.number({ label: 'Vie rendue', default: 100, min: 0 }) },
    run: (ctx, p) => ctx.combat.healPlayer(p.amount),
  }),
  defineAction({
    id: 'core.damageEntity',
    label: 'Blesser une entité',
    category: 'Combat',
    props: {
      entity: prop.entity({ label: 'Entité', withComponent: 'core.health' }),
      amount: prop.number({ label: 'Dégâts', default: 10, min: 0 }),
      tags: prop.list(prop.string({ label: 'Étiquette' }), { label: 'Étiquettes de dégâts' }),
    },
    run: (ctx, p) => void ctx.combat.damage(p.entity, { amount: p.amount, source: null, kind: 'environment', tags: p.tags }),
  }),
  defineAction({
    id: 'core.reviveEntity',
    label: 'Relever une entité vaincue',
    category: 'Combat',
    props: { entity: prop.entity({ label: 'Entité', withComponent: 'core.health' }) },
    run: (ctx, p) => ctx.world.require(p.entity).behavior<{ revive(): void }>('core.health')?.revive(),
  }),
  defineAction({
    id: 'core.exposeEntity',
    label: 'Exposer un point faible',
    category: 'Combat',
    description: 'Une cible protégée peut être blessée par tous les coups pendant ce temps.',
    props: { entity: prop.entity({ label: 'Entité', withComponent: 'core.health' }), seconds: prop.number({ label: 'Durée (s)', default: 5, min: 0.1 }) },
    run: (ctx, p) => ctx.world.require(p.entity).behavior<{ expose(s: number): void }>('core.health')?.expose(p.seconds),
  }),
  defineAction({
    id: 'core.engage',
    label: 'Lancer un combattant à l’attaque',
    category: 'Combat',
    props: { entity: prop.entity({ label: 'Combattant', withComponent: 'core.combatant' }), engage: prop.boolean({ label: 'Attaquer (sinon : se retirer)', default: true }) },
    run: (ctx, p) => {
      const c = ctx.world.require(p.entity).behavior<{ engage(): void; disengage(): void }>('core.combatant');
      if (p.engage) c?.engage();
      else c?.disengage();
    },
  }),
  defineAction({
    id: 'core.startEncounter',
    label: 'Démarrer une rencontre',
    category: 'Combat',
    props: { encounter: prop.entity({ label: 'Rencontre', withComponent: 'core.encounter' }) },
    run: (ctx, p) => ctx.world.require(p.encounter).behavior<{ start(): void }>('core.encounter')?.start(),
  }),
  defineAction({
    id: 'core.completeEncounter',
    label: 'Terminer une rencontre (victoire)',
    category: 'Combat',
    props: { encounter: prop.entity({ label: 'Rencontre', withComponent: 'core.encounter' }) },
    run: (ctx, p) => ctx.world.require(p.encounter).behavior<{ complete(): void }>('core.encounter')?.complete(),
  }),
  defineAction({
    id: 'core.setCheckpoint',
    label: 'Définir le point de reprise',
    category: 'Combat',
    props: { at: prop.entity({ label: 'Repère (vide = position actuelle)' }) },
    run: (ctx, p) => ctx.combat.setCheckpoint(p.at || undefined),
  }),
  // ---- Story -------------------------------------------------------------------------------
  defineAction({
    id: 'core.startDialogue',
    label: 'Lancer un dialogue',
    category: 'Narration',
    props: {
      dialogue: prop.dialogue({ label: 'Dialogue' }),
      entity: prop.entity({ label: 'Interlocuteur' }),
      wait: prop.boolean({ label: 'Attendre la fin', default: false }),
    },
    run: async (ctx, p) => {
      const r = ctx.dialogue.start(p.dialogue, { entity: p.entity || undefined });
      if (p.wait) await r;
    },
    summarize: (p) => `Dialogue ${p.dialogue}`,
  }),
  defineAction({
    id: 'core.startQuest',
    label: 'Démarrer une quête',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }) },
    run: (ctx, p) => ctx.quests.start(p.quest),
    summarize: (p) => `Démarrer ${p.quest}`,
  }),
  defineAction({
    id: 'core.setQuestStage',
    label: 'Changer d’étape de quête',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }), stage: prop.string({ label: 'Étape' }) },
    run: (ctx, p) => ctx.quests.setStage(p.quest, p.stage),
  }),
  defineAction({
    id: 'core.completeObjective',
    label: 'Accomplir un objectif',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }), objective: prop.string({ label: 'Objectif' }) },
    run: (ctx, p) => ctx.quests.completeObjective(p.quest, p.objective),
    summarize: (p) => `Objectif ${p.quest}/${p.objective}`,
  }),
  defineAction({
    id: 'core.completeQuest',
    label: 'Terminer une quête',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }) },
    run: (ctx, p) => ctx.quests.complete(p.quest),
  }),
  defineAction({
    id: 'core.failQuest',
    label: 'Faire échouer une quête',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }) },
    run: (ctx, p) => ctx.quests.fail(p.quest),
  }),
  defineAction({
    id: 'core.trackQuest',
    label: 'Suivre une quête',
    category: 'Narration',
    props: { quest: prop.quest({ label: 'Quête' }) },
    run: (ctx, p) => ctx.quests.track(p.quest || null),
  }),
  defineAction({
    id: 'core.playCinematic',
    label: 'Jouer une cinématique',
    category: 'Narration',
    props: { cinematic: prop.cinematic({ label: 'Cinématique' }), wait: prop.boolean({ label: 'Attendre la fin', default: true }) },
    run: async (ctx, p) => {
      const r = ctx.cinematics.play(p.cinematic);
      if (p.wait) await r;
    },
    summarize: (p) => `Cinématique ${p.cinematic}`,
  }),
  defineAction({
    id: 'core.setPlayerTitle',
    label: 'Changer le nom du protagoniste (local)',
    category: 'Narration',
    props: { title: prop.text({ label: 'Titre' }) },
    run: (ctx, p) => ctx.player.identity.setTitle(p.title || null),
  }),
  // ---- Entities ----------------------------------------------------------------------------
  defineAction({
    id: 'core.setVisible',
    label: 'Afficher/masquer une entité',
    category: 'Entités',
    props: { entity: prop.entity({ label: 'Entité' }), visible: prop.boolean({ label: 'Visible', default: true }) },
    run: (ctx, p) => {
      ctx.world.require(p.entity).visible = p.visible;
    },
  }),
  defineAction({
    id: 'core.setEnabled',
    label: 'Activer/désactiver une entité',
    category: 'Entités',
    props: { entity: prop.entity({ label: 'Entité' }), enabled: prop.boolean({ label: 'Active', default: true }) },
    run: (ctx, p) => {
      ctx.world.require(p.entity).enabled = p.enabled;
    },
  }),
  defineAction({
    id: 'core.setProp',
    label: 'Modifier une propriété d’entité',
    category: 'Entités',
    props: {
      entity: prop.entity({ label: 'Entité' }),
      component: prop.string({ label: 'Composant' }),
      prop: prop.string({ label: 'Propriété' }),
      value: prop.json({ label: 'Valeur' }),
    },
    run: (ctx, p) => ctx.world.require(p.entity).setProp(p.component, p.prop, p.value as JsonValue),
  }),
  defineAction({
    id: 'core.moveEntity',
    label: 'Déplacer un personnage',
    category: 'Entités',
    props: {
      entity: prop.entity({ label: 'Personnage' }),
      target: prop.entity({ label: 'Vers le repère/entité' }),
      position: prop.vec3({ label: 'Ou vers la position' }),
      run: prop.boolean({ label: 'Courir' }),
      wait: prop.boolean({ label: 'Attendre l’arrivée', default: true }),
    },
    run: async (ctx, p, scope) => {
      const e = ctx.world.require(p.entity);
      const dest = entityPos(ctx, p.target, p.position);
      if (!dest) throw new Error(`Destination introuvable pour ${p.entity}`);
      if (scope.skipping) {
        e.setPosition(dest);
        return;
      }
      const r = e.moveTo(dest, { run: p.run });
      if (p.wait) await r;
    },
  }),
  defineAction({
    id: 'core.teleportEntity',
    label: 'Téléporter une entité',
    category: 'Entités',
    props: {
      entity: prop.entity({ label: 'Entité' }),
      target: prop.entity({ label: 'Sur le repère' }),
      position: prop.vec3({ label: 'Ou position' }),
      yaw: prop.number({ label: 'Orientation (°)', default: 0 }),
    },
    run: (ctx, p) => {
      const e = ctx.world.require(p.entity);
      const marker = p.target ? ctx.world.entity(p.target) : null;
      e.setPosition(marker?.position ?? fromTuple(p.position));
      e.setYaw(marker ? marker.yaw : p.yaw);
    },
  }),
  defineAction({
    id: 'core.lookAt',
    label: 'Faire regarder',
    category: 'Entités',
    props: { entity: prop.entity({ label: 'Personnage' }), target: prop.entity({ label: 'Cible (vide = personne, player = joueur)' }) },
    run: (ctx, p) => {
      const e = ctx.world.require(p.entity);
      if (!p.target) e.lookAt(null);
      else if (p.target === 'player') e.lookAt('player');
      else {
        const t = ctx.world.entity(p.target);
        if (t) e.lookAt({ x: t.position.x, y: t.position.y + 1.5, z: t.position.z });
      }
    },
    essential: false,
  }),
  defineAction({
    id: 'core.playAnimation',
    label: 'Jouer une animation',
    category: 'Entités',
    props: {
      entity: prop.entity({ label: 'Personnage' }),
      animation: prop.enum(['idle', 'wave', 'talk', 'point', 'nod', 'shake', 'kneel', 'interact', 'cross', 'surprised', 'sad', 'bow'] as const, { label: 'Animation', default: 'wave' }),
      loop: prop.boolean({ label: 'En boucle' }),
    },
    run: (ctx, p) => ctx.world.require(p.entity).playAnimation(p.animation, { loop: p.loop }),
    essential: false,
  }),
  defineAction({
    id: 'core.setExpression',
    label: 'Changer une expression',
    category: 'Entités',
    props: {
      entity: prop.entity({ label: 'Personnage' }),
      expression: prop.enum(['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried', 'determined'] as const, { label: 'Expression', default: 'neutral' }),
    },
    run: (ctx, p) => ctx.world.require(p.entity).setExpression(p.expression),
  }),
  defineAction({
    id: 'core.say',
    label: 'Réplique au-dessus du personnage',
    category: 'Entités',
    props: { entity: prop.entity({ label: 'Personnage' }), text: prop.text({ label: 'Texte' }), seconds: prop.number({ label: 'Durée (s)', default: 3.5 }) },
    run: (ctx, p) => ctx.world.require(p.entity).say(ctx.t(p.text), p.seconds),
    essential: false,
  }),
  defineAction({
    id: 'core.openDoor',
    label: 'Ouvrir une porte',
    category: 'Entités',
    props: { entity: prop.entity({ label: 'Porte', withComponent: 'core.door' }), silent: prop.boolean({ label: 'Sans son' }) },
    run: (ctx, p) => void ctx.world.require(p.entity).behavior<{ open(o?: { silent?: boolean }): boolean }>('core.door')?.open({ silent: p.silent }),
  }),
  defineAction({
    id: 'core.closeDoor',
    label: 'Fermer une porte',
    category: 'Entités',
    props: { entity: prop.entity({ label: 'Porte', withComponent: 'core.door' }), silent: prop.boolean({ label: 'Sans son' }) },
    run: (ctx, p) => void ctx.world.require(p.entity).behavior<{ close(o?: { silent?: boolean }): boolean }>('core.door')?.close({ silent: p.silent }),
  }),
  // ---- Player & scenes ---------------------------------------------------------------------
  defineAction({
    id: 'core.teleportPlayer',
    label: 'Téléporter le joueur',
    category: 'Joueur',
    props: { spawn: prop.spawn({ label: 'Point d’apparition / repère' }) },
    run: (ctx, p) => ctx.player.teleport(p.spawn),
  }),
  defineAction({
    id: 'core.changeScene',
    label: 'Changer de scène',
    category: 'Joueur',
    props: { scene: prop.scene({ label: 'Scène' }), spawn: prop.string({ label: 'Point d’apparition' }) },
    run: (ctx, p) => ctx.scenes.goTo(p.scene, p.spawn || undefined),
  }),
  defineAction({
    id: 'core.lockPlayer',
    label: 'Bloquer le joueur un instant',
    category: 'Joueur',
    props: { seconds: prop.number({ label: 'Secondes', default: 1, min: 0 }) },
    run: async (ctx, p, scope) => {
      if (scope.skipping) return;
      const lock = ctx.player.lockMovement('action');
      await ctx.time.wait(p.seconds);
      lock.dispose();
    },
    essential: false,
  }),
  // ---- World ----------------------------------------------------------------------------------
  defineAction({
    id: 'core.setBlocks',
    label: 'Modifier des blocs (passage, effondrement…)',
    category: 'Monde',
    description: 'Remplit une boîte de blocs (coins inclus) ; un bloc vide creuse. Sauvegardé avec la partie.',
    props: {
      from: prop.vec3({ label: 'Coin A' }),
      to: prop.vec3({ label: 'Coin B' }),
      block: prop.block({ label: 'Bloc (vide = air)' }),
    },
    run: (ctx, p) => {
      const [x0, x1] = [Math.min(p.from[0], p.to[0]), Math.max(p.from[0], p.to[0])];
      const [y0, y1] = [Math.min(p.from[1], p.to[1]), Math.max(p.from[1], p.to[1])];
      const [z0, z1] = [Math.min(p.from[2], p.to[2]), Math.max(p.from[2], p.to[2])];
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 4096) throw new Error('core.setBlocks : boîte trop grande (4096 blocs maximum).');
      ctx.world.fillBlocks([x0, y0, z0], [x1, y1, z1], p.block || null);
    },
    summarize: (p) => `${p.block || 'air'} de (${p.from.join(', ')}) à (${p.to.join(', ')})`,
  }),
  defineAction({
    id: 'core.grantAbility',
    label: 'Accorder une capacité',
    category: 'Joueur',
    props: { ability: prop.ability({ label: 'Capacité' }) },
    run: (ctx, p) => ctx.player.abilities.grant(p.ability),
  }),
  defineAction({
    id: 'core.revokeAbility',
    label: 'Retirer une capacité',
    category: 'Joueur',
    props: { ability: prop.ability({ label: 'Capacité' }) },
    run: (ctx, p) => ctx.player.abilities.revoke(p.ability),
  }),
  // ---- Multiverse ---------------------------------------------------------------------------
  defineAction({
    id: 'core.grantFragment',
    label: 'Accorder un fragment multivers',
    category: 'Multivers',
    props: { fragment: prop.string({ label: 'Fragment' }) },
    run: (ctx, p) => ctx.multiverse.grantFragment(p.fragment),
  }),
  defineAction({
    id: 'core.setGlobalFlag',
    label: 'Définir un indicateur global',
    category: 'Multivers',
    props: { flag: prop.string({ label: 'Indicateur' }), value: prop.json({ label: 'Valeur', default: true }) },
    run: (ctx, p) => ctx.multiverse.setFlag(p.flag, p.value as JsonValue),
  }),
  defineAction({
    id: 'core.finishCivilization',
    label: 'Terminer la civilisation (retour à la sélection)',
    category: 'Multivers',
    props: {},
    run: (ctx) => {
      ctx.multiverse.markCompleted();
      ctx.events.emit('civ.finished', { civId: ctx.civId });
    },
  }),
  defineAction({
    id: 'core.markCivCompleted',
    label: 'Marquer la civilisation terminée',
    category: 'Multivers',
    props: {},
    run: (ctx) => ctx.multiverse.markCompleted(),
  }),
  // ---- Audio & effects ----------------------------------------------------------------------
  defineAction({
    id: 'core.playSound',
    label: 'Jouer un son',
    category: 'Audio et effets',
    props: { sound: prop.sound({ label: 'Son' }), at: prop.entity({ label: 'Depuis l’entité (vide = interface)' }), volume: prop.number({ label: 'Volume', default: 1, min: 0, max: 2 }) },
    run: (ctx, p) => void ctx.audio.play(p.sound, { at: p.at || undefined, volume: p.volume }),
    essential: false,
  }),
  defineAction({
    id: 'core.music',
    label: 'Changer la musique',
    category: 'Audio et effets',
    props: { music: prop.music({ label: 'Musique (vide = silence)' }), fade: prop.number({ label: 'Fondu (s)', default: 2 }) },
    run: (ctx, p) => ctx.audio.music(p.music || null, { fade: p.fade }),
  }),
  defineAction({
    id: 'core.ambience',
    label: 'Changer l’ambiance sonore',
    category: 'Audio et effets',
    props: { ambience: prop.sound({ label: 'Ambiance (vide = silence)' }), fade: prop.number({ label: 'Fondu (s)', default: 2 }) },
    run: (ctx, p) => ctx.audio.ambience(p.ambience || null, { fade: p.fade }),
  }),
  defineAction({
    id: 'core.fade',
    label: 'Fondu à l’écran',
    category: 'Audio et effets',
    props: {
      opacity: prop.number({ label: 'Opacité (0 = clair, 1 = noir)', default: 1, min: 0, max: 1, step: 0.05 }),
      seconds: prop.number({ label: 'Durée (s)', default: 1 }),
      color: prop.color({ label: 'Couleur', default: '#000000' }),
      wait: prop.boolean({ label: 'Attendre', default: true }),
    },
    run: async (ctx, p, scope) => {
      if (scope.skipping) {
        void ctx.fx.fade(p.opacity, 0, p.color);
        return;
      }
      const r = ctx.fx.fade(p.opacity, p.seconds, p.color);
      if (p.wait) await r;
    },
  }),
  defineAction({
    id: 'core.flash',
    label: 'Éclair à l’écran',
    category: 'Audio et effets',
    props: { color: prop.color({ label: 'Couleur', default: '#ffffff' }), seconds: prop.number({ label: 'Durée (s)', default: 0.6 }) },
    run: (ctx, p) => ctx.fx.flash(p.color, p.seconds),
    essential: false,
  }),
  defineAction({
    id: 'core.shake',
    label: 'Secousse de caméra',
    category: 'Audio et effets',
    props: { intensity: prop.number({ label: 'Intensité', default: 0.3, min: 0, max: 2 }), seconds: prop.number({ label: 'Durée (s)', default: 0.8 }) },
    run: (ctx, p) => ctx.fx.shake(p.intensity, p.seconds),
    essential: false,
  }),
  defineAction({
    id: 'core.environment',
    label: 'Changer l’environnement (ciel, brouillard...)',
    category: 'Audio et effets',
    props: { patch: prop.json({ label: 'Modifications (JSON)', default: {} }), seconds: prop.number({ label: 'Transition (s)', default: 2 }) },
    run: (ctx, p) => ctx.fx.environment((p.patch ?? {}) as Record<string, unknown>, p.seconds),
  }),
  defineAction({
    id: 'core.fx',
    label: 'Effet de présentation (pack)',
    category: 'Audio et effets',
    props: { channel: prop.string({ label: 'Canal' }), payload: prop.json({ label: 'Données', default: {} }) },
    run: (ctx, p) => ctx.fx.custom(p.channel, (p.payload ?? {}) as Record<string, unknown>),
    essential: false,
  }),
];
