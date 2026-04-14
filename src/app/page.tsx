'use client';

import { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import GameControls from '@/components/GameControls';
import EngineAnalysis from '@/components/EngineAnalysis';
import PgnImport from '@/components/PgnImport';
import { useEngine } from '@/hooks/useEngine';

export default function Home() {
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positions, setPositions] = useState<string[]>([game.fen()]);
  const [showImport, setShowImport] = useState(false);
  const [status, setStatus] = useState('');

  const engine = useEngine();

  // Load PGN from sessionStorage (from games page)
  useEffect(() => {
    const pgn = sessionStorage.getItem('loadPgn');
    if (pgn) {
      sessionStorage.removeItem('loadPgn');
      importPgn(pgn);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = useCallback((g: Chess) => {
    if (g.isCheckmate()) {
      setStatus(`Checkmate! ${g.turn() === 'w' ? 'Black' : 'White'} wins.`);
    } else if (g.isDraw()) {
      if (g.isStalemate()) setStatus('Draw by stalemate');
      else if (g.isThreefoldRepetition()) setStatus('Draw by repetition');
      else if (g.isInsufficientMaterial()) setStatus('Draw — insufficient material');
      else setStatus('Draw');
    } else if (g.isCheck()) {
      setStatus(`${g.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setStatus(`${g.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, []);

  useEffect(() => {
    updateStatus(game);
  }, [game, updateStatus]);

  useEffect(() => {
    if (engine.enabled) {
      const fen = positions[currentMoveIndex + 1] || positions[0];
      engine.analyze(fen);
    }
  }, [currentMoveIndex, positions, engine.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPieceDrop = useCallback(
    (source: string, target: string) => {
      // If we're browsing history, create new branch from current position
      const currentFen = positions[currentMoveIndex + 1] || positions[0];
      const g = new Chess(currentFen);

      const move = g.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;

      const newHistory = moveHistory.slice(0, currentMoveIndex + 1);
      newHistory.push(move.san);

      const newPositions = positions.slice(0, currentMoveIndex + 2);
      newPositions.push(g.fen());

      setGame(g);
      setMoveHistory(newHistory);
      setPositions(newPositions);
      setCurrentMoveIndex(newHistory.length - 1);
      return true;
    },
    [game, moveHistory, currentMoveIndex, positions]
  );

  const goToMove = useCallback(
    (index: number) => {
      setCurrentMoveIndex(index);
      const fen = positions[index + 1] || positions[0];
      const g = new Chess(fen);
      setGame(g);
    },
    [positions]
  );

  const newGame = useCallback(() => {
    const g = new Chess();
    setGame(g);
    setMoveHistory([]);
    setPositions([g.fen()]);
    setCurrentMoveIndex(-1);
  }, []);

  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    const newHistory = moveHistory.slice(0, -1);
    const newPositions = positions.slice(0, -1);
    const fen = newPositions[newPositions.length - 1];
    const g = new Chess(fen);
    setGame(g);
    setMoveHistory(newHistory);
    setPositions(newPositions);
    setCurrentMoveIndex(newHistory.length - 1);
  }, [moveHistory, positions]);

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

  const exportPgn = useCallback(() => {
    // Rebuild PGN from move history
    const g = new Chess();
    for (const move of moveHistory) {
      g.move(move);
    }
    const pgn = g.pgn();
    navigator.clipboard.writeText(pgn);
    alert('PGN copied to clipboard');
  }, [moveHistory]);

  const saveGame = useCallback(async () => {
    const g = new Chess();
    for (const move of moveHistory) {
      g.move(move);
    }
    const pgn = g.pgn();

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn, title: `Game ${new Date().toLocaleDateString()}` }),
      });
      if (res.ok) {
        alert('Game saved!');
      } else {
        alert('Failed to save game');
      }
    } catch {
      alert('Failed to save game');
    }
  }, [moveHistory]);

  const currentFen = positions[currentMoveIndex + 1] || positions[0];

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Board */}
        <div className="shrink-0">
          <ChessBoard
            position={currentFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
          />
          <div className="mt-2 text-sm text-center text-[var(--muted)]">{status}</div>
        </div>

        {/* Side panel */}
        <div className="flex-1 space-y-3 min-w-[280px]">
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
            onReset={newGame}
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
