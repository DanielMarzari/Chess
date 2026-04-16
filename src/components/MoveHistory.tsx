'use client';

import { useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { MessageSquare } from 'lucide-react';
import type { NagType } from '@/lib/accuracy';
import { NAG_META } from '@/lib/accuracy';
import type { Notation } from '@/hooks/useSettings';

interface MoveHistoryProps {
  moves: string[]; // SAN
  nags: (NagType | null)[];
  annotations: Record<number, string>;
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  onAnnotate: (index: number, x: number, y: number) => void;
  notation?: Notation;
}

const FIGURINE_MAP: Record<string, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
};

function toFigurine(san: string): string {
  if (!san) return san;
  // Castling stays as-is
  if (san.startsWith('O-O')) return san;
  const first = san[0];
  if (FIGURINE_MAP[first]) {
    return FIGURINE_MAP[first] + san.slice(1);
  }
  return san; // pawn moves — no prefix
}

function toLongAlgebraic(
  san: string,
  verbose: {
    piece: string;
    from: string;
    to: string;
    captured?: string;
    promotion?: string;
    flags: string;
  } | null
): string {
  if (!verbose) return san;
  if (san.startsWith('O-O')) return san;
  const pieceChar = verbose.piece === 'p' ? '' : verbose.piece.toUpperCase();
  const sep = verbose.captured || verbose.flags.includes('e') ? 'x' : '-';
  const promo = verbose.promotion ? '=' + verbose.promotion.toUpperCase() : '';
  const suffix = san.includes('#') ? '#' : san.includes('+') ? '+' : '';
  return `${pieceChar}${verbose.from}${sep}${verbose.to}${promo}${suffix}`;
}

export default function MoveHistory({
  moves,
  nags,
  annotations,
  currentMoveIndex,
  onMoveClick,
  onAnnotate,
  notation = 'san',
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Format moves according to the chosen notation. Long algebraic needs verbose
  // move info which we compute once by replaying the game through chess.js.
  const displayMoves = useMemo(() => {
    if (notation === 'san') return moves;
    if (notation === 'figurine') return moves.map(toFigurine);
    // long algebraic
    const g = new Chess();
    return moves.map((san) => {
      try {
        const m = g.move(san);
        if (!m) return san;
        return toLongAlgebraic(san, {
          piece: m.piece,
          from: m.from,
          to: m.to,
          captured: m.captured,
          promotion: m.promotion,
          flags: m.flags,
        });
      } catch {
        return san;
      }
    });
  }, [moves, notation]);

  const pairs: {
    number: number;
    white: string;
    whiteIdx: number;
    black?: string;
    blackIdx?: number;
  }[] = [];
  for (let i = 0; i < displayMoves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: displayMoves[i],
      whiteIdx: i,
      black: displayMoves[i + 1],
      blackIdx: i + 1 < displayMoves.length ? i + 1 : undefined,
    });
  }

  function renderMoveCell(label: string, idx: number) {
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
          active
            ? 'bg-[var(--accent)]/20 text-[var(--foreground-strong)] font-semibold'
            : 'text-[var(--foreground)]'
        }`}
        style={meta && !active ? { backgroundColor: meta.bg } : undefined}
        title={meta ? `${meta.label}${annotations[idx] ? ' · ' + annotations[idx] : ''}` : annotations[idx] || ''}
      >
        <span className="truncate">{label}</span>
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
