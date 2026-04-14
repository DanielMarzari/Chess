'use client';

interface MoveHistoryProps {
  moves: string[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
}

export default function MoveHistory({ moves, currentMoveIndex, onMoveClick }: MoveHistoryProps) {
  const pairs: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        Moves
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {pairs.length === 0 && (
          <p className="text-[var(--muted)] text-sm text-center py-6">No moves yet</p>
        )}
        {pairs.map((pair) => (
          <div
            key={pair.number}
            className="grid grid-cols-[2.5rem_1fr_1fr] border-b border-[var(--border)]/50 text-sm font-mono"
          >
            <span className="text-[var(--muted)] text-right px-2 py-1 bg-[var(--background)]/40">
              {pair.number}
            </span>
            <button
              onClick={() => onMoveClick((pair.number - 1) * 2)}
              className={`text-left px-2 py-1 hover:bg-[var(--surface-2)] transition-colors ${
                currentMoveIndex === (pair.number - 1) * 2
                  ? 'bg-[var(--accent)]/20 text-[var(--foreground-strong)] font-semibold'
                  : 'text-[var(--foreground)]'
              }`}
            >
              {pair.white}
            </button>
            {pair.black ? (
              <button
                onClick={() => onMoveClick((pair.number - 1) * 2 + 1)}
                className={`text-left px-2 py-1 hover:bg-[var(--surface-2)] transition-colors ${
                  currentMoveIndex === (pair.number - 1) * 2 + 1
                    ? 'bg-[var(--accent)]/20 text-[var(--foreground-strong)] font-semibold'
                    : 'text-[var(--foreground)]'
                }`}
              >
                {pair.black}
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
