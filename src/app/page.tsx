'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import ChessBoard from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import GameControls from '@/components/GameControls';
import EngineAnalysis from '@/components/EngineAnalysis';
import EvalGraph, { type PlyEval } from '@/components/EvalGraph';
import OpponentPanel from '@/components/OpponentPanel';
import PgnImport from '@/components/PgnImport';
import { ClockDisplay } from '@/components/Clock';
import TimeControlPicker from '@/components/TimeControlPicker';
import GameEndModal, { type GameResult } from '@/components/GameEndModal';
import AnnotationEditor from '@/components/AnnotationEditor';
import { useEngine } from '@/hooks/useEngine';
import { useOpponent } from '@/hooks/useOpponent';
import { useSound } from '@/hooks/useSound';
import { useClock, type TimeControl } from '@/hooks/useClock';
import { cpToWinPercent, classifyMove, moveAccuracy, type NagType } from '@/lib/accuracy';
import { identifyOpening } from '@/lib/openings';

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
  const [showCoords, setShowCoords] = useState(true);
  // Per-move data
  const [moveEvals, setMoveEvals] = useState<(PlyEval | null)[]>([]);
  const [nags, setNags] = useState<(NagType | null)[]>([]);
  const [annotations, setAnnotations] = useState<Record<number, string>>({});
  // Game-end state
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const gameResultShownRef = useRef<string | null>(null);
  // PV hover arrow
  const [hoverArrow, setHoverArrow] = useState<{ from: Square; to: Square } | null>(null);
  // Annotation editor
  const [annotating, setAnnotating] = useState<{ index: number; x: number; y: number } | null>(null);

  const engine = useEngine();
  const opponent = useOpponent();
  const sound = useSound();

  // Clock
  const onFlag = useCallback((color: 'w' | 'b') => {
    sound.play('defeat');
    setGameResult({ type: 'timeout', winner: color === 'w' ? 'b' : 'w' });
  }, [sound]);
  const clock = useClock(onFlag);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  // Status line
  const updateStatus = useCallback((g: Chess) => {
    if (g.isCheckmate()) setStatus(`Checkmate — ${g.turn() === 'w' ? 'Black' : 'White'} wins`);
    else if (g.isDraw()) {
      if (g.isStalemate()) setStatus('Draw by stalemate');
      else if (g.isThreefoldRepetition()) setStatus('Draw by repetition');
      else if (g.isInsufficientMaterial()) setStatus('Draw — insufficient material');
      else setStatus('Draw');
    } else if (g.isCheck()) setStatus(`${g.turn() === 'w' ? 'White' : 'Black'} to move (check)`);
    else setStatus(`${g.turn() === 'w' ? 'White' : 'Black'} to move`);
  }, []);

  useEffect(() => {
    updateStatus(game);
  }, [game, updateStatus]);

  // Engine analysis — always on, re-run on position change
  useEffect(() => {
    const fen = positions[currentMoveIndex + 1] || positions[0];
    engine.analyze(fen);
  }, [currentMoveIndex, positions]); // eslint-disable-line

  // Capture engine evals into moveEvals when we're at the live position
  useEffect(() => {
    const atLive = currentMoveIndex === moveHistory.length - 1;
    if (!atLive) return;
    if (engine.lines.length === 0) return;
    if (currentMoveIndex < 0) return;
    const primary = engine.lines[0];
    if (primary.depth < 10) return;
    setMoveEvals((prev) => {
      const next = [...prev];
      while (next.length < moveHistory.length) next.push(null);
      next[currentMoveIndex] = {
        score: primary.score,
        mate: primary.mate,
        depth: primary.depth,
      };
      return next;
    });
  }, [engine.lines, currentMoveIndex, moveHistory.length]);

  // Recompute NAGs whenever evals change
  useEffect(() => {
    const newNags: (NagType | null)[] = [];
    for (let i = 0; i < moveHistory.length; i++) {
      const before = i === 0 ? 0 : moveEvals[i - 1]?.score ?? null;
      const after = moveEvals[i]?.score ?? null;
      if (before === null || after === null) {
        newNags.push(null);
        continue;
      }
      const mover = i % 2 === 0 ? 'w' : 'b';
      const beforeWhite = cpToWinPercent(before, moveEvals[i - 1]?.mate ?? null);
      const afterWhite = cpToWinPercent(after, moveEvals[i]?.mate ?? null);
      const winLoss = mover === 'w' ? beforeWhite - afterWhite : afterWhite - beforeWhite;
      // Convert win% loss back to approximate cp loss
      const cpLoss = Math.max(0, winLoss * 10);
      newNags.push(classifyMove(cpLoss));
    }
    setNags(newNags);
  }, [moveEvals, moveHistory.length]);

  // Accuracy
  const { whiteAcc, blackAcc } = useMemo(() => {
    const whites: number[] = [];
    const blacks: number[] = [];
    for (let i = 0; i < moveHistory.length; i++) {
      const before = i === 0 ? 0 : moveEvals[i - 1]?.score ?? null;
      const after = moveEvals[i]?.score ?? null;
      if (before === null || after === null) continue;
      const mover: 'w' | 'b' = i % 2 === 0 ? 'w' : 'b';
      const winBefore = cpToWinPercent(before, moveEvals[i - 1]?.mate ?? null);
      const winAfter = cpToWinPercent(after, moveEvals[i]?.mate ?? null);
      const acc = moveAccuracy(winBefore, winAfter, mover);
      (mover === 'w' ? whites : blacks).push(acc);
    }
    return {
      whiteAcc: whites.length ? whites.reduce((a, b) => a + b, 0) / whites.length : null,
      blackAcc: blacks.length ? blacks.reduce((a, b) => a + b, 0) / blacks.length : null,
    };
  }, [moveEvals, moveHistory.length]);

  // Opening ID
  const opening = useMemo(() => identifyOpening(moveHistory), [moveHistory]);

  // Resolve opponent color
  useEffect(() => {
    if (!opponent.enabled) {
      setComputerPlays(null);
      return;
    }
    setComputerPlays(
      opponent.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : opponent.color === 'white' ? 'w' : 'b'
    );
  }, [opponent.enabled, opponent.color]);

  // Auto-flip board
  useEffect(() => {
    if (!opponent.enabled || !computerPlays) return;
    setBoardOrientation(computerPlays === 'w' ? 'black' : 'white');
  }, [opponent.enabled, computerPlays]);

  // Apply a move (with sounds)
  const applyMove = useCallback(
    (source: string, target: string, promotion = 'q'): boolean => {
      const currentFen = positions[currentMoveIndex + 1] || positions[0];
      const g = new Chess(currentFen);
      const move = g.move({ from: source, to: target, promotion });
      if (!move) return false;

      // Sounds
      if (g.isCheckmate()) sound.play('victory');
      else if (g.isDraw()) sound.play('draw');
      else if (g.inCheck()) sound.play('check');
      else if (move.flags.includes('k') || move.flags.includes('q')) sound.play('castle');
      else if (move.flags.includes('c') || move.flags.includes('e')) sound.play('capture');
      else sound.play('move');

      // Clock
      if (clock.tc) clock.pressMove(move.color);

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
    [currentMoveIndex, positions, sound, clock]
  );

  // Opponent turn logic
  const requestMoveRef = useRef(opponent.requestMove);
  requestMoveRef.current = opponent.requestMove;

  useEffect(() => {
    if (!opponent.enabled || !computerPlays) return;
    if (currentMoveIndex !== moveHistory.length - 1) return;
    if (game.turn() !== computerPlays) return;
    if (game.isGameOver()) return;

    const fen = game.fen();
    const timer = setTimeout(() => {
      requestMoveRef.current(fen, (move) => {
        applyMove(move.from, move.to, move.promotion || 'q');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [game, opponent.enabled, computerPlays, currentMoveIndex, moveHistory.length, applyMove]);

  // Try premove when it's our turn
  useEffect(() => {
    if (!premove) return;
    if (!opponent.enabled || !computerPlays) { setPremove(null); return; }
    if (game.turn() === computerPlays) return;
    if (currentMoveIndex !== moveHistory.length - 1) return;

    const test = new Chess(game.fen());
    const result = test.move({ from: premove.from, to: premove.to, promotion: 'q' });
    if (result) applyMove(premove.from, premove.to, 'q');
    setPremove(null);
  }, [game, premove, opponent.enabled, computerPlays, currentMoveIndex, moveHistory.length, applyMove]);

  const onPieceDrop = useCallback(
    (source: string, target: string) => {
      const atLive = currentMoveIndex === moveHistory.length - 1;
      if (opponent.enabled && computerPlays && atLive && game.turn() === computerPlays) {
        const test = new Chess(game.fen());
        const piece = test.get(source as Square);
        if (piece && piece.color !== computerPlays) {
          setPremove({ from: source, to: target });
        }
        return false;
      }
      return applyMove(source, target);
    },
    [applyMove, opponent.enabled, computerPlays, game, currentMoveIndex, moveHistory.length]
  );

  // Detect game-end state — fire once per unique end
  useEffect(() => {
    if (!game.isGameOver() || gameResult) return;
    const key = `${game.fen()}|${moveHistory.length}`;
    if (gameResultShownRef.current === key) return;
    gameResultShownRef.current = key;

    let result: GameResult;
    if (game.isCheckmate()) {
      result = { type: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
    } else if (game.isStalemate()) {
      result = { type: 'stalemate' };
    } else if (game.isThreefoldRepetition()) {
      result = { type: 'draw', reason: 'Draw by repetition' };
    } else if (game.isInsufficientMaterial()) {
      result = { type: 'draw', reason: 'Draw — insufficient material' };
    } else {
      result = { type: 'draw', reason: 'Draw' };
    }
    clock.stop();
    setGameResult(result);
  }, [game, gameResult, moveHistory.length, clock]);

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
    setMoveEvals([]);
    setNags([]);
    setAnnotations({});
    setGameResult(null);
    gameResultShownRef.current = null;
    if (clock.tc) clock.start(clock.tc);
    else clock.disable();
    if (opponent.enabled && opponent.color === 'random') {
      setComputerPlays(Math.random() < 0.5 ? 'w' : 'b');
    }
  }, [opponent, clock]);

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
    setMoveEvals((prev) => prev.slice(0, newHistory.length));
    setNags((prev) => prev.slice(0, newHistory.length));
  }, [moveHistory, positions, opponent]);

  const importPgn = useCallback((pgn: string) => {
    const g = new Chess();
    try { g.loadPgn(pgn); } catch { showToast('Invalid PGN'); return; }
    const history = g.history();
    const all = [new Chess().fen()];
    const replay = new Chess();
    for (const m of history) { replay.move(m); all.push(replay.fen()); }
    setGame(g);
    setMoveHistory(history);
    setPositions(all);
    setCurrentMoveIndex(history.length - 1);
    setMoveEvals(Array(history.length).fill(null));
    setNags(Array(history.length).fill(null));
  }, [showToast]);

  useEffect(() => {
    const pgn = sessionStorage.getItem('loadPgn');
    if (pgn) { sessionStorage.removeItem('loadPgn'); importPgn(pgn); }
  }, [importPgn]);

  const exportPgn = useCallback(() => {
    const g = new Chess();
    for (const m of moveHistory) g.move(m);
    navigator.clipboard.writeText(g.pgn());
    showToast('PGN copied');
  }, [moveHistory, showToast]);

  const saveGame = useCallback(async () => {
    const g = new Chess();
    for (const m of moveHistory) g.move(m);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn: g.pgn(), title: `Game ${new Date().toLocaleDateString()}` }),
      });
      showToast(res.ok ? 'Saved' : 'Save failed');
    } catch { showToast('Save failed'); }
  }, [moveHistory, showToast]);

  const handleResign = useCallback(() => {
    if (!opponent.enabled || !computerPlays) return;
    // Human resigns; winner is the computer
    sound.play('defeat');
    clock.stop();
    setGameResult({ type: 'resign', winner: computerPlays });
  }, [opponent.enabled, computerPlays, sound, clock]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleStartTimed = useCallback((tc: TimeControl | null) => {
    if (tc) {
      clock.start(tc);
    } else {
      clock.disable();
    }
  }, [clock]);

  // Annotation save
  const saveAnnotation = useCallback((idx: number, value: string) => {
    setAnnotations((prev) => {
      const next = { ...prev };
      if (value) next[idx] = value;
      else delete next[idx];
      return next;
    });
    setAnnotating(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') { setPremove(null); setAnnotating(null); }
      else if (e.key === 'ArrowLeft' && currentMoveIndex >= 0) goToMove(currentMoveIndex - 1);
      else if (e.key === 'ArrowRight' && currentMoveIndex < moveHistory.length - 1) goToMove(currentMoveIndex + 1);
      else if (e.key === 'Home') goToMove(-1);
      else if (e.key === 'End') goToMove(moveHistory.length - 1);
      else if (e.key === 'f' || e.key === 'F') setBoardOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else if (e.key === 'n' || e.key === 'N') newGame();
      else if (e.key === 'u' || e.key === 'U') undoMove();
      else if (e.key === 's' || e.key === 'S') saveGame();
      else if (e.key === 'x' || e.key === 'X') exportPgn();
      else if (e.key === 'i' || e.key === 'I') setShowImport(true);
      else if (e.key === 'r' || e.key === 'R') handleResign();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentMoveIndex, moveHistory.length, goToMove, newGame, undoMove, saveGame, exportPgn, handleResign]);

  const currentFen = positions[currentMoveIndex + 1] || positions[0];
  const lastMove = currentMoveIndex >= 0
    ? (() => {
        // Derive last move squares by replaying up to currentMoveIndex and checking history
        const g = new Chess();
        for (let i = 0; i <= currentMoveIndex; i++) g.move(moveHistory[i]);
        const hist = g.history({ verbose: true });
        const last = hist[hist.length - 1];
        return last ? { from: last.from, to: last.to } : null;
      })()
    : null;

  const primaryScore = engine.lines[0]?.score ?? null;
  const primaryMate = engine.lines[0]?.mate ?? null;

  return (
    <div className="max-w-7xl mx-auto p-2 md:p-4">
      <div className="flex flex-col lg:flex-row gap-3 items-start">
        {/* Left: Centipawn-loss graph */}
        <div className="hidden lg:block shrink-0">
          <EvalGraph
            evals={moveEvals}
            nags={nags}
            height={BOARD_WIDTH}
            orientation={boardOrientation}
            currentMoveIndex={currentMoveIndex}
            onJumpTo={goToMove}
            isThinking={engine.isThinking}
            currentDepth={engine.depth}
            currentScore={primaryScore}
            currentMate={primaryMate}
          />
        </div>

        {/* Center: Board + clocks + status */}
        <div className="shrink-0 mx-auto lg:mx-0 space-y-2" style={{ maxWidth: BOARD_WIDTH }}>
          {/* Top clock */}
          {clock.tc && (
            <ClockDisplay
              seconds={boardOrientation === 'white' ? clock.state.black : clock.state.white}
              active={clock.state.activeColor === (boardOrientation === 'white' ? 'b' : 'w')}
              flagged={clock.state.flagged === (boardOrientation === 'white' ? 'b' : 'w')}
              label={boardOrientation === 'white' ? 'Black' : 'White'}
            />
          )}

          <ChessBoard
            position={currentFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            boardWidth={BOARD_WIDTH}
            showCoords={showCoords}
            lastMove={lastMove}
            premove={premove}
            externalArrow={hoverArrow}
          />

          {/* Bottom clock */}
          {clock.tc && (
            <ClockDisplay
              seconds={boardOrientation === 'white' ? clock.state.white : clock.state.black}
              active={clock.state.activeColor === (boardOrientation === 'white' ? 'w' : 'b')}
              flagged={clock.state.flagged === (boardOrientation === 'white' ? 'w' : 'b')}
              label={boardOrientation === 'white' ? 'White' : 'Black'}
            />
          )}

          <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
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
                  premove {premove.from}→{premove.to}
                </span>
              )}
            </div>
          </div>

          {/* Opening + accuracy row */}
          <div className="flex items-center justify-between text-xs">
            <div className="text-[var(--muted)]">
              {opening ? (
                <>
                  <span className="font-mono text-[var(--accent)]">{opening.eco}</span>{' '}
                  <span className="text-[var(--foreground)]">{opening.name}</span>
                </>
              ) : (
                <span className="opacity-50">—</span>
              )}
            </div>
            {(whiteAcc !== null || blackAcc !== null) && (
              <div className="flex items-center gap-3 font-mono">
                <span>
                  <span className="text-[var(--muted)]">W </span>
                  <span className="text-[var(--foreground-strong)] font-semibold">
                    {whiteAcc !== null ? `${whiteAcc.toFixed(0)}%` : '—'}
                  </span>
                </span>
                <span>
                  <span className="text-[var(--muted)]">B </span>
                  <span className="text-[var(--foreground-strong)] font-semibold">
                    {blackAcc !== null ? `${blackAcc.toFixed(0)}%` : '—'}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Side panel */}
        <div className="flex-1 space-y-2 w-full min-w-[280px] lg:max-w-sm">
          <TimeControlPicker currentTc={clock.tc} onSelect={handleStartTimed} />
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
            onHoverLine={setHoverArrow}
          />
          <MoveHistory
            moves={moveHistory}
            nags={nags}
            annotations={annotations}
            currentMoveIndex={currentMoveIndex}
            onMoveClick={goToMove}
            onAnnotate={(index, x, y) => setAnnotating({ index, x, y })}
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
            onResign={handleResign}
            onFullscreen={handleFullscreen}
            onToggleSound={() => sound.setEnabled(!sound.enabled)}
            onToggleCoords={() => setShowCoords((s) => !s)}
            soundEnabled={sound.enabled}
            coordsVisible={showCoords}
            canUndo={moveHistory.length > 0}
            canGoBack={currentMoveIndex > -1}
            canGoForward={currentMoveIndex < moveHistory.length - 1}
            canResign={!!opponent.enabled && !!computerPlays && !game.isGameOver()}
          />
        </div>
      </div>

      <PgnImport isOpen={showImport} onClose={() => setShowImport(false)} onImport={importPgn} />

      <GameEndModal
        result={gameResult}
        humanColor={opponent.enabled && computerPlays ? (computerPlays === 'w' ? 'b' : 'w') : null}
        whiteAccuracy={whiteAcc}
        blackAccuracy={blackAcc}
        onClose={() => setGameResult(null)}
        onNewGame={() => { setGameResult(null); newGame(); }}
        onAnalyze={() => setGameResult(null)}
      />

      {annotating && (
        <AnnotationEditor
          value={annotations[annotating.index] || ''}
          x={annotating.x}
          y={annotating.y}
          onSave={(v) => saveAnnotation(annotating.index, v)}
          onCancel={() => setAnnotating(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] text-[var(--foreground-strong)] px-4 py-2 rounded-md shadow-lg border border-[var(--border)] text-sm flex items-center gap-2 z-50">
          <span className="text-[var(--accent)]">✓</span> {toast}
        </div>
      )}
    </div>
  );
}
