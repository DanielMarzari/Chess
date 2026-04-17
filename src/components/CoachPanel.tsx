'use client';

import { GraduationCap, Eye, CheckCircle, XCircle, ArrowRight, Lightbulb, GitBranch, Undo2 } from 'lucide-react';
import { NAG_META } from '@/lib/accuracy';
import type { CoachExplanation } from '@/lib/coaching';
import { severityLabel } from '@/lib/coaching';

export interface DemoMove {
  uci: string;
  san: string;
  fenBefore: string;
  fenAfter: string;
  mover: 'w' | 'b'; // color who played the move
  ply: number; // half-move number within the demo line (0-indexed)
}

// Up to 3 contest cycles, each gets its own color tint
export const CONTEST_COLORS = [
  { bg: 'rgba(168, 85, 247, 0.18)', border: '#a855f7', text: '#c084fc' }, // purple
  { bg: 'rgba(20, 184, 166, 0.18)', border: '#14b8a6', text: '#2dd4bf' }, // teal
  { bg: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#fbbf24' }, // amber
];

export type CoachSubPhase =
  | 'analyzing' // engine still computing best move
  | 'pausing' // brief "coach activated" beat before demo starts
  | 'demo' // auto-playing the consequences of the bad move
  | 'rewinding' // brief visual before returning to pre-move position
  | 'explain' // showing what went wrong + prompt to try again
  | 'retry-analyzing' // engine is analyzing the student's retry attempt to find its refutation
  | 'retry-demo' // user just tried a wrong move; playing out engine's refutation of it
  | 'retry-wrong' // just tried but it wasn't right (after retry-demo completes)
  | 'retry-correct' // just tried and it was the engine's exact #1
  | 'retry-good' // not THE best, but reasonable enough — apply + celebrate, show what was best
  | 'reveal' // out of tries or gave up — here's the answer
  | 'contesting' // user has jumped into the demo line at some position; needs to play an alternative
  | 'contest-analyzing' // engine analyzing the user's contest attempt (full strength)
  | 'contest-playout' // engine playing out its response to the contest at full strength
  | 'contest-result' // showing what happened in the contest variation
  | 'done'; // finished, waiting for continue

interface CoachPanelProps {
  subPhase: CoachSubPhase;
  explanation: CoachExplanation | null;
  attemptsLeft: number;
  badMoveSan: string;
  lastAttemptSan: string | null;
  retryRefutationText: string | null; // what happens after a wrong retry attempt
  // Contest-mode props
  demoMoveLog: DemoMove[]; // moves the demo just played out (clickable to contest)
  contestCycle: number; // 0..2, used for color coding contest moves
  contestStartIdx: number | null; // which demo move the user contested
  contestUserSan: string | null; // user's contested move
  contestEngineSan: string | null; // engine's response
  contestResultText: string | null; // outcome description
  onSkip: () => void; // keep bad move, continue
  onShowSolution: () => void; // give up, show best, apply it
  onContinue: () => void; // proceed after reveal / correct answer
  onContestMove: (demoMoveIdx: number) => void; // jump into the demo line at this point
  onContestExit: () => void; // back to the lesson from contest mode (after result)
  onContestCancel: () => void; // bail out of 'contesting' before playing (no cycle spent)
  onHoverDemoMove: (idx: number | null) => void; // preview the position on the board
}

export default function CoachPanel({
  subPhase,
  explanation,
  attemptsLeft,
  badMoveSan,
  lastAttemptSan,
  retryRefutationText,
  demoMoveLog,
  contestCycle,
  contestStartIdx,
  contestUserSan,
  contestEngineSan,
  contestResultText,
  onSkip,
  onShowSolution,
  onContinue,
  onContestMove,
  onContestExit,
  onContestCancel,
  onHoverDemoMove,
}: CoachPanelProps) {
  const inContestFlow =
    subPhase === 'contesting' ||
    subPhase === 'contest-analyzing' ||
    subPhase === 'contest-playout' ||
    subPhase === 'contest-result';
  // Show clickable demo history during retry-wrong / retry-good / reveal /
  // contest-result so the user can branch into "what if" alternatives.
  const showDemoHistory =
    !inContestFlow &&
    demoMoveLog.length > 0 &&
    (subPhase === 'retry-wrong' ||
      subPhase === 'retry-good' ||
      subPhase === 'reveal' ||
      subPhase === 'explain');
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

        {subPhase === 'retry-analyzing' && (
          <div className="text-[var(--muted)] text-[13px] flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Checking what happens after{' '}
            <span className="font-mono font-bold text-[var(--foreground-strong)]">
              {lastAttemptSan}
            </span>
            …
          </div>
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
                <span className="font-mono font-bold">{lastAttemptSan}</span> — best move!
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

        {subPhase === 'retry-good' && (
          <>
            <div className="flex items-center gap-2 text-sm text-[var(--success)] bg-[var(--success)]/10 rounded px-2 py-1.5">
              <CheckCircle size={14} />
              <span>
                <span className="font-mono font-bold">{lastAttemptSan}</span> — good move!
              </span>
            </div>
            {retryRefutationText && (
              <div className="text-[13px] leading-relaxed text-[var(--foreground)] border-l-2 border-[var(--accent)]/50 pl-3">
                {retryRefutationText}
              </div>
            )}
            {explanation?.hintBestMove && (
              <div className="text-xs text-[var(--muted)]">
                Engine's pick was{' '}
                <span className="font-mono font-bold text-[var(--accent)]">
                  {explanation.hintBestMove}
                </span>
                .
              </div>
            )}
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
        {/* Contest sub-phases */}
        {subPhase === 'contesting' && (
          <ContestPanelBody
            cycle={contestCycle}
            heading="Your turn — play any move you want to test."
            subline={
              contestStartIdx !== null
                ? `Branching from move ${contestStartIdx + 1} of the line above.`
                : null
            }
          />
        )}

        {subPhase === 'contest-analyzing' && (
          <ContestPanelBody
            cycle={contestCycle}
            heading={
              <>
                Engine checking your move at full strength
                {contestUserSan ? (
                  <>
                    {' '}
                    (<span className="font-mono font-bold">{contestUserSan}</span>)
                  </>
                ) : null}
                …
              </>
            }
            pulsing
          />
        )}

        {subPhase === 'contest-playout' && (
          <ContestPanelBody
            cycle={contestCycle}
            heading="Watching the engine's reply at full strength…"
            pulsing
          />
        )}

        {subPhase === 'contest-result' && (
          <div
            className="rounded p-2 space-y-1.5 border"
            style={{
              // By the time we're in 'contest-result', contestCycle has already
              // been bumped by finish(), so the current layer index is
              // contestCycle - 1 in the 0-indexed color palette.
              borderColor: CONTEST_COLORS[Math.max(0, contestCycle - 1) % 3].border,
              background: CONTEST_COLORS[Math.max(0, contestCycle - 1) % 3].bg,
            }}
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
              <GitBranch
                size={12}
                style={{ color: CONTEST_COLORS[Math.max(0, contestCycle - 1) % 3].text }}
              />
              <span style={{ color: CONTEST_COLORS[Math.max(0, contestCycle - 1) % 3].text }}>
                Layer {contestCycle}/3 · result
              </span>
            </div>
            <div className="text-[13px] leading-relaxed text-[var(--foreground)]">
              {contestResultText ?? 'Variation played out.'}
            </div>
            {(contestUserSan || contestEngineSan) && (
              <div className="text-xs font-mono text-[var(--muted)]">
                {contestUserSan && (
                  <>
                    You:{' '}
                    <span className="font-bold text-[var(--foreground-strong)]">
                      {contestUserSan}
                    </span>
                  </>
                )}
                {contestUserSan && contestEngineSan && <span className="mx-2">·</span>}
                {contestEngineSan && (
                  <>
                    Engine:{' '}
                    <span className="font-bold text-[var(--foreground-strong)]">
                      {contestEngineSan}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Demo history — shown after a demo plays so the user can branch in.
          Layer depth (contestCycle) semantics: 0 = original refutation,
          1-3 = successive contests. Move buttons get tinted with the
          current layer's color so the nesting is visually obvious. */}
      {showDemoHistory && (
        <div
          className="border-t border-[var(--border)] p-3 space-y-1.5"
          style={
            contestCycle > 0
              ? { background: CONTEST_COLORS[(contestCycle - 1) % 3].bg }
              : undefined
          }
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1"
              style={{
                color:
                  contestCycle > 0
                    ? CONTEST_COLORS[(contestCycle - 1) % 3].text
                    : 'var(--muted)',
              }}
            >
              <GitBranch size={10} />
              {contestCycle === 0
                ? 'Demo line — click to contest'
                : `Variation line · Layer ${contestCycle}/3`}
            </span>
          </div>
          <div
            className="flex flex-wrap gap-1 text-xs font-mono"
            onMouseLeave={() => onHoverDemoMove(null)}
          >
            {demoMoveLog.map((m, i) => {
              const layerColor =
                contestCycle > 0 ? CONTEST_COLORS[(contestCycle - 1) % 3] : null;
              const baseStyle = layerColor
                ? {
                    background: layerColor.bg,
                    borderColor: layerColor.border,
                    color: layerColor.text,
                  }
                : undefined;
              return (
                <button
                  key={i}
                  onClick={() => onContestMove(i)}
                  onMouseEnter={() => onHoverDemoMove(i)}
                  onFocus={() => onHoverDemoMove(i)}
                  onBlur={() => onHoverDemoMove(null)}
                  disabled={contestCycle >= 3}
                  style={baseStyle}
                  className={`px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    layerColor
                      ? 'hover:brightness-125'
                      : m.mover === 'w'
                        ? 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface)] hover:border-[var(--accent)]'
                        : 'bg-[var(--background)]/40 border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)] hover:border-[var(--accent)]'
                  }`}
                  title={`Hover to preview, click to contest`}
                >
                  {m.mover === 'w' ? `${Math.floor(m.ply / 2) + 1}.` : ''}
                  {m.san}
                </button>
              );
            })}
          </div>
          {contestCycle >= 3 && (
            <p className="text-[10px] text-[var(--muted)]">
              Maximum depth reached. Continue the lesson when you're ready.
            </p>
          )}
        </div>
      )}

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

      {/* Contest result footer — back to lesson */}
      {subPhase === 'contest-result' && (
        <div className="border-t border-[var(--border)] p-2">
          <button
            onClick={onContestExit}
            className="w-full py-1.5 rounded text-xs flex items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--foreground)] transition-colors"
          >
            <Undo2 size={12} /> Back to the lesson
          </button>
        </div>
      )}

      {/* Contesting-in-progress: Cancel so clicking the wrong demo move
          isn't punitive (no cycle spent, restores prior state). */}
      {subPhase === 'contesting' && (
        <div className="border-t border-[var(--border)] p-2">
          <button
            onClick={onContestCancel}
            className="w-full py-1.5 rounded text-xs flex items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Undo2 size={12} /> Cancel — I picked the wrong move
          </button>
        </div>
      )}
    </div>
  );
}

function ContestPanelBody({
  cycle,
  heading,
  subline,
  pulsing,
}: {
  cycle: number;
  heading: React.ReactNode;
  subline?: React.ReactNode;
  pulsing?: boolean;
}) {
  const c = CONTEST_COLORS[cycle % 3];
  return (
    <div className="rounded p-2 space-y-1 border" style={{ borderColor: c.border, background: c.bg }}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
        <GitBranch size={12} style={{ color: c.text }} />
        <span style={{ color: c.text }}>Layer {cycle + 1}/3</span>
        {pulsing && (
          <span
            className="ml-auto inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: c.border }}
          />
        )}
      </div>
      <div className="text-[13px] leading-relaxed text-[var(--foreground)]">{heading}</div>
      {subline && <div className="text-xs text-[var(--muted)]">{subline}</div>}
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
