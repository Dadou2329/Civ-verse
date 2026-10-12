import { useSession, useSessionTick, useInterval, useT } from '../hooks';
import { KeyCap } from '../ui/common';
import { iconDataUrl } from '../ui/icons';

export function AbilityBar() {
  const session = useSession();
  useSessionTick();
  useInterval(200);
  const t = useT();
  const civ = session.civ;
  if (!civ) return null;
  const ids = [...session.player.abilities].filter((id) => civ.abilities.has(id));
  if (ids.length === 0) return null;
  return (
    <div className="cv-abilities" data-testid="abilities">
      {ids.map((id) => {
        const a = civ.abilities.get(id)!;
        const cd = session.player.cooldowns.get(id) ?? 0;
        const ratio = a.cooldown ? Math.min(1, cd / a.cooldown) : 0;
        return (
          <div key={id} className={`cv-ability ${cd > 0 ? 'is-cooling' : ''}`} title={t(a.description)}>
            <img src={iconDataUrl(a.icon)} alt="" />
            <div className="cv-ability__cooldown" style={{ height: `${ratio * 100}%` }} />
            <KeyCap code={a.key} />
            <span className="cv-ability__name">{t(a.name)}</span>
          </div>
        );
      })}
    </div>
  );
}
