'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ReviewRunner from '@/components/ReviewRunner';
import { Loader } from 'lucide-react';

interface Game {
  id: number;
  pgn: string;
  title?: string;
  white?: string;
  black?: string;
  result?: string;
}

export default function ReviewPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchGame() {
      try {
        const response = await fetch(`/api/games?id=${gameId}`);
        if (!response.ok) {
          throw new Error('Game not found');
        }
        const data = await response.json();
        setGame(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game');
      } finally {
        setIsLoading(false);
      }
    }

    fetchGame();
  }, [gameId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">{error || 'Game not found'}</h1>
        <button
          onClick={() => router.push('/review')}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
        >
          Back to Review
        </button>
      </div>
    );
  }

  return <ReviewRunner game={game} />;
}
