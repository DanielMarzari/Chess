'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CLASSICS } from '@/lib/classics';
import { Book, Search, Play, ExternalLink } from 'lucide-react';

export default function AnalyzePage() {
  const [filter, setFilter] = useState('');
  const [lichessId, setLichessId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const filteredClassics = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return CLASSICS;
    return CLASSICS.filter(
      (g) =>
        g.white.toLowerCase().includes(q) ||
        g.black.toLowerCase().includes(q) ||
        g.event.toLowerCase().includes(q) ||
        g.opening?.toLowerCase().includes(q) ||
        g.eco?.toLowerCase().includes(q)
    );
  }, [filter]);

  function loadGame(pgn: string) {
    sessionStorage.setItem('loadPgn', pgn);
    window.location.href = '/explore';
  }

  async function importFromLichess() {
    // Accept either a game ID (8 chars) or a full URL
    setImportError('');
    let id = lichessId.trim();
    const urlMatch = id.match(/lichess\.org\/(?:game\/)?([a-zA-Z0-9]{8})/);
    if (urlMatch) id = urlMatch[1];
    if (!/^[a-zA-Z0-9]{8}$/.test(id)) {
      setImportError('Enter an 8-character Lichess game ID or a full lichess.org URL');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`https://lichess.org/game/export/${id}?clocks=false&evals=false`, {
        headers: { Accept: 'application/x-chess-pgn' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pgn = await res.text();
      if (!pgn.includes('[')) throw new Error('Unexpected response');
      loadGame(pgn);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setImporting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-[var(--accent)]/10">
          <Book size={22} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Analyze</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Walk through classic games and import games from Lichess. Every position is live —
            the engine analyzes, you can branch at any move and see why.
          </p>
        </div>
      </div>

      {/* Lichess import */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
          Import from Lichess
        </div>
        <div className="flex items-center gap-2">
          <ExternalLink size={14} className="text-[var(--muted)] shrink-0" />
          <input
            type="text"
            value={lichessId}
            onChange={(e) => setLichessId(e.target.value)}
            placeholder="Lichess game URL or 8-character ID"
            className="flex-1 px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') importFromLichess();
            }}
          />
          <button
            onClick={importFromLichess}
            disabled={importing || !lichessId.trim()}
            className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {importing ? 'Loading…' : 'Import'}
          </button>
        </div>
        {importError && <p className="text-xs text-[var(--danger)]">{importError}</p>}
        <p className="text-[10px] text-[var(--muted)]">
          e.g. <span className="font-mono">lichess.org/8jR9qErQ</span>
        </p>
      </section>

      {/* Classics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--muted)]">
            Classic games ({CLASSICS.length})
          </div>
          <div className="relative max-w-xs">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search players, openings…"
              className="w-full pl-7 pr-2 py-1 text-xs bg-[var(--surface)] border border-[var(--border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        <div className="grid gap-2">
          {filteredClassics.map((g) => (
            <div
              key={g.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded p-3 flex items-start gap-3 hover:border-[var(--accent)]/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[var(--foreground-strong)]">{g.white}</span>
                  <span className="text-xs text-[var(--muted)]">vs</span>
                  <span className="font-semibold text-[var(--foreground-strong)]">{g.black}</span>
                  <span
                    className={`font-mono text-xs ml-auto ${
                      g.result === '1-0' ? 'text-[var(--accent)]' : g.result === '0-1' ? 'text-[var(--info)]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {g.result}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] flex items-center gap-3 flex-wrap">
                  <span>{g.event}, {g.year}</span>
                  {g.eco && (
                    <span>
                      <span className="font-mono text-[var(--accent)]">{g.eco}</span>{' '}
                      <span>{g.opening}</span>
                    </span>
                  )}
                </div>
                {g.notes && <p className="text-xs mt-1 text-[var(--foreground)]">{g.notes}</p>}
              </div>
              <button
                onClick={() => loadGame(g.pgn)}
                className="p-2 rounded hover:bg-[var(--surface-2)] transition-colors text-[var(--accent)]"
                title="Open in board"
              >
                <Play size={16} />
              </button>
            </div>
          ))}
        </div>

        {filteredClassics.length === 0 && (
          <p className="text-center text-[var(--muted)] text-sm py-8">
            No games match "{filter}"
          </p>
        )}
      </section>

      <p className="text-xs text-[var(--muted)] text-center pt-4 border-t border-[var(--border)]">
        Next up: "play as the winner" coaching mode is in development — you'll be quizzed on each
        move after the opening.{' '}
        <Link href="/mentor" className="text-[var(--accent)] hover:underline">Back to board</Link>
      </p>
    </div>
  );
}
