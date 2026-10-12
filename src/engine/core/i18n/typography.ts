/**
 * French typography helpers for authored texts.
 *
 * The French texts of the game use the typographic apostrophe (’, U+2019) for elisions
 * (« l’atelier », « aujourd’hui »). Authors usually type the straight one: the Studio converts
 * it as they type, and the localization tests reject straight apostrophes in fr-FR tables.
 * Only an apostrophe between two letters is converted, so quotes in code-like values and a
 * trailing apostrophe still being typed are left alone (it is converted on the next keystroke).
 */
const ELISION = /(?<=\p{L})'(?=\p{L})/gu;

export function frenchApostrophes(text: string): string {
  return text.includes("'") ? text.replace(ELISION, '’') : text;
}

/** True when the text still contains a straight apostrophe used as an elision. */
export function hasStraightElision(text: string): boolean {
  ELISION.lastIndex = 0;
  return ELISION.test(text);
}
