'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Game } from '@/lib/queries';

type Outcome = 'win' | 'loss' | 'draw' | 'ongoing' | null;

interface ProgressPoint {
  idx: number;
  date: string;
  rating: number;
  outcome: Outcome;
  title: string;
  coachingMoments: number;
}

interface ProgressGraphProps {
  games: Game[];
  outcomeOf: (g: Game) => Outcome;
}

const OUTCOME_COLOR: Record<Exclude<Outcome, null>, string> = {
  win: '#22c55e', // green
  loss: '#ef4444', // red
  draw: '#94a3b8', // slate
  ongoing: '#eab308', // amber
};

const HEIGHT = 180;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;

export default function ProgressGraph({ games, outcomeOf }: ProgressGraphProps) {
  const [hover, setHover] = useState<ProgressPoint | null>(null);

  // Build chronological series of games with a recorded user_rating.
  const points: ProgressPoint[] = [...games]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .filter((g) => typeof g.user_rating === 'number')
    .map((g, i) => ({
      idx: i,
      date: g.created_at,
      rating: g.user_rating as number,
      outcome: outcomeOf(g),
      title: g.title || 'Untitled Game',
      coachingMoments: g.coaching_moments ?? 0,
    }));

  if (points.length < 2) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex items-center gap-3">
        <div className="p-2 rounded bg-[var(--accent)]/10">
          <TrendingUp size={16} className="text-[var(--accent)]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--foreground-strong)]">Progress trend</div>
          <div className="text-xs text-[var(--muted)]">
            Play at least two Mentor games to see your rating trend here.
            {points.length === 1 && ' (1 game recorded so far)'}
          </div>
        </div>
      </div>
    );
  }

  // Y-axis scale — add a little padding either side so extremes don't hug edges
  const ratings = points.map((p) => p.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const rawRange = Math.max(40, maxR - minR);
  const yMin = Math.floor((minR - rawRange * 0.15) / 10) * 10;
  const yMax = Math.ceil((maxR + rawRange * 0.15) / 10) * 10;

  // Responsive width via viewBox. We fix the intrinsic coordinate space at
  // an ample width; the SVG scales to container.
  const width = Math.max(320, points.length * 32);
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const x = (i: number) => PAD_LEFT + i * stepX;
  const y = (r: number) =>
    PAD_TOP + innerH - ((r - yMin) / (yMax - yMin)) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.rating)}`)
    .join(' ');

  // Area fill below the line
  const areaPath = `${linePath} L ${x(points.length - 1)} ${PAD_TOP + innerH} L ${x(0)} ${PAD_TOP + innerH} Z`;

  // Y-axis ticks: min, middle, max
  const ticks = [yMin, Math.round((yMin + yMax) / 2), yMax];

  // Recent-N rolling win rate (last 5 games)
  const recentN = Math.min(5, points.length);
  const recentSlice = points.slice(-recentN);
  const finished = recentSlice.filter(
    (p) => p.outcome === 'win' || p.outcome === 'loss' || p.outcome === 'draw'
  );
  const recentScore =
    finished.length > 0
      ? (finished.reduce(
          (acc, p) => acc + (p.outcome === 'win' ? 1 : p.outcome === 'draw' ? 0.5 : 0),
          0
        ) /
          finished.length) *
        100
      : null;

  const ratingDelta = points[points.length - 1].rating - points[0].rating;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--foreground-strong)]">Rating over time</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span
            className="font-mono font-semibold"
            style={{
              color:
                ratingDelta > 0
                  ? 'var(--success)'
                  : ratingDelta < 0
                    ? 'var(--danger)'
                    : 'var(--muted)',
            }}
          >
            {ratingDelta > 0 ? '+' : ''}
            {ratingDelta} since start
          </span>
          {recentScore !== null && (
            <span className="text-[var(--muted)]">
              Last {recentN}: <span className="text-[var(--foreground-strong)] font-mono">{recentScore.toFixed(0)}%</span> score
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block"
          style={{ width: '100%', minWidth: `${width}px`, height: HEIGHT }}
          preserveAspectRatio="none"
        >
          {/* Y-axis gridlines */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                y1={y(t)}
                x2={width - PAD_RIGHT}
                y2={y(t)}
                stroke="var(--border)"
                strokeDasharray="3 4"
                opacity="0.5"
              />
              <text
                x={PAD_LEFT - 6}
                y={y(t) + 3}
                textAnchor="end"
                fontSize="10"
                fontFamily="monospace"
                fill="var(--muted)"
              >
                {t}
              </text>
            </g>
          ))}

          {/* X-axis labels (first, middle, last) */}
          {[0, Math.floor(points.length / 2), points.length - 1]
            .filter((i, idx, arr) => arr.indexOf(i) === idx)
            .map((i) => {
              const p = points[i];
              const label =
                i === 0 ? `Game 1` : i === points.length - 1 ? `Game ${points.length}` : `Game ${i + 1}`;
              return (
                <text
                  key={i}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                  fontSize="10"
                  fontFamily="monospace"
                  fill="var(--muted)"
                >
                  {label} · {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </text>
              );
            })}

          {/* Area + line */}
          <path d={areaPath} fill="var(--accent)" opacity="0.08" />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />

          {/* Dots */}
          {points.map((p, i) => {
            const color = p.outcome ? OUTCOME_COLOR[p.outcome] : 'var(--muted)';
            return (
              <g key={i}>
                <circle
                  cx={x(i)}
                  cy={y(p.rating)}
                  r={hover?.idx === i ? 5 : 3.5}
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth="1.5"
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer transition-all"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend + hover card */}
      <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <LegendDot color={OUTCOME_COLOR.win} label="Win" />
          <LegendDot color={OUTCOME_COLOR.draw} label="Draw" />
          <LegendDot color={OUTCOME_COLOR.loss} label="Loss" />
          <LegendDot color={OUTCOME_COLOR.ongoing} label="Ongoing" />
        </div>
        {hover && (
          <div className="text-xs text-[var(--foreground)] font-mono">
            Game {hover.idx + 1} · {hover.rating} ELO
            {hover.coachingMoments > 0 && (
              <span className="ml-2 text-[var(--accent)]">🎓 {hover.coachingMoments}</span>
            )}
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
