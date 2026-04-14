'use client';

import { useState, useEffect } from 'react';
import { Trash2, ExternalLink, Undo2 } from 'lucide-react';
import type { Game } from '@/lib/queries';

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyDeleted, setRecentlyDeleted] = useState<Game | null>(null);

  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

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
    // Re-create the game (new ID)
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
    window.location.href = '/';
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto p-8 text-center text-[var(--muted)]">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Saved Games</h1>

      {games.length === 0 && !recentlyDeleted && (
        <p className="text-[var(--muted)] text-center py-12">
          No saved games yet. Play or import a game and save it from the board view.
        </p>
      )}

      <div className="space-y-2">
        {games.map((game) => (
          <div
            key={game.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)]/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{game.title || 'Untitled Game'}</div>
              <div className="text-sm text-[var(--muted)] space-x-3">
                {game.white && <span>{game.white}</span>}
                {game.white && game.black && <span>vs</span>}
                {game.black && <span>{game.black}</span>}
                {game.result && <span className="font-mono">{game.result}</span>}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                {new Date(game.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => handleLoad(game)}
                className="p-2 rounded hover:bg-[var(--surface-2)] transition-colors text-[var(--foreground)]"
                title="Load game"
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
          </div>
        ))}
      </div>

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
