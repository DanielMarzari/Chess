'use client';

import { useState } from 'react';
import { ScatterChart } from 'lucide-react';
import type { Game } from '@/lib/queries';

type Outcome = 'win' | 'loss' | 'draw' | 'ongoing' | null;

interface ScatterPoint {
  userElo: number;
  oppElo: number;
  outcome: Exclude<Outcome, null | 'ongoing'>;
  date: string;
  coachingMoments: number;
  gameNum: number;
}

interface RatingScatterProps {
  games: Game[];
  outcomeOf: (g: Game) => Outcome;
}

const OUTCOME_COLOR = {
  win: '#22c55e',
  loss: '#ef4444',
  draw: '#94a3b8',
} as const;

const SIZE = 300; // square canvas
const PAD = 38; // room for axis labels

function parseCpuElo(name: string | null): number | null {
  if (!name) return null;
  const match = name.match(/\((\d{3,4})\)/);
  return match ? parseInt(match[1]) : null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function RatingScatter({ games, outcomeOf }: RatingScatterProps) {
  const [hover, setHover] = useState<ScatterPoint | null>(null);

  // Build scatter data — only games that have BOTH a recorded user_rating
  // and a parseable CPU opponent ELO, and that finished (W/L/D).
  const points: ScatterPoint[] = [];
  const sorted = [...games].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  sorted.forEach((g, i) => {
    const userElo = typeof g.user_rating === 'number' ? g.user_rating : null;
    const whiteElo = parseCpuElo(g.white);
    const blackElo = parseCpuElo(g.black);
    const oppElo = whiteElo ?? blackElo;
    if (userElo === null || oppElo === null) return;
    const outcome = outcomeOf(g);
    if (outcome !== 'win' && outcome !== 'loss' && outcome !== 'draw') return;
    points.push({
      userElo,
      oppElo,
      outcome,
      date: g.created_at,
      coachingMoments: g.coaching_moments ?? 0,
      gameNum: i + 1,
    });
  });

  if (points.length === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex items-center gap-3">
        <div className="p-2 rounded bg-[var(--accent)]/10">
          <ScatterChart size={16} className="text-[var(--accent)]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--foreground-strong)]">
            Opponent strength scatter
          </div>
          <div className="text-xs text-[var(--muted)]">
            Finish at least one rated game vs. the computer to populate this chart.
          </div>
        </div>
      </div>
    );
  }

  // Auto-scale axes with a symmetric range so y = x sits at 45°.
  const allRatings = points.flatMap((p) => [p.userElo, p.oppElo]);
  const minR = Math.min(...allRatings);
  const maxR = Math.max(...allRatings);
  const range = Math.max(120, maxR - minR);
  const pad = Math.max(40, range * 0.1);
  const axisMin = Math.floor((minR - pad) / 20) * 20;
  const axisMax = Math.ceil((maxR + pad) / 20) * 20;

  const inner = SIZE - PAD - PAD;
  const xOf = (v: number) =>
    PAD + ((v - axisMin) / (axisMax - axisMin)) * inner;
  // SVG y-axis inverted
  const yOf = (v: number) =>
    PAD + inner - ((v - axisMin) / (axisMax - axisMin)) * inner;

  // 3 tick marks along each axis
  const mid = Math.round((axisMin + axisMax) / 2);
  const ticks = [axisMin, mid, axisMax];

  const wins = points.filter((p) => p.outcome === 'win').length;
  const losses = points.filter((p) => p.outcome === 'loss').length;
  const draws = points.filter((p) => p.outcome === 'draw').length;

  // Average opponent delta: positive means you've faced stronger opponents
  // on average, negative means weaker.
  const avgDelta = Math.round(
    points.reduce((s, p) => s + (p.oppElo - p.userElo), 0) / points.length
  );

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ScatterChart size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--foreground-strong)]">
            Your rating vs. opponent rating
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[var(--success)] font-mono">{wins}W</span>
          <span className="text-[var(--muted)] font-mono">{draws}D</span>
          <span className="text-[var(--danger)] font-mono">{losses}L</span>
          <span className="text-[var(--muted)]">
            · avg opponent{' '}
            <span
              className="font-mono font-semibold"
              style={{
                color:
                  avgDelta > 0
                    ? 'var(--danger)'
                    : avgDelta < 0
                      ? 'var(--success)'
                      : 'var(--muted)',
              }}
            >
              {avgDelta > 0 ? '+' : ''}
              {avgDelta}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="block w-full max-w-[420px]"
          style={{ height: 'auto' }}
        >
          {/* Gridlines */}
          {ticks.map((t) => (
            <g key={`g-${t}`}>
              <line
                x1={xOf(axisMin)}
                y1={yOf(t)}
                x2={xOf(axisMax)}
                y2={yOf(t)}
                stroke="var(--border)"
                strokeDasharray="2 4"
                opacity="0.5"
              />
              <line
                x1={xOf(t)}
                y1={yOf(axisMin)}
                x2={xOf(t)}
                y2={yOf(axisMax)}
                stroke="var(--border)"
                strokeDasharray="2 4"
                opacity="0.5"
              />
            </g>
          ))}

          {/* y = x diagonal — "same strength" line */}
          <line
            x1={xOf(axisMin)}
            y1={yOf(axisMin)}
            x2={xOf(axisMax)}
            y2={yOf(axisMax)}
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          <text
            x={xOf(axisMax) - 4}
            y={yOf(axisMax) - 4}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="var(--accent)"
            opacity="0.75"
          >
            you = opponent
          </text>

          {/* Axis labels */}
          {ticks.map((t) => (
            <g key={`axt-${t}`}>
              {/* X-axis tick (your rating) */}
              <text
                x={xOf(t)}
                y={SIZE - 14}
                textAnchor="middle"
                fontSize="10"
                fontFamily="monospace"
                fill="var(--muted)"
              >
                {t}
              </text>
              {/* Y-axis tick (opponent rating) */}
              <text
                x={PAD - 6}
                y={yOf(t) + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="monospace"
                fill="var(--muted)"
              >
                {t}
              </text>
            </g>
          ))}

          <text
            x={SIZE / 2}
            y={SIZE - 2}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            fill="var(--muted)"
          >
            Your rating →
          </text>
          <text
            x={10}
            y={SIZE / 2}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            fill="var(--muted)"
            transform={`rotate(-90 10 ${SIZE / 2})`}
          >
            Opponent rating →
          </text>

          {/* Region hints */}
          <text
            x={xOf(axisMin) + 6}
            y={yOf(axisMax) + 14}
            fontSize="9"
            fill="var(--muted)"
            opacity="0.6"
          >
            stronger opponents ↑
          </text>
          <text
            x={xOf(axisMax) - 6}
            y={yOf(axisMin) - 4}
            textAnchor="end"
            fontSize="9"
            fill="var(--muted)"
            opacity="0.6"
          >
            weaker opponents ↓
          </text>

          {/* Scatter points */}
          {points.map((p, i) => {
            const isHovered = hover === p;
            return (
              <circle
                key={i}
                cx={xOf(p.userElo)}
                cy={yOf(p.oppElo)}
                r={isHovered ? 6 : 4}
                fill={OUTCOME_COLOR[p.outcome]}
                stroke="var(--surface)"
                strokeWidth="1.5"
                opacity={hover && !isHovered ? 0.5 : 0.9}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer transition-all"
              />
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <LegendDot color={OUTCOME_COLOR.win} label="Win" />
          <LegendDot color={OUTCOME_COLOR.draw} label="Draw" />
          <LegendDot color={OUTCOME_COLOR.loss} label="Loss" />
        </div>
        {hover ? (
          <div className="text-xs text-[var(--foreground)] font-mono">
            Game {hover.gameNum}: You {hover.userElo} vs CPU {hover.oppElo} ·{' '}
            <span
              className="font-bold"
              style={{ color: OUTCOME_COLOR[hover.outcome] }}
            >
              {hover.outcome === 'win' ? 'W' : hover.outcome === 'loss' ? 'L' : 'D'}
            </span>{' '}
            · {fmtDate(hover.date)}
            {hover.coachingMoments > 0 && (
              <span className="ml-2 text-[var(--accent)]">🎓 {hover.coachingMoments}</span>
            )}
          </div>
        ) : (
          <div className="text-[10px] text-[var(--muted)] max-w-xs text-right">
            Dots below the dashed line = weaker opponents. Above the line = stronger. Green wins
            above the line are signs you're punching up.
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
