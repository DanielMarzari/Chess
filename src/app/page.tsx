'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import GameControls from '@/components/GameControls';
import EngineAnalysis from '@/components/EngineAnalysis';
import EvalBar from '@/components/EvalBar';
import OpponentPanel from '@/components/OpponentPanel';
import PgnImport from '@/components/PgnImport';
import { useEngine } from '@/hooks/useEngine';
import { useOpponent } from '@/hooks/useOpponent';

const BOARD_WIDTH = 560;

export default function Home() {
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positions, setPositions] = useState<string[]>([game.fen()]);
  const [showImport, setShowImport] = useState(false);
  const [status, setStatus] = useState('');
  const [computerPlays, setComputerPlays] = useState<'w' | 'b' | null>(null);
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const engine = useEngine();
  const opponent = useOpponent();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

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

  // Always-on engine — re-analyze whenever visible position changes
  useEffect(() => {
    const fen = positions[currentMoveIndex + 1] || positions[0];
    engine.analyze(fen);
  }, [currentMoveIndex, positions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve opponent color
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

  // Auto-flip board so the human is at the bottom
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
        const h = prev.slice(0, currentMoveIndex + 1);
        h.push(move.san);
        return h;
      });
      setPositions((prev) => {
        const p = prev.slice(0, currentMoveIndex + 2);
        p.push(g.fen());
        return p;
      });
      setGame(g);
      setCurrentMoveIndex((i) => i + 1);
      return true;
    },
    [currentMoveIndex, positions]
  );

  // Computer's turn
  const requestMoveRef = useRef(opponent.requestMove);
  requestMoveRef.current = opponent.requestMove;
  const premoveRef = useRef(premove);
  premoveRef.current = premove;

  useEffect(() => {
    if (!opponent.enabled || !computerPlays) return;
    if (currentMoveIndex !== moveHistory.length - 1) return;
    if (game.turn() !== computerPlays) return;
    if (game.isGameOver()) return;

    const fen = game.fen();
    const timer = setTimeout(() => {
      requestMoveRef.current(fen, (move) => {
        applyMove(move.from, move.to, move.promotion || 'q');
        // Try to apply the premove after the computer's move
        setTimeout(() => {
          const pm = premoveRef.current;
          if (!pm) return;
          // Get latest state via a fresh Chess from the new FEN
          // applyMove has already updated `game` (async) — use the computed position
          const g2 = new Chess();
          // We can't rely on `game` here due to closure; safer to trigger through state effect
          // Instead, let the premove-try effect below handle it
          void g2; void pm;
        }, 50);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [game, opponent.enabled, computerPlays, currentMoveIndex, moveHistory.length, applyMove]);

  // Try premove whenever it becomes the human's turn
  useEffect(() => {
    if (!premove) return;
    if (!opponent.enabled || !computerPlays) {
      setPremove(null);
      return;
    }
    // Only attempt when it's the human's turn at the live position
    if (game.turn() === computerPlays) return;
    if (currentMoveIndex !== moveHistory.length - 1) return;

    const testGame = new Chess(game.fen());
    const result = testGame.move({ from: premove.from, to: premove.to, promotion: 'q' });
    if (result) {
      applyMove(premove.from, premove.to, 'q');
    }
    setPremove(null);
  }, [game, premove, opponent.enabled, computerPlays, currentMoveIndex, moveHistory.length, applyMove]);

  const onPieceDrop = useCallback(
    (source: string, target: string) => {
      // Only block manual moves at the live position; otherwise allow normal analysis moves
      const atLive = currentMoveIndex === moveHistory.length - 1;

      if (opponent.enabled && computerPlays && atLive && game.turn() === computerPlays) {
        // It's the computer's turn — store a premove
        const testGame = new Chess(game.fen());
        // For premove validity, we just check if from-square has a piece of the human's color
        const piece = testGame.get(source as never);
        if (piece && piece.color !== computerPlays) {
          setPremove({ from: source, to: target });
        }
        return false; // Piece snaps back; we show highlights via customSquareStyles
      }
      return applyMove(source, target);
    },
    [applyMove, opponent.enabled, computerPlays, game, currentMoveIndex, moveHistory.length]
  );

  const goToMove = useCallback(
    (index: number) => {
      setPremove(null);
      setCurrentMoveIndex(index);
      const fen = positions[index + 1] || positions[0];
      setGame(new Chess(fen));
    },
    [positions]
  );

  const newGame = useCallback(() => {
    opponent.cancelMove();
    setPremove(null);
    const g = new Chess();
    setGame(g);
    setMoveHistory([]);
    setPositions([g.fen()]);
    setCurrentMoveIndex(-1);
    if (opponent.enabled && opponent.color === 'random') {
      setComputerPlays(Math.random() < 0.5 ? 'w' : 'b');
    }
  }, [opponent]);

  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    opponent.cancelMove();
    setPremove(null);
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
      showToast('Invalid PGN');
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
  }, [showToast]);

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
    showToast('PGN copied');
  }, [moveHistory, showToast]);

  const saveGame = useCallback(async () => {
    const g = new Chess();
    for (const move of moveHistory) g.move(move);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn: g.pgn(), title: `Game ${new Date().toLocaleDateString()}` }),
      });
      showToast(res.ok ? 'Saved' : 'Save failed');
    } catch {
      showToast('Save failed');
    }
  }, [moveHistory, showToast]);

  // Clear premove on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPremove(null);
      if (e.key === 'ArrowLeft' && currentMoveIndex >= 0) goToMove(currentMoveIndex - 1);
      if (e.key === 'ArrowRight' && currentMoveIndex < moveHistory.length - 1) goToMove(currentMoveIndex + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentMoveIndex, moveHistory.length, goToMove]);

  const currentFen = positions[currentMoveIndex + 1] || positions[0];

  // Premove square highlights
  const premoveStyles: Record<string, React.CSSProperties> = premove
    ? {
        [premove.from]: { background: 'rgba(234, 179, 8, 0.55)' },
        [premove.to]: { background: 'rgba(234, 179, 8, 0.55)' },
      }
    : {};

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-4">
      <div className="flex flex-col lg:flex-row gap-3 items-start">
        {/* Left: Eval bar (full board height) */}
        <div className="hidden lg:block">
          <EvalBar
            lines={engine.lines}
            height={BOARD_WIDTH}
            orientation={boardOrientation}
            isThinking={engine.isThinking}
            depth={engine.depth}
          />
        </div>

        {/* Center: Board */}
        <div className="shrink-0 mx-auto lg:mx-0">
          <ChessBoard
            position={currentFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            boardWidth={BOARD_WIDTH}
            arrowsAndHighlights={{ customSquareStyles: premoveStyles }}
          />
          <div className="mt-3 flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--foreground-strong)]">{status}</span>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              {opponent.enabled && computerPlays && (
                <span>
                  You: {computerPlays === 'w' ? '● Black' : '○ White'}
                  <span className="mx-2 text-[var(--border)]">|</span>
                  CPU {opponent.elo}
                </span>
              )}
              {premove && (
                <span className="px-2 py-0.5 rounded bg-[var(--warning)]/15 text-[var(--warning)] border border-[var(--warning)]/30">
                  premove {premove.from}→{premove.to} · Esc to clear
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Side panel */}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] text-[var(--foreground-strong)] px-4 py-2 rounded-md shadow-lg border border-[var(--border)] text-sm flex items-center gap-2 animate-in fade-in z-50">
          <span className="text-[var(--accent)]">✓</span> {toast}
        </div>
      )}
    </div>
  );
}
