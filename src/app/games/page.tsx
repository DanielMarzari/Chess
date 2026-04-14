'use client';

import { useState, useEffect } from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import type { Game } from '@/lib/queries';

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then(setGames)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this game?')) return;
    await fetch(`/api/games?id=${id}`, { method: 'DELETE' });
    setGames((g) => g.filter((game) => game.id !== id));
  }

  function handleLoad(game: Game) {
    // Store PGN in sessionStorage and redirect to board
    sessionStorage.setItem('loadPgn', game.pgn);
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-[var(--muted)]">Loading...</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Saved Games</h1>

      {games.length === 0 && (
        <p className="text-[var(--muted)] text-center py-12">
          No saved games yet. Play or import a game and save it from the board view.
        </p>
      )}

      <div className="space-y-2">
        {games.map((game) => (
          <div
            key={game.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex items-center justify-between"
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
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => handleLoad(game)}
                className="p-2 rounded hover:bg-[var(--primary)] transition-colors text-[var(--foreground)]"
                title="Load game"
              >
                <ExternalLink size={16} />
              </button>
              <button
                onClick={() => handleDelete(game.id)}
                className="p-2 rounded hover:bg-red-900/30 transition-colors text-[var(--danger)]"
                title="Delete game"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
