/**
 * The six glyphs engraved on Verrou's dials and on the gallery gate (original line drawings,
 * 24 × 24 viewBox, stroke = currentColor).
 */
const PATHS: Record<string, string> = {
  lune: 'M15.5 4.5a8 8 0 1 0 4 13.6A7 7 0 0 1 15.5 4.5z',
  cle: 'M8.5 15.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12.5 11.5h8M17.5 11.5v3M20.5 11.5v2',
  tour: 'M7 21V9l-1.5-1.5V4h3v2h2V4h3v2h2V4h3v3.5L17 9v12zM10.5 21v-4a1.5 1.5 0 0 1 3 0v4',
  oeil: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  main: 'M8 20v-7l-2.5-3M8 13V5.5a1.3 1.3 0 0 1 2.6 0V12M10.6 12V4a1.3 1.3 0 0 1 2.6 0v8M13.2 12V5a1.3 1.3 0 0 1 2.6 0v7.5M15.8 12.5V8a1.3 1.3 0 0 1 2.6 0v6.5c0 3.5-2.5 5.5-5.5 5.5H8',
  pont: 'M2.5 16.5h19M4 16.5v4M20 16.5v4M4 16.5a8 8 0 0 1 16 0M8 16.5v-3.2M12 16.5v-4.4M16 16.5v-3.2',
};

export function Glyph({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? 'M12 4v16M4 12h16'} />
    </svg>
  );
}

/** Small plaque shape tinted per rank (grey mark, golden line, double blue seal). */
export function PlaqueIcon({ rank, size = 34 }: { rank: number; size?: number }) {
  const metal = rank >= 2 ? '#aeb7c0' : rank === 1 ? '#a06c43' : '#8e8e8c';
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 36 26" aria-hidden="true">
      <rect x="1" y="1" width="34" height="24" rx="3" fill={metal} stroke="rgba(0,0,0,0.45)" />
      <rect x="4" y="4" width="28" height="18" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" />
      {rank <= 0 && <rect x="14" y="9" width="8" height="8" rx="1" fill="#5d5d5b" />}
      {rank === 1 && (
        <>
          <rect x="5" y="12" width="26" height="2" fill="#e3b84d" />
          {[10, 17, 23].map((x) => (
            <rect key={x} x={x} y="8" width="2" height="4" fill="#e3b84d" />
          ))}
        </>
      )}
      {rank >= 2 && (
        <>
          <circle cx="12" cy="13" r="4.2" fill="none" stroke="#5d9eea" strokeWidth="2" />
          <circle cx="24" cy="13" r="4.2" fill="none" stroke="#5d9eea" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
