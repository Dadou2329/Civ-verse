/**
 * Entity templates of the « Ajouter » menu. `texts` gives the French text of text props: the
 * Studio creates a localization key in the pack for each of them, so a new entity never shows
 * an untranslated identifier in the game.
 */
export interface EntityTemplate {
  id: string;
  label: string;
  category: string;
  /** Suggested entity id. */
  base: string;
  components: Record<string, Record<string, unknown>>;
  /** "component.prop" or "component.prop.<index>" → French text. */
  texts?: Record<string, string>;
}

export const ENTITY_TEMPLATES: EntityTemplate[] = [
  { id: 'npc', label: 'Personnage', category: 'Personnages', base: 'personnage', components: { 'core.npc': { character: 'core:citizen_a' } }, texts: { 'core.npc.name': 'Nouveau personnage' } },
  { id: 'door', label: 'Porte', category: 'Monde', base: 'porte', components: { 'core.door': { model: 'core:door_wood' } }, texts: { 'core.door.name': 'la porte' } },
  { id: 'model', label: 'Décor (modèle)', category: 'Monde', base: 'decor', components: { 'core.model': { model: 'core:barrel' } } },
  { id: 'light', label: 'Lumière', category: 'Monde', base: 'lumiere', components: { 'core.light': { color: '#ffd8a0', level: 12, offset: [0, 0, 0] } } },
  {
    id: 'sign',
    label: 'Panneau',
    category: 'Monde',
    base: 'panneau',
    components: { 'core.sign': { size: [2, 0.5, 0.05], style: 'plaque', color: '#2a1d12', background: '#d9c39a' } },
    texts: { 'core.sign.text': 'NOUVEAU PANNEAU' },
  },
  { id: 'particles', label: 'Particules', category: 'Monde', base: 'particules', components: { 'core.particles': { preset: 'dust', color: '#fff2d8', rate: 1, size: [4, 3, 4] } } },
  { id: 'sound', label: 'Source sonore', category: 'Monde', base: 'son', components: { 'core.sound': { sound: 'core:amb_wind', volume: 0.6 } } },
  {
    id: 'pickup',
    label: 'Objet à ramasser',
    category: 'Interactions',
    base: 'objet',
    components: { 'core.model': { model: 'core:crate' }, 'core.pickup': { item: '' } },
  },
  {
    id: 'readable',
    label: 'Document à lire',
    category: 'Interactions',
    base: 'document',
    components: { 'core.model': { model: 'core:books_stack' }, 'core.readable': { style: 'paper', pages: [''] } },
    texts: { 'core.readable.title': 'Document', 'core.readable.pages.0': 'Le texte du document.' },
  },
  {
    id: 'interactable',
    label: 'Point d’interaction',
    category: 'Interactions',
    base: 'interaction',
    components: { 'core.interactable': { actions: [] } },
    texts: { 'core.interactable.prompt': 'Examiner' },
  },
  { id: 'trigger', label: 'Déclencheur', category: 'Logique', base: 'declencheur', components: { 'core.trigger': { size: [2, 2.5, 2], once: true, onEnter: [] } } },
  { id: 'zone', label: 'Zone nommée', category: 'Logique', base: 'zone', components: { 'core.zone': { size: [10, 6, 10] } }, texts: { 'core.zone.name': 'Nouveau lieu' } },
  { id: 'marker', label: 'Repère', category: 'Logique', base: 'repere', components: { 'core.marker': {} } },
  { id: 'spawn', label: 'Point d’apparition', category: 'Logique', base: 'apparition', components: { 'core.spawn': {} } },
  { id: 'portal', label: 'Passage vers une scène', category: 'Logique', base: 'passage', components: { 'core.portal': { mode: 'walk', size: [2, 3, 1] } } },
];
