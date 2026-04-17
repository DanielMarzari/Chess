'use client';

import { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import Link from 'next/link';
import {
  Trash2,
  ExternalLink,
  Undo2,
  TrendingUp,
  Swords,
  Trophy,
  Target,
  LineChart,
  GraduationCap,
} from 'lucide-react';
import type { Game } from '@/lib/queries';
import ProgressGraph from '@/components/ProgressGraph';

type Bucket = {
  label: string;
  min: number;
  max: number;
  wins: number;
  losses: number;
  draws: number;
};

function parseCpuElo(name: string | null): number | null {
  if (!name) return null;
  const match = name.match(/\((\d{3,4})\)/);
  return match ? parseInt(match[1]) : null;
}

function parseResult(pgn: string): '1-0' | '0-1' | '1/2-1/2' | '*' {
  const m = pgn.match(/\[Result "([^"]+)"\]/);
  const r = (m?.[1] ?? '*') as '1-0' | '0-1' | '1/2-1/2' | '*';
  return r === '1-0' || r === '0-1' || r === '1/2-1/2' ? r : '*';
}

// Determine which side was the human, and the result from the human's POV.
function gameOutcome(game: Game): {
  humanColor: 'w' | 'b' | null;
  opponentElo: number | null;
  result: 'win' | 'loss' | 'draw' | 'ongoing' | null;
} {
  const whiteElo = parseCpuElo(game.white);
  const blackElo = parseCpuElo(game.black);
  let humanColor: 'w' | 'b' | null = null;
  let opponentElo: number | null = null;
  if (whiteElo !== null && blackElo === null) {
    humanColor = 'b';
    opponentElo = whiteElo;
  } else if (blackElo !== null && whiteElo === null) {
    humanColor = 'w';
    opponentElo = blackElo;
  }
  const res = parseResult(game.pgn);
  let outcome: 'win' | 'loss' | 'draw' | 'ongoing' | null = null;
  if (res === '*') outcome = 'ongoing';
  else if (res === '1/2-1/2') outcome = 'draw';
  else if (res === '1-0') outcome = humanColor === 'w' ? 'win' : humanColor === 'b' ? 'loss' : null;
  else if (res === '0-1') outcome = humanColor === 'b' ? 'win' : humanColor === 'w' ? 'loss' : null;
  return { humanColor, opponentElo, result: outcome };
}

function countMovesFromPgn(pgn: string): number {
  try {
    const g = new Chess();
    g.loadPgn(pgn);
    return g.history().length;
  } catch {
    return 0;
  }
}

const BUCKETS: Omit<Bucket, 'wins' | 'losses' | 'draws'>[] = [
  { label: '<1000', min: 0, max: 1000 },
  { label: '1000-1400', min: 1000, max: 1400 },
  { label: '1400-1800', min: 1400, max: 1800 },
  { label: '1800-2200', min: 1800, max: 2200 },
  { label: '2200+', min: 2200, max: 9999 },
];

export default function ReviewPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Game | null>(null);

  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = games.length;
    let wins = 0,
      losses = 0,
      draws = 0,
      ongoing = 0;
    const eloRatings: number[] = [];
    let longestGame = 0;
    let totalCoachingMoments = 0;
    let gamesWithCoaching = 0;
    const buckets: Bucket[] = BUCKETS.map((b) => ({ ...b, wins: 0, losses: 0, draws: 0 }));
    const openingCounts: Record<string, number> = {};

    for (const g of games) {
      const { opponentElo, result } = gameOutcome(g);
      if (opponentElo !== null) eloRatings.push(opponentElo);
      const moves = countMovesFromPgn(g.pgn);
      if (moves > longestGame) longestGame = moves;
      const cm = g.coaching_moments ?? 0;
      totalCoachingMoments += cm;
      if (cm > 0) gamesWithCoaching += 1;
      if (result === 'win') wins++;
      else if (result === 'loss') losses++;
      else if (result === 'draw') draws++;
      else if (result === 'ongoing') ongoing++;

      if (opponentElo !== null && (result === 'win' || result === 'loss' || result === 'draw')) {
        for (const b of buckets) {
          if (opponentElo >= b.min && opponentElo < b.max) {
            if (result === 'win') b.wins++;
            else if (result === 'loss') b.losses++;
            else if (result === 'draw') b.draws++;
            break;
          }
        }
      }

      const openingMatch = g.pgn.match(/\[Opening "([^"]+)"\]/);
      if (openingMatch) {
        const op = openingMatch[1];
        openingCounts[op] = (openingCounts[op] || 0) + 1;
      }
    }

    const avgElo =
      eloRatings.length > 0
        ? Math.round(eloRatings.reduce((a, b) => a + b, 0) / eloRatings.length)
        : null;
    const peakElo = eloRatings.length > 0 ? Math.max(...eloRatings) : null;

    const finishedGames = wins + losses + draws;
    const winRate = finishedGames > 0 ? (wins / finishedGames) * 100 : null;
    const scoreRate =
      finishedGames > 0 ? ((wins + draws * 0.5) / finishedGames) * 100 : null;

    const topOpening = Object.entries(openingCounts).sort((a, b) => b[1] - a[1])[0] ?? null;

    return {
      total,
      wins,
      losses,
      draws,
      ongoing,
      avgElo,
      peakElo,
      longestGame,
      winRate,
      scoreRate,
      buckets: buckets.filter((b) => b.wins + b.losses + b.draws > 0),
      topOpening,
      totalCoachingMoments,
      gamesWithCoaching,
    };
  }, [games]);

  async function handleDelete(game: Game) {
    setGames((g) => g.filter((x) => x.id !== game.id));
    setRecentlyDeleted(game);
    await fetch(`/api/games?id=${game.id}`, { method: 'DELETE' });
    setTimeout(() => {
      setRecentlyDeleted((prev) => (prev?.id === game.id ? null : prev));
    }, 4000);
  }

  async function handleUndoDelete() {
    if (!recentlyDeleted) return;
    const g = recentlyDeleted;
    setRecentlyDeleted(null);
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: g.title,
        white: g.white,
        black: g.black,
        result: g.result,
        pgn: g.pgn,
        fen: g.fen,
        notes: g.notes,
        tags: g.tags,
      }),
    });
    if (res.ok) {
      const restored = await res.json();
      setGames((list) => [restored, ...list]);
    }
  }

  function handleLoad(game: Game) {
    sessionStorage.setItem('loadPgn', game.pgn);
    window.location.href = '/explore';
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto p-8 text-center text-[var(--muted)]">Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-[var(--accent)]/10">
          <TrendingUp size={22} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Review</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Your games and your growth. Stats are derived from the games you've saved.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          Icon={Swords}
          label="Games"
          value={stats.total.toString()}
          hint={stats.ongoing > 0 ? `${stats.ongoing} ongoing` : undefined}
        />
        <StatCard
          Icon={Trophy}
          label="Record"
          value={`${stats.wins}W · ${stats.draws}D · ${stats.losses}L`}
          hint={stats.scoreRate !== null ? `${stats.scoreRate.toFixed(0)}% score` : '—'}
        />
        <StatCard
          Icon={Target}
          label="Avg Opponent"
          value={stats.avgElo !== null ? `${stats.avgElo}` : '—'}
          hint={stats.peakElo !== null ? `Peak ${stats.peakElo} ELO` : undefined}
        />
        <StatCard
          Icon={GraduationCap}
          label="Learning"
          value={`${stats.totalCoachingMoments}`}
          hint={
            stats.totalCoachingMoments > 0
              ? `${stats.gamesWithCoaching} game${stats.gamesWithCoaching === 1 ? '' : 's'} coached`
              : 'no coaching yet'
          }
        />
      </div>

      {/* Progress trend — rating over time from recorded user_rating snapshots */}
      <ProgressGraph games={games} outcomeOf={(g) => gameOutcome(g).result} />

      {/* Favorite opening — separate card row so the four-card grid above is even */}
      {stats.topOpening && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 flex items-center gap-3">
          <LineChart size={16} className="text-[var(--accent)]" />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)]">
              Favorite Opening
            </div>
            <div className="text-sm font-semibold text-[var(--foreground-strong)]">
              {stats.topOpening[0]}{' '}
              <span className="text-xs text-[var(--muted)] font-normal">
                · {stats.topOpening[1]} game{stats.topOpening[1] === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Performance by ELO bucket */}
      {stats.buckets.length > 0 && (
        <section className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-[var(--accent)]" />
            <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
              Performance by Opponent Strength
            </h2>
          </div>
          <div className="space-y-2">
            {stats.buckets.map((b) => {
              const games = b.wins + b.losses + b.draws;
              const winPct = (b.wins / games) * 100;
              const drawPct = (b.draws / games) * 100;
              const lossPct = (b.losses / games) * 100;
              const scorePct = ((b.wins + b.draws * 0.5) / games) * 100;
              return (
                <div key={b.label} className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
                  <span className="text-xs font-mono text-[var(--muted)]">{b.label}</span>
                  <div className="h-5 rounded overflow-hidden bg-[var(--surface-2)] flex">
                    <div
                      className="h-full bg-[var(--success)]"
                      style={{ width: `${winPct}%` }}
                      title={`${b.wins} win${b.wins === 1 ? '' : 's'}`}
                    />
                    <div
                      className="h-full bg-[var(--muted)]/60"
                      style={{ width: `${drawPct}%` }}
                      title={`${b.draws} draw${b.draws === 1 ? '' : 's'}`}
                    />
                    <div
                      className="h-full bg-[var(--danger)]"
                      style={{ width: `${lossPct}%` }}
                      title={`${b.losses} loss${b.losses === 1 ? '' : 'es'}`}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--foreground-strong)]">
                    {b.wins}/{games} · {scorePct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[var(--muted)]">
            Score = wins + ½ draws, divided by games played in that bucket.
          </p>
        </section>
      )}

      {/* Saved games list */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
            My Games ({games.length})
          </h2>
        </div>

        {games.length === 0 && (
          <p className="text-[var(--muted)] text-center py-8">
            No saved games yet. Play in{' '}
            <Link href="/mentor" className="text-[var(--accent)] hover:underline">
              Mentor
            </Link>{' '}
            or{' '}
            <Link href="/explore" className="text-[var(--accent)] hover:underline">
              Explore
            </Link>{' '}
            and hit Save to start tracking your growth.
          </p>
        )}

        <div className="space-y-1">
          {games.map((game) => {
            const { opponentElo, result } = gameOutcome(game);
            const moves = countMovesFromPgn(game.pgn);
            return (
              <div
                key={game.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded p-3 flex items-center gap-3 hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-medium text-[var(--foreground-strong)] text-sm truncate">
                      {game.title || 'Untitled Game'}
                    </span>
                    {result && result !== 'ongoing' && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          result === 'win'
                            ? 'bg-[var(--success)]/20 text-[var(--success)]'
                            : result === 'loss'
                              ? 'bg-[var(--danger)]/20 text-[var(--danger)]'
                              : 'bg-[var(--muted)]/20 text-[var(--muted)]'
                        }`}
                      >
                        {result.toUpperCase()}
                      </span>
                    )}
                    {result === 'ongoing' && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[var(--warning)]/20 text-[var(--warning)]">
                        ONGOING
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--muted)] space-x-3">
                    {game.white && <span>{game.white}</span>}
                    {game.white && game.black && <span>vs</span>}
                    {game.black && <span>{game.black}</span>}
                    {opponentElo && <span className="font-mono">({opponentElo})</span>}
                    <span className="text-[10px] opacity-70">{moves} plies</span>
                    {(game.coaching_moments ?? 0) > 0 && (
                      <span className="text-[10px] text-[var(--accent)]">
                        🎓 {game.coaching_moments} coaching
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleLoad(game)}
                  className="p-2 rounded hover:bg-[var(--surface-2)] transition-colors text-[var(--foreground)]"
                  title="Open in Explore"
                >
                  <ExternalLink size={16} />
                </button>
                <button
                  onClick={() => handleDelete(game)}
                  className="p-2 rounded hover:bg-[var(--danger)]/20 transition-colors text-[var(--muted)] hover:text-[var(--danger)]"
                  title="Delete game"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Undo delete toast */}
      {recentlyDeleted && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] text-[var(--foreground-strong)] px-4 py-2 rounded-md shadow-lg border border-[var(--border)] text-sm flex items-center gap-3 z-50">
          <span>Deleted "{recentlyDeleted.title || 'Untitled'}"</span>
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1 text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
          >
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
  hint,
  ellipsis,
}: {
  Icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  ellipsis?: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)]">
        <Icon size={12} />
        {label}
      </div>
      <div
        className={`text-lg font-bold text-[var(--foreground-strong)] ${
          ellipsis ? 'truncate' : ''
        }`}
        title={ellipsis ? value : undefined}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}
