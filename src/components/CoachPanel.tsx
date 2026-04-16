'use client';

import { GraduationCap, Eye, CheckCircle, XCircle, ArrowRight, Lightbulb } from 'lucide-react';
import { NAG_META } from '@/lib/accuracy';
import type { CoachExplanation } from '@/lib/coaching';
import { severityLabel } from '@/lib/coaching';

export type CoachSubPhase =
  | 'analyzing' // engine still computing best move
  | 'pausing' // brief "coach activated" beat before demo starts
  | 'demo' // auto-playing the consequences of the bad move
  | 'rewinding' // brief visual before returning to pre-move position
  | 'explain' // showing what went wrong + prompt to try again
  | 'retry-demo' // user just tried a wrong move; playing out opponent's refutation of it
  | 'retry-wrong' // just tried but it wasn't right (after retry-demo completes)
  | 'retry-correct' // just tried and it was a good move
  | 'reveal' // out of tries or gave up — here's the answer
  | 'done'; // finished, waiting for continue

interface CoachPanelProps {
  subPhase: CoachSubPhase;
  explanation: CoachExplanation | null;
  attemptsLeft: number;
  badMoveSan: string;
  lastAttemptSan: string | null;
  retryRefutationText: string | null; // what happens after a wrong retry attempt
  onSkip: () => void; // keep bad move, continue
  onShowSolution: () => void; // give up, show best, apply it
  onContinue: () => void; // proceed after reveal / correct answer
}

export default function CoachPanel({
  subPhase,
  explanation,
  attemptsLeft,
  badMoveSan,
  lastAttemptSan,
  retryRefutationText,
  onSkip,
  onShowSolution,
  onContinue,
}: CoachPanelProps) {
  const severity = explanation?.severity ?? 'blunder';
  const meta = NAG_META[severity];

  return (
    <div className="bg-[var(--surface)] rounded border-2 border-[var(--accent)] overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--accent)]/10">
        <GraduationCap size={16} className="text-[var(--accent)]" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-[var(--foreground-strong)]">
          Coach
        </span>
        <span
          className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded"
          style={{ color: meta.color, background: meta.bg }}
        >
          {meta.symbol} {severityLabel(severity)}
        </span>
      </div>

      <div className="p-3 space-y-3 text-sm">
        {subPhase === 'analyzing' && (
          <div className="text-[var(--muted)] animate-pulse">
            Analyzing your move… give me a second.
          </div>
        )}

        {subPhase === 'pausing' && (
          <div className="text-[var(--foreground-strong)]">
            Hold up —{' '}
            <span className="font-mono font-bold">{badMoveSan}</span> looks shaky. Let me show
            you what happens…
          </div>
        )}

        {subPhase === 'demo' && (
          <div className="text-[var(--foreground)] text-[13px] leading-relaxed">
            Watch what your opponent can do after{' '}
            <span className="font-mono font-bold text-[var(--foreground-strong)]">{badMoveSan}</span>.
          </div>
        )}

        {subPhase === 'rewinding' && (
          <div className="text-[var(--muted)] flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Rewinding to before your move…
          </div>
        )}

        {/* The move that triggered coaching (shown after demo) */}
        {(subPhase === 'explain' ||
          subPhase === 'retry-wrong' ||
          subPhase === 'retry-correct' ||
          subPhase === 'reveal' ||
          subPhase === 'done') && (
          <div className="text-xs text-[var(--muted)]">
            Your move:{' '}
            <span className="font-mono font-bold text-[var(--foreground-strong)]">
              {badMoveSan}
            </span>
          </div>
        )}

        {/* Explanation of what went wrong */}
        {explanation &&
          (subPhase === 'explain' ||
            subPhase === 'retry-wrong' ||
            subPhase === 'retry-correct' ||
            subPhase === 'reveal' ||
            subPhase === 'done') && (
            <div className="text-[13px] leading-relaxed text-[var(--foreground)]">
              {explanation.whyBad}
            </div>
          )}

        {/* Phase-specific prompts */}
        {subPhase === 'explain' && (
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
              <Lightbulb size={14} />
              <span>Try to find a better move.</span>
            </div>
            <AttemptsIndicator left={attemptsLeft} max={3} />
          </>
        )}

        {subPhase === 'retry-demo' && (
          <>
            <div className="text-[13px] leading-relaxed text-[var(--foreground)]">
              Watch what happens after{' '}
              <span className="font-mono font-bold">{lastAttemptSan}</span>…
            </div>
          </>
        )}

        {subPhase === 'retry-wrong' && (
          <>
            <div className="flex items-start gap-2 text-sm text-[var(--danger)] bg-[var(--danger)]/10 rounded px-2 py-1.5">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                <span className="font-mono font-bold">{lastAttemptSan}</span> isn't the best.
                {retryRefutationText && (
                  <span className="text-[var(--foreground)] block text-[12px] mt-1">
                    {retryRefutationText}
                  </span>
                )}
              </span>
            </div>
            <AttemptsIndicator left={attemptsLeft} max={3} />
          </>
        )}

        {subPhase === 'retry-correct' && explanation && (
          <>
            <div className="flex items-center gap-2 text-sm text-[var(--success)] bg-[var(--success)]/10 rounded px-2 py-1.5">
              <CheckCircle size={14} />
              <span>
                <span className="font-mono font-bold">{lastAttemptSan}</span> is a good move!
              </span>
            </div>
            <div className="text-[13px] leading-relaxed text-[var(--foreground)] border-l-2 border-[var(--accent)] pl-3">
              {explanation.whyBest}
            </div>
            <button
              onClick={onContinue}
              className="w-full py-2 rounded text-sm flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold transition-colors"
            >
              Continue Game <ArrowRight size={14} />
            </button>
          </>
        )}

        {subPhase === 'reveal' && explanation && (
          <>
            <div className="border-t border-[var(--border)] pt-3 space-y-2">
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                Best move
              </div>
              <div className="font-mono text-lg font-bold text-[var(--accent)]">
                {explanation.hintBestMove}
              </div>
              <div className="text-[13px] leading-relaxed text-[var(--foreground)]">
                {explanation.whyBest}
              </div>
            </div>
            <button
              onClick={onContinue}
              className="w-full py-2 rounded text-sm flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold transition-colors"
            >
              Play the best move &amp; continue <ArrowRight size={14} />
            </button>
          </>
        )}
      </div>

      {/* Footer actions — shown during explain / retry-wrong */}
      {(subPhase === 'explain' || subPhase === 'retry-wrong') && (
        <div className="border-t border-[var(--border)] p-2 grid grid-cols-2 gap-2">
          <button
            onClick={onShowSolution}
            className="py-1.5 rounded text-xs flex items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--foreground)] transition-colors"
            title="Give up and see the best move"
          >
            <Eye size={12} /> Show answer
          </button>
          <button
            onClick={onSkip}
            className="py-1.5 rounded text-xs flex items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--muted)] transition-colors"
            title="Keep your original move and continue"
          >
            Skip lesson
          </button>
        </div>
      )}
    </div>
  );
}

function AttemptsIndicator({ left, max }: { left: number; max: number }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
      <span>Tries left:</span>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < left ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
