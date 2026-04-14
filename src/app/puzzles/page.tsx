'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import { SkipForward, CheckCircle, XCircle } from 'lucide-react';

interface Puzzle {
  id: number;
  fen: string;
  solution: string;
  theme: string | null;
  difficulty: number | null;
}

interface Stats {
  total_attempts: number;
  total_solved: number;
  avg_solve_time: number | null;
}

export default function PuzzlesPage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [game, setGame] = useState<Chess | null>(null);
  const [solutionMoves, setSolutionMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'solved' | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPuzzles, setNoPuzzles] = useState(false);
  const [startTime, setStartTime] = useState(0);

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/puzzles');
      if (res.status === 404) {
        setNoPuzzles(true);
        setLoading(false);
        return;
      }
      const p: Puzzle = await res.json();
      setPuzzle(p);
      const g = new Chess(p.fen);
      setGame(g);
      const moves: string[] = JSON.parse(p.solution);
      setSolutionMoves(moves);
      setMoveIndex(0);
      setStartTime(Date.now());

      // If it's the opponent's first move in the puzzle, play it automatically
      if (moves.length > 0) {
        setTimeout(() => {
          const g2 = new Chess(p.fen);
          g2.move(moves[0]);
          setGame(new Chess(g2.fen()));
          setMoveIndex(1);
        }, 500);
      }
    } catch {
      setNoPuzzles(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPuzzle();
    fetch('/api/puzzles?stats=1')
      .then((r) => r.json())
      .then(setStats);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPieceDrop = useCallback(
    (source: string, target: string) => {
      if (!game || !puzzle || feedback === 'solved' || feedback === 'wrong') return false;

      const expectedMove = solutionMoves[moveIndex];
      if (!expectedMove) return false;

      const g = new Chess(game.fen());
      const move = g.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;

      // Check if the move matches (UCI format)
      const uci = `${move.from}${move.to}${move.promotion || ''}`;
      if (uci !== expectedMove && move.san !== expectedMove) {
        setFeedback('wrong');
        const timeSeconds = Math.round((Date.now() - startTime) / 1000);
        fetch('/api/puzzles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puzzleId: puzzle.id, solved: false, timeSeconds }),
        });
        return false;
      }

      setGame(new Chess(g.fen()));
      const nextIdx = moveIndex + 1;
      setMoveIndex(nextIdx);

      // Check if puzzle is solved
      if (nextIdx >= solutionMoves.length) {
        setFeedback('solved');
        const timeSeconds = Math.round((Date.now() - startTime) / 1000);
        fetch('/api/puzzles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puzzleId: puzzle.id, solved: true, timeSeconds }),
        });
        return true;
      }

      // Play opponent's response
      setFeedback('correct');
      setTimeout(() => {
        const opponentMove = solutionMoves[nextIdx];
        if (opponentMove) {
          const g2 = new Chess(g.fen());
          g2.move(opponentMove);
          setGame(new Chess(g2.fen()));
          setMoveIndex(nextIdx + 1);
          setFeedback(null);
        }
      }, 400);

      return true;
    },
    [game, puzzle, solutionMoves, moveIndex, feedback, startTime]
  );

  if (loading) {
    return <div className="max-w-3xl mx-auto p-8 text-center text-[var(--muted)]">Loading...</div>;
  }

  if (noPuzzles) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-4">
        <h1 className="text-xl font-bold">Puzzles</h1>
        <p className="text-[var(--muted)]">
          No puzzles yet. Add puzzles via the API to start training.
        </p>
        <pre className="text-xs text-left bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] overflow-x-auto">
{`POST /api/puzzles
{
  "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
  "solution": '["f3f7"]',
  "theme": "scholar_mate",
  "difficulty": 1
}`}
        </pre>
      </div>
    );
  }

  const turn = game?.turn() === 'w' ? 'White' : 'Black';

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Puzzles</h1>
        {stats && (
          <div className="text-sm text-[var(--muted)]">
            {stats.total_solved}/{stats.total_attempts} solved
            {stats.avg_solve_time && ` (avg ${stats.avg_solve_time}s)`}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <ChessBoard
          position={game?.fen() || 'start'}
          onPieceDrop={onPieceDrop}
          boardOrientation={puzzle?.fen.includes(' b ') ? 'white' : 'black'}
          boardWidth={480}
        />

        <div className="flex items-center gap-3">
          {feedback === null && (
            <span className="text-sm text-[var(--muted)]">Find the best move for {turn}</span>
          )}
          {feedback === 'correct' && (
            <span className="text-sm text-[var(--success)] flex items-center gap-1">
              <CheckCircle size={16} /> Correct! Keep going...
            </span>
          )}
          {feedback === 'wrong' && (
            <span className="text-sm text-[var(--danger)] flex items-center gap-1">
              <XCircle size={16} /> Wrong move
            </span>
          )}
          {feedback === 'solved' && (
            <span className="text-sm text-[var(--success)] flex items-center gap-1">
              <CheckCircle size={16} /> Puzzle solved!
            </span>
          )}
        </div>

        {puzzle?.theme && (
          <div className="text-xs text-[var(--muted)]">
            Theme: {puzzle.theme.replace(/_/g, ' ')}
            {puzzle.difficulty && ` | Difficulty: ${'*'.repeat(puzzle.difficulty)}`}
          </div>
        )}

        <button
          onClick={loadPuzzle}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm hover:opacity-90 transition-opacity"
        >
          <SkipForward size={16} />
          Next Puzzle
        </button>
      </div>
    </div>
  );
}
