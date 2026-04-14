'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import GameControls from '@/components/GameControls';
import EngineAnalysis from '@/components/EngineAnalysis';
import OpponentPanel from '@/components/OpponentPanel';
import PgnImport from '@/components/PgnImport';
import { useEngine } from '@/hooks/useEngine';
import { useOpponent } from '@/hooks/useOpponent';

export default function Home() {
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positions, setPositions] = useState<string[]>([game.fen()]);
  const [showImport, setShowImport] = useState(false);
  const [status, setStatus] = useState('');
  // Resolved computer color (when "random" is chosen this is resolved to white/black)
  const [computerPlays, setComputerPlays] = useState<'w' | 'b' | null>(null);

  const engine = useEngine();
  const opponent = useOpponent();

  const updateStatus = useCallback((g: Chess) => {
    if (g.isCheckmate()) {
      setStatus(`Checkmate — ${g.turn() === 'w' ? 'Black' : 'White'} wins`);
    } else if (g.isDraw()) {
      if (g.isStalemate()) setStatus('Draw by stalemate');
      else if (g.isThreefoldRepetition()) setStatus('Draw by repetition');
      else if (g.isInsufficientMaterial()) setStatus('Draw — insufficient material');
      else setStatus('Draw');
    } else if (g.isCheck()) {
      setStatus(`${g.turn() === 'w' ? 'White' : 'Black'} to move (check)`);
    } else {
      setStatus(`${g.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, []);

  useEffect(() => {
    updateStatus(game);
  }, [game, updateStatus]);

  // Analysis engine: re-analyze when position changes
  useEffect(() => {
    if (engine.enabled) {
      const fen = positions[currentMoveIndex + 1] || positions[0];
      engine.analyze(fen);
    }
  }, [currentMoveIndex, positions, engine.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve "random" color once when opponent is enabled / toggled on
  useEffect(() => {
    if (!opponent.enabled) {
      setComputerPlays(null);
      return;
    }
    if (opponent.color === 'random') {
      setComputerPlays(Math.random() < 0.5 ? 'w' : 'b');
    } else {
      setComputerPlays(opponent.color === 'white' ? 'w' : 'b');
    }
  }, [opponent.enabled, opponent.color]);

  // Auto-flip board so the human's pieces are at the bottom
  useEffect(() => {
    if (!opponent.enabled || !computerPlays) return;
    setBoardOrientation(computerPlays === 'w' ? 'black' : 'white');
  }, [opponent.enabled, computerPlays]);

  const applyMove = useCallback(
    (source: string, target: string, promotion = 'q'): boolean => {
      const currentFen = positions[currentMoveIndex + 1] || positions[0];
      const g = new Chess(currentFen);

      const move = g.move({ from: source, to: target, promotion });
      if (!move) return false;

      setMoveHistory((prev) => {
        const newHistory = prev.slice(0, currentMoveIndex + 1);
        newHistory.push(move.san);
        return newHistory;
      });
      setPositions((prev) => {
        const newPositions = prev.slice(0, currentMoveIndex + 2);
        newPositions.push(g.fen());
        return newPositions;
      });
      setGame(g);
      setCurrentMoveIndex((i) => i + 1);
      return true;
    },
    [currentMoveIndex, positions]
  );

  // Trigger computer move when it's the computer's turn (and we're at the live position)
  const requestMoveRef = useRef(opponent.requestMove);
  requestMoveRef.current = opponent.requestMove;

  useEffect(() => {
    if (!opponent.enabled || !computerPlays) return;
    // Only play if we're at the latest position
    if (currentMoveIndex !== moveHistory.length - 1) return;
    // Only play if it's the computer's turn
    if (game.turn() !== computerPlays) return;
    // Don't play if game is over
    if (game.isGameOver()) return;

    const fen = game.fen();
    const timer = setTimeout(() => {
      requestMoveRef.current(fen, (move) => {
        applyMove(move.from, move.to, move.promotion || 'q');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [game, opponent.enabled, computerPlays, currentMoveIndex, moveHistory.length, applyMove]);

  const onPieceDrop = useCallback(
    (source: string, target: string) => {
      // Block human moves on computer's turn
      if (opponent.enabled && computerPlays && game.turn() === computerPlays) return false;
      return applyMove(source, target);
    },
    [applyMove, opponent.enabled, computerPlays, game]
  );

  const goToMove = useCallback(
    (index: number) => {
      setCurrentMoveIndex(index);
      const fen = positions[index + 1] || positions[0];
      setGame(new Chess(fen));
    },
    [positions]
  );

  const newGame = useCallback(() => {
    opponent.cancelMove();
    const g = new Chess();
    setGame(g);
    setMoveHistory([]);
    setPositions([g.fen()]);
    setCurrentMoveIndex(-1);
    // Re-resolve random color for the new game
    if (opponent.enabled && opponent.color === 'random') {
      setComputerPlays(Math.random() < 0.5 ? 'w' : 'b');
    }
  }, [opponent]);

  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    opponent.cancelMove();
    // If playing vs computer, undo 2 moves so it's the human's turn again
    const undoCount = opponent.enabled && moveHistory.length >= 2 ? 2 : 1;
    const newHistory = moveHistory.slice(0, -undoCount);
    const newPositions = positions.slice(0, -undoCount);
    const fen = newPositions[newPositions.length - 1];
    setGame(new Chess(fen));
    setMoveHistory(newHistory);
    setPositions(newPositions);
    setCurrentMoveIndex(newHistory.length - 1);
  }, [moveHistory, positions, opponent]);

  const importPgn = useCallback((pgn: string) => {
    const g = new Chess();
    try {
      g.loadPgn(pgn);
    } catch {
      alert('Invalid PGN');
      return;
    }
    const history = g.history();
    const allPositions = [new Chess().fen()];
    const replay = new Chess();
    for (const move of history) {
      replay.move(move);
      allPositions.push(replay.fen());
    }
    setGame(g);
    setMoveHistory(history);
    setPositions(allPositions);
    setCurrentMoveIndex(history.length - 1);
  }, []);

  useEffect(() => {
    const pgn = sessionStorage.getItem('loadPgn');
    if (pgn) {
      sessionStorage.removeItem('loadPgn');
      importPgn(pgn);
    }
  }, [importPgn]);

  const exportPgn = useCallback(() => {
    const g = new Chess();
    for (const move of moveHistory) g.move(move);
    navigator.clipboard.writeText(g.pgn());
    alert('PGN copied to clipboard');
  }, [moveHistory]);

  const saveGame = useCallback(async () => {
    const g = new Chess();
    for (const move of moveHistory) g.move(move);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn: g.pgn(), title: `Game ${new Date().toLocaleDateString()}` }),
      });
      alert(res.ok ? 'Game saved!' : 'Failed to save game');
    } catch {
      alert('Failed to save game');
    }
  }, [moveHistory]);

  const currentFen = positions[currentMoveIndex + 1] || positions[0];

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Board */}
        <div className="shrink-0 mx-auto lg:mx-0">
          <ChessBoard
            position={currentFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
          />
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--foreground-strong)]">{status}</span>
            {opponent.enabled && computerPlays && (
              <span className="text-xs text-[var(--muted)]">
                You: {computerPlays === 'w' ? '● Black' : '○ White'}
                <span className="mx-2 text-[var(--border)]">|</span>
                CPU: {computerPlays === 'w' ? '○ White' : '● Black'} ({opponent.elo})
              </span>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex-1 space-y-2 w-full min-w-[280px] lg:max-w-sm">
          <OpponentPanel
            enabled={opponent.enabled}
            onToggle={opponent.toggle}
            color={opponent.color}
            onColorChange={opponent.setColor}
            elo={opponent.elo}
            onEloChange={opponent.setElo}
            isThinking={opponent.isThinking}
          />
          <EngineAnalysis
            enabled={engine.enabled}
            onToggle={engine.toggle}
            lines={engine.lines}
            depth={engine.depth}
            isThinking={engine.isThinking}
          />
          <MoveHistory
            moves={moveHistory}
            currentMoveIndex={currentMoveIndex}
            onMoveClick={goToMove}
          />
          <GameControls
            onNewGame={newGame}
            onFlipBoard={() => setBoardOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            onUndo={undoMove}
            onGoToStart={() => goToMove(-1)}
            onGoBack={() => goToMove(Math.max(-1, currentMoveIndex - 1))}
            onGoForward={() => goToMove(Math.min(moveHistory.length - 1, currentMoveIndex + 1))}
            onGoToEnd={() => goToMove(moveHistory.length - 1)}
            onImportPgn={() => setShowImport(true)}
            onExportPgn={exportPgn}
            onSaveGame={saveGame}
            canUndo={moveHistory.length > 0}
            canGoBack={currentMoveIndex > -1}
            canGoForward={currentMoveIndex < moveHistory.length - 1}
          />
        </div>
      </div>

      <PgnImport isOpen={showImport} onClose={() => setShowImport(false)} onImport={importPgn} />
    </div>
  );
}
