import { useInteractionTarget, useController } from '../hooks';
import { KeyCap } from '../ui/common';

/** "[E] Parler à Mira" prompt under the crosshair. */
export function InteractionPrompt() {
  const target = useInteractionTarget();
  const { settings } = useController();
  if (!target) return null;
  const rows = [
    target.primary && { so: target.primary, key: settings.bindings.interact[0] },
    target.secondary && { so: target.secondary, key: settings.bindings.secondary[0] },
  ].filter(Boolean) as { so: NonNullable<typeof target.primary>; key: string | undefined }[];
  return (
    <div className="cv-prompt" data-testid="prompt">
      {rows.map(({ so, key }) => (
        <div key={so.source + so.offer.label} className={`cv-prompt__row cv-prompt__row--${so.offer.tone ?? 'default'} ${so.offer.enabled === false ? 'is-disabled' : ''}`}>
          <KeyCap code={key} />
          <span className="cv-prompt__label">{so.offer.label}</span>
          {so.offer.detail && <span className="cv-prompt__detail">{so.offer.detail}</span>}
        </div>
      ))}
    </div>
  );
}

export function Crosshair() {
  const target = useInteractionTarget();
  return <div className={`cv-crosshair ${target ? 'is-active' : ''}`} aria-hidden="true" />;
}
