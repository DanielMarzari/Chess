'use client';

import { useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { NagType } from '@/lib/accuracy';
import { NAG_META } from '@/lib/accuracy';

interface MoveHistoryProps {
  moves: string[];
  nags: (NagType | null)[];
  annotations: Record<number, string>;
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  onAnnotate: (index: number, x: number, y: number) => void;
}

export default function MoveHistory({
  moves,
  nags,
  annotations,
  currentMoveIndex,
  onMoveClick,
  onAnnotate,
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const pairs: { number: number; white: string; whiteIdx: number; black?: string; blackIdx?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      whiteIdx: i,
      black: moves[i + 1],
      blackIdx: i + 1 < moves.length ? i + 1 : undefined,
    });
  }

  function renderMoveCell(san: string, idx: number) {
    const nag = nags[idx];
    const meta = nag ? NAG_META[nag] : null;
    const active = currentMoveIndex === idx;
    const hasAnnotation = !!annotations[idx];

    return (
      <button
        onClick={() => onMoveClick(idx)}
        onContextMenu={(e) => {
          e.preventDefault();
          onAnnotate(idx, e.clientX, e.clientY);
        }}
        className={`text-left px-2 py-1 flex items-center gap-1 hover:bg-[var(--surface-2)] transition-colors w-full ${
          active ? 'bg-[var(--accent)]/20 text-[var(--foreground-strong)] font-semibold' : 'text-[var(--foreground)]'
        }`}
        style={meta && !active ? { backgroundColor: meta.bg } : undefined}
        title={meta ? `${meta.label}${annotations[idx] ? ' · ' + annotations[idx] : ''}` : annotations[idx] || ''}
      >
        <span className="truncate">{san}</span>
        {meta?.symbol && (
          <span className="font-mono text-[11px] shrink-0" style={{ color: meta.color }}>
            {meta.symbol}
          </span>
        )}
        {hasAnnotation && <MessageSquare size={10} className="text-[var(--muted)] shrink-0 ml-auto" />}
      </button>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)] flex items-center justify-between">
        <span>Moves</span>
        <span className="normal-case text-[10px] text-[var(--muted)]">
          right-click to annotate
        </span>
      </div>
      <div ref={scrollRef} className="max-h-[280px] overflow-y-auto">
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
            {renderMoveCell(pair.white, pair.whiteIdx)}
            {pair.black && pair.blackIdx !== undefined ? (
              renderMoveCell(pair.black, pair.blackIdx)
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
