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
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] text-sm font-medium text-[var(--muted)]">
        Moves
      </div>
      <div className="max-h-[400px] overflow-y-auto p-2">
        {pairs.length === 0 && (
          <p className="text-[var(--muted)] text-sm text-center py-4">No moves yet</p>
        )}
        <div className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5 text-sm">
          {pairs.map((pair) => (
            <div key={pair.number} className="contents">
              <span className="text-[var(--muted)] text-right pr-2">{pair.number}.</span>
              <button
                onClick={() => onMoveClick(((pair.number - 1) * 2))}
                className={`text-left px-1.5 py-0.5 rounded hover:bg-[var(--primary)] transition-colors ${
                  currentMoveIndex === (pair.number - 1) * 2
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--foreground)]'
                }`}
              >
                {pair.white}
              </button>
              {pair.black ? (
                <button
                  onClick={() => onMoveClick(((pair.number - 1) * 2) + 1)}
                  className={`text-left px-1.5 py-0.5 rounded hover:bg-[var(--primary)] transition-colors ${
                    currentMoveIndex === (pair.number - 1) * 2 + 1
                      ? 'bg-[var(--primary)] text-white'
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
    </div>
  );
}
