/**
 * Abstract portrait of a memory shard: a faceted gem in the shard's color (no faces, no
 * photographs — memories are perceptions, not proofs).
 */
export function Gem({ color, size = 34, dim = false, empty = false }: { color?: string; size?: number; dim?: boolean; empty?: boolean }) {
  if (empty || !color) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <polygon points="16,3 27,12 23,28 9,28 5,12" fill="none" stroke="rgba(214,180,255,0.45)" strokeWidth="1.5" strokeDasharray="3 2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ opacity: dim ? 0.45 : 1, filter: dim ? 'grayscale(0.7)' : `drop-shadow(0 0 6px ${color})` }}>
      <polygon points="16,3 27,12 23,28 9,28 5,12" fill={color} />
      <polygon points="16,3 27,12 16,15 5,12" fill="rgba(255,255,255,0.35)" />
      <polygon points="16,15 23,28 9,28" fill="rgba(0,0,0,0.22)" />
      <polyline points="5,12 16,15 27,12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      <line x1="16" y1="15" x2="16" y2="28" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
    </svg>
  );
}
