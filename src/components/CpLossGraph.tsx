'use client';

import { cpToWinPercent, NAG_META, type NagType, type PlyEval } from '@/lib/accuracy';

interface CpLossGraphProps {
  evals: (PlyEval | null)[];
  nags: (NagType | null)[];
  currentMoveIndex: number;
  onJumpTo: (index: number) => void;
  width: number;
}

const HEIGHT = 56;
const PAD_Y = 4;

export default function CpLossGraph({ evals, nags, currentMoveIndex, onJumpTo, width }: CpLossGraphProps) {
  // Build series: [ply -1 (start)=50%, ply 0, ply 1, ...]
  const series: { winPct: number; plyIndex: number }[] = [{ winPct: 50, plyIndex: -1 }];
  for (let i = 0; i < evals.length; i++) {
    const e = evals[i];
    const last = series[series.length - 1].winPct;
    series.push({
      winPct: e ? cpToWinPercent(e.score, e.mate) : last,
      plyIndex: i,
    });
  }

  const n = series.length;
  const usableH = HEIGHT - PAD_Y * 2;
  const stepX = n > 1 ? width / (n - 1) : 0;

  const pointsAttr = series
    .map((p, i) => {
      const x = i * stepX;
      const y = PAD_Y + ((100 - p.winPct) / 100) * usableH;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPath =
    n > 1
      ? `M 0 ${HEIGHT / 2} ${series
          .map((p, i) => {
            const x = i * stepX;
            const y = PAD_Y + ((100 - p.winPct) / 100) * usableH;
            return `L ${x} ${y}`;
          })
          .join(' ')} L ${(n - 1) * stepX} ${HEIGHT / 2} Z`
      : '';

  const currentX =
    currentMoveIndex === -1
      ? 0
      : Math.min((currentMoveIndex + 1) * stepX, width);

  return (
    <div className="relative bg-[var(--surface)] rounded border border-[var(--border)]" style={{ height: HEIGHT }}>
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block">
        {/* Backgrounds */}
        <rect x="0" y="0" width={width} height={HEIGHT / 2} fill="#eeeeee" opacity="0.1" />
        <rect x="0" y={HEIGHT / 2} width={width} height={HEIGHT / 2} fill="#262421" opacity="0.1" />

        {/* Center line */}
        <line
          x1="0"
          y1={HEIGHT / 2}
          x2={width}
          y2={HEIGHT / 2}
          stroke="#888"
          strokeWidth="0.5"
          strokeDasharray="2 3"
          opacity="0.5"
        />

        {/* Area under curve */}
        {n > 1 && <path d={areaPath} fill="#eeeeee" opacity="0.35" />}

        {/* Line */}
        {n > 1 && <polyline points={pointsAttr} fill="none" stroke="#aaaaaa" strokeWidth="1" />}

        {/* NAG markers */}
        {series.slice(1).map((p, i) => {
          const nag = nags[i];
          if (!nag || !['blunder', 'mistake', 'inaccuracy'].includes(nag)) return null;
          const x = (i + 1) * stepX;
          const y = PAD_Y + ((100 - p.winPct) / 100) * usableH;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={NAG_META[nag].color}
              stroke="#000"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Current position line */}
        <line
          x1={currentX}
          y1={0}
          x2={currentX}
          y2={HEIGHT}
          stroke="#759900"
          strokeWidth="1.5"
          opacity="0.9"
        />
      </svg>

      {/* Click overlay */}
      <div className="absolute inset-0 flex">
        <div
          onClick={() => onJumpTo(-1)}
          className="cursor-pointer hover:bg-white/5 transition-colors"
          style={{ width: stepX / 2 }}
          title="Starting position"
        />
        {series.slice(1).map((p, i) => (
          <div
            key={i}
            onClick={() => onJumpTo(p.plyIndex)}
            className="cursor-pointer hover:bg-white/5 transition-colors"
            style={{ width: stepX }}
            title={`Move ${Math.floor(p.plyIndex / 2) + 1}${p.plyIndex % 2 === 0 ? '.' : '...'}${nags[i] ? ` (${NAG_META[nags[i]!].label})` : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
