import type { StudioTab } from '../core/studio';
import { CinematicEditor } from './CinematicEditor';
import { CharactersEditor, ItemsEditor, LocaleEditor, PrefabEditor, RulesEditor } from './DataEditors';
import { DialogueEditor } from './DialogueEditor';
import { LogicDocEditor } from './LogicDocEditor';
import { ManifestEditor } from './ManifestEditor';
import { QuestEditor } from './QuestEditor';

/** The editor of a document tab (scenes are edited in the viewport and the inspector). */
export function DocumentView({ tab }: { tab: StudioTab }) {
  switch (tab.kind) {
    case 'dialogue':
      return <DialogueEditor path={tab.path} />;
    case 'quest':
      return <QuestEditor path={tab.path} />;
    case 'cinematic':
      return <CinematicEditor path={tab.path} />;
    case 'logic':
      return <LogicDocEditor path={tab.path} />;
    case 'items':
      return <ItemsEditor path={tab.path} />;
    case 'characters':
      return <CharactersEditor path={tab.path} />;
    case 'rules':
      return <RulesEditor path={tab.path} />;
    case 'locale':
      return <LocaleEditor path={tab.path} />;
    case 'manifest':
      return <ManifestEditor path={tab.path} />;
    case 'prefab':
      return <PrefabEditor path={tab.path} />;
    default:
      return <div className="st-empty">Ce type de fichier ne s’édite pas dans le Studio.</div>;
  }
}
