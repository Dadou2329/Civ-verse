/**
 * Validation from the Studio: the civilization is booted headless on the working copies
 * (unsaved changes included) and every reference, text key and schema is checked — the same
 * checks as `npm run validate`.
 */
import { GameSession } from '@engine/core/sim/session';
import { HeadlessUi } from '@engine/core/sim/uiBridge';
import { extractCodeKeys, validateCivilization, type ValidationReport } from '@engine/core/packs/validate';
import { OverlayContentProvider } from '@engine/platform/overlayContent';
import type { Studio } from './studio';

export async function validateInStudio(studio: Studio): Promise<ValidationReport | null> {
  const pack = studio.packId;
  if (!pack) return null;
  const deps = studio.session.manifests.get(pack)?.dependencies ?? [];
  const provider = new OverlayContentProvider(studio.provider, studio.project.overlay([pack, ...deps]));
  const session = await GameSession.create({ mode: 'headless', provider, ui: new HeadlessUi(), locale: 'fr-FR' });
  try {
    // Texts used literally in the pack's code (`t('pack.x')`) must exist too.
    const scripts = studio.project.docsOf(pack, 'script').filter((d) => !/^(seed|tests)\//.test(d.rel));
    await Promise.all(scripts.filter((d) => !d.loaded).map((d) => studio.project.load(d.path).catch(() => d)));
    const codeKeys = scripts
      .filter((d) => d.loaded && typeof d.data === 'string')
      .flatMap((d) => extractCodeKeys(d.data as string).map((key) => ({ key, file: d.rel })));
    return await validateCivilization(session, pack, { codeKeys });
  } finally {
    session.dispose();
  }
}
