'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess, type Square } from 'chess.js';
import ChessBoard, { type ChessboardRef } from '@/components/ChessBoard';
import MoveHistory from '@/components/MoveHistory';
import GameControls from '@/components/GameControls';
import EngineAnalysis from '@/components/EngineAnalysis';
import EvalBar from '@/components/EvalBar';
import CpLossGraph from '@/components/CpLossGraph';
import SetupPanel, { type GameMode } from '@/components/SetupPanel';
import GameStatusPanel from '@/components/GameStatusPanel';
import LiveStats from '@/components/LiveStats';
import CoachPanel, { type CoachSubPhase } from '@/components/CoachPanel';
import PgnImport from '@/components/PgnImport';
import { ClockDisplay } from '@/components/Clock';
import GameEndModal, { type GameResult } from '@/components/GameEndModal';
import AnnotationEditor from '@/components/AnnotationEditor';
import { useStockfish, type OpponentColor } from '@/hooks/useStockfish';
import { useSound } from '@/hooks/useSound';
import { useClock, type TimeControl } from '@/hooks/useClock';
import { cpToWinPercent, classifyMove, moveAccuracy, type NagType, type PlyEval } from '@/lib/accuracy';
import { identifyOpening } from '@/lib/openings';
import { buildPgn, todayTag } from '@/lib/pgn';
import { explainMove, type CoachExplanation } from '@/lib/coaching';

const BOARD_WIDTH = 560;

type GamePhase = 'setup' | 'playing' | 'ended';

export default function Home() {
  // Game phase — controls the entire lifecycle
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');

  // Draft settings — edited in setup phase, committed on Start
  const [draftMode, setDraftMode] = useState<GameMode>('cpu');
  const [draftCpuColor, setDraftCpuColor] = useState<OpponentColor>('black');
  const [draftCpuElo, setDraftCpuElo] = useState(1500);
  const [draftTc, setDraftTc] = useState<TimeControl | null>(null);

  // Committed game settings (locked after Start)
  const [committedMode, setCommittedMode] = useState<GameMode>('free');

  // Game state
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [positions, setPositions] = useState<string[]>([game.fen()]);
  const [showImport, setShowImport] = useState(false);
  const [status, setStatus] = useState('');
  const [computerPlays, setComputerPlays] = useState<'w' | 'b' | null>(null);
  const boardRef = useRef<ChessboardRef>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCoords, setShowCoords] = useState(true);
  const [moveEvals, setMoveEvals] = useState<(PlyEval | null)[]>([]);
  const [nags, setNags] = useState<(NagType | null)[]>([]);
  const [annotations, setAnnotations] = useState<Record<number, string>>({});
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const gameResultShownRef = useRef<string | null>(null);
  const [hoverArrow, setHoverArrow] = useState<{ from: Square; to: Square } | null>(null);
  const [annotating, setAnnotating] = useState<{ index: number; x: number; y: number } | null>(null);

  // ------- Coach state ----------------------------------------------------
  const [coachSubPhase, setCoachSubPhase] = useState<CoachSubPhase>('analyzing');
  const [coachActive, setCoachActive] = useState(false);
  const [coachExplanation, setCoachExplanation] = useState<CoachExplanation | null>(null);
  const [coachAttemptsLeft, setCoachAttemptsLeft] = useState(3);
  const [coachBadMoveSan, setCoachBadMoveSan] = useState('');
  const [coachLastAttemptSan, setCoachLastAttemptSan] = useState<string | null>(null);
  // The move the user originally made that triggered coaching — we save this in case they hit "Skip"
  const coachBadMoveUciRef = useRef<string | null>(null);
  // The FEN BEFORE the bad move (where the user needs to pick again)
  const coachPreFenRef = useRef<string | null>(null);
  // Engine's best continuation from preFen (for explanation + reveal)
  const coachBestMoveUciRef = useRef<string | null>(null);
  const coachBestPvRef = useRef<string[]>([]);
  // Engine's best response to the user's bad move (for "why bad")
  const coachResponsePvRef = useRef<string[]>([]);
  // Eval snapshots
  const coachEvalsRef = useRef<{ before: number; afterBad: number }>({ before: 0, afterBad: 0 });
  // The index in moveHistory where the bad move lives (to splice it out on retry/reveal)
  const coachBadIndexRef = useRef<number>(-1);
  // Which side made the bad move (the "student")
  const coachMoverRef = useRef<'w' | 'b'>('w');
  // NAGs we've already coached on (moveIndex set) to avoid re-triggering
  const coachedIndicesRef = useRef<Set<number>>(new Set());

  const sf = useStockfish();
  const sound = useSound();

  const onFlag = useCallback(
    (color: 'w' | 'b') => {
      sound.play('defeat');
      setGameResult({ type: 'timeout', winner: color === 'w' ? 'b' : 'w' });
      setGamePhase('ended');
    },
    [sound]
  );
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

  // Engine analysis on position change (always on, regardless of phase)
  useEffect(() => {
    const fen = positions[currentMoveIndex + 1] || positions[0];
    sf.analyze(fen);
  }, [currentMoveIndex, positions]); // eslint-disable-line

  // ------- Coach trigger --------------------------------------------------
  // When in coach mode, watch the LAST user move for a bad NAG. When detected,
  // undo the move and kick off coaching. The computer can't move in the
  // meantime because cpuToMove is gated on !coachActive.
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    if (committedMode !== 'coach') return;
    if (coachActive) return;
    if (moveHistory.length === 0) return;
    const lastIdx = moveHistory.length - 1;
    if (coachedIndicesRef.current.has(lastIdx)) return;

    const mover: 'w' | 'b' = lastIdx % 2 === 0 ? 'w' : 'b';
    // Only coach the HUMAN, not the CPU.
    if (mover === computerPlays) return;

    const nag = nags[lastIdx];
    const evalBefore = lastIdx === 0 ? 0 : moveEvals[lastIdx - 1]?.score ?? null;
    const evalAfter = moveEvals[lastIdx]?.score ?? null;
    const depthAfter = moveEvals[lastIdx]?.depth ?? 0;

    // Wait for enough depth before deciding; also wait for the engine to be
    // producing PV lines we can use for explanations.
    if (evalBefore === null || evalAfter === null || depthAfter < 12) return;
    if (nag === null) return; // not bad enough
    if (!['blunder', 'mistake', 'inaccuracy'].includes(nag)) return;

    // We're going to coach. Mark handled.
    coachedIndicesRef.current.add(lastIdx);

    // Capture the bad move's SAN + UCI, then rewind history by 1.
    const badSan = moveHistory[lastIdx];
    // Rebuild to get UCI
    const replay = new Chess();
    for (let i = 0; i < lastIdx; i++) {
      try {
        replay.move(moveHistory[i]);
      } catch {
        return;
      }
    }
    const preFen = replay.fen();
    let badUci = '';
    try {
      const m = replay.move(badSan);
      if (m) badUci = `${m.from}${m.to}${m.promotion || ''}`;
    } catch {
      return;
    }

    coachBadMoveUciRef.current = badUci;
    coachPreFenRef.current = preFen;
    coachEvalsRef.current = { before: evalBefore, afterBad: evalAfter };
    coachBadIndexRef.current = lastIdx;
    coachMoverRef.current = mover;

    // Rewind the game state by one ply so the user can try again.
    const newHistory = moveHistory.slice(0, lastIdx);
    const newPositions = positions.slice(0, lastIdx + 1);
    setMoveHistory(newHistory);
    setPositions(newPositions);
    setCurrentMoveIndex(newHistory.length - 1);
    setGame(new Chess(preFen));
    setMoveEvals((p) => p.slice(0, newHistory.length));
    setNags((p) => p.slice(0, newHistory.length));

    // Pause the clock while we teach.
    clockRef.current.pause();

    // Activate coach; explanation will be built once engine analyzes preFen.
    setCoachActive(true);
    setCoachSubPhase('analyzing');
    setCoachExplanation(null);
    setCoachAttemptsLeft(3);
    setCoachBadMoveSan(badSan);
    setCoachLastAttemptSan(null);
    coachBestMoveUciRef.current = null;
    coachBestPvRef.current = [];
    coachResponsePvRef.current = [];
  }, [gamePhase, committedMode, coachActive, moveHistory, nags, moveEvals, computerPlays, positions]);

  // While coach is active, capture engine's best line from preFen (analysis
  // is already running because positions/currentMoveIndex changed).
  useEffect(() => {
    if (!coachActive) return;
    if (coachSubPhase !== 'analyzing') return;
    if (sf.lines.length === 0) return;
    const primary = sf.lines[0];
    // Need enough depth to trust the recommendation
    if (primary.depth < 15) return;

    const pvTokens = primary.pv.trim().split(/\s+/).filter(Boolean);
    if (pvTokens.length === 0) return;

    const bestUci = pvTokens[0];
    coachBestMoveUciRef.current = bestUci;
    coachBestPvRef.current = pvTokens;

    // Compute engine's response PV from post-bad-move position (to explain "why bad").
    // We analyze that separately inline — we can compute it lazily by
    // instantiating a Chess object and using the main analysis' PV that exists
    // before we rewound. Simpler: use the captured eval and rely on heuristics
    // that inspect the post-bad FEN directly.
    const preFen = coachPreFenRef.current!;
    const badUci = coachBadMoveUciRef.current!;
    const postBadFen = (() => {
      const g = new Chess(preFen);
      try {
        g.move({
          from: badUci.slice(0, 2),
          to: badUci.slice(2, 4),
          promotion: badUci.slice(4, 5) || 'q',
        });
      } catch {
        return preFen;
      }
      return g.fen();
    })();

    // Translate best UCI to SAN
    const bestGame = new Chess(preFen);
    let bestSan = '';
    try {
      const m = bestGame.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci.slice(4, 5) || 'q',
      });
      if (m) bestSan = m.san;
    } catch {
      bestSan = bestUci;
    }

    // We don't have a direct PV from post-bad FEN, but we can infer the
    // opponent's best reply from the evaluation drop + standard heuristics.
    // For v1, pass an empty response PV — the heuristic will fall back to
    // eval-based commentary. (Future: run a second short analysis on postBadFen.)
    const explanation = explainMove({
      preMoveFen: preFen,
      badMoveSan: coachBadMoveSan,
      badMoveUci: badUci,
      bestMoveSan: bestSan,
      bestMoveUci: bestUci,
      bestPvUci: pvTokens,
      responsePvUci: coachResponsePvRef.current,
      evalBeforeCp: coachEvalsRef.current.before,
      evalAfterBadCp: coachEvalsRef.current.afterBad,
      mover: coachMoverRef.current,
      nag: nags[coachBadIndexRef.current] ?? 'blunder',
    });

    // Lightweight refutation heuristic: find the most valuable capture the
    // opponent has available in postBadFen (so "why bad" can say "Black takes
    // your rook for free"). Uses only chess.js, no engine call.
    try {
      const post = new Chess(postBadFen);
      const moves = post.moves({ verbose: true }) as Array<{
        from: string;
        to: string;
        flags: string;
        captured?: string;
      }>;
      const captures = moves.filter((m) => m.flags.includes('c') || m.flags.includes('e'));
      if (captures.length > 0) {
        const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        captures.sort((a, b) => (values[b.captured || 'p'] || 0) - (values[a.captured || 'p'] || 0));
        const best = captures[0];
        coachResponsePvRef.current = [`${best.from}${best.to}`];
      }
    } catch {
      // ignore
    }

    // Rebuild the explanation now that we have a refutation hint.
    const finalExplanation = explainMove({
      preMoveFen: preFen,
      badMoveSan: coachBadMoveSan,
      badMoveUci: badUci,
      bestMoveSan: bestSan,
      bestMoveUci: bestUci,
      bestPvUci: pvTokens,
      responsePvUci: coachResponsePvRef.current,
      evalBeforeCp: coachEvalsRef.current.before,
      evalAfterBadCp: coachEvalsRef.current.afterBad,
      mover: coachMoverRef.current,
      nag: nags[coachBadIndexRef.current] ?? 'blunder',
    });

    setCoachExplanation(finalExplanation);
    setCoachSubPhase('explain');
    void explanation; // silence unused intermediate
    void postBadFen;
  }, [coachActive, coachSubPhase, sf.lines, coachBadMoveSan, nags]);

  // Capture live eval into moveEvals
  useEffect(() => {
    const atLive = currentMoveIndex === moveHistory.length - 1;
    if (!atLive || sf.lines.length === 0 || currentMoveIndex < 0) return;
    const primary = sf.lines[0];
    if (primary.depth < 10) return;
    setMoveEvals((prev) => {
      const next = [...prev];
      while (next.length < moveHistory.length) next.push(null);
      next[currentMoveIndex] = { score: primary.score, mate: primary.mate, depth: primary.depth };
      return next;
    });
  }, [sf.lines, currentMoveIndex, moveHistory.length]);

  // NAGs
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
      (mover === 'w' ? whites : blacks).push(moveAccuracy(winBefore, winAfter, mover));
    }
    return {
      whiteAcc: whites.length ? whites.reduce((a, b) => a + b, 0) / whites.length : null,
      blackAcc: blacks.length ? blacks.reduce((a, b) => a + b, 0) / blacks.length : null,
    };
  }, [moveEvals, moveHistory.length]);

  const opening = useMemo(() => identifyOpening(moveHistory), [moveHistory]);

  // Auto-flip board to human's perspective
  useEffect(() => {
    if (committedMode !== 'cpu' || !computerPlays) return;
    setBoardOrientation(computerPlays === 'w' ? 'black' : 'white');
  }, [committedMode, computerPlays]);

  // Stable-identity refs so effects don't re-run on clock ticks
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const currentMoveIndexRef = useRef(currentMoveIndex);
  currentMoveIndexRef.current = currentMoveIndex;
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // Apply a move
  const applyMove = useCallback(
    (source: string, target: string, promotion = 'q'): boolean => {
      const idx = currentMoveIndexRef.current;
      const pos = positionsRef.current;
      const currentFen = pos[idx + 1] || pos[0];
      const g = new Chess(currentFen);
      let move;
      try {
        move = g.move({ from: source, to: target, promotion });
      } catch {
        return false;
      }
      if (!move) return false;

      if (g.isCheckmate()) soundRef.current.play('victory');
      else if (g.isDraw()) soundRef.current.play('draw');
      else if (g.inCheck()) soundRef.current.play('check');
      else if (move.flags.includes('k') || move.flags.includes('q')) soundRef.current.play('castle');
      else if (move.flags.includes('c') || move.flags.includes('e')) soundRef.current.play('capture');
      else soundRef.current.play('move');

      if (clockRef.current.tc) clockRef.current.pressMove(move.color);

      setMoveHistory((prev) => {
        const h = prev.slice(0, idx + 1);
        h.push(move.san);
        return h;
      });
      setPositions((prev) => {
        const p = prev.slice(0, idx + 2);
        p.push(g.fen());
        return p;
      });
      setGame(g);
      setCurrentMoveIndex((i) => i + 1);
      return true;
    },
    []
  );

  // Opponent turn — only fires during play phase vs CPU
  const requestMoveRef = useRef(sf.requestMove);
  requestMoveRef.current = sf.requestMove;

  const cpuToMove =
    gamePhase === 'playing' &&
    (committedMode === 'cpu' || committedMode === 'coach') &&
    !coachActive &&
    !!computerPlays &&
    currentMoveIndex === moveHistory.length - 1 &&
    game.turn() === computerPlays &&
    !game.isGameOver();
  const currentFenForEngine = cpuToMove ? game.fen() : null;

  useEffect(() => {
    if (!currentFenForEngine) return;
    const fen = currentFenForEngine;
    const timer = setTimeout(() => {
      requestMoveRef.current(fen, (move) => {
        const test = new Chess(fen);
        try {
          test.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
        } catch {
          return;
        }
        applyMove(move.from, move.to, move.promotion || 'q');
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [currentFenForEngine, applyMove]);

  // Board drop handler — blocked unless in playing phase
  // In coach mode, drops during coaching are routed through the retry validator.
  const onPieceDrop = useCallback(
    (source: string, target: string): boolean => {
      if (gamePhase !== 'playing') return false;

      if (coachActive && (coachSubPhase === 'explain' || coachSubPhase === 'retry-wrong')) {
        // User is trying to find a better move
        const preFen = coachPreFenRef.current;
        const bestUci = coachBestMoveUciRef.current;
        if (!preFen || !bestUci) return false;

        // Validate the move is legal in preFen
        const tryGame = new Chess(preFen);
        let tried;
        try {
          tried = tryGame.move({ from: source, to: target, promotion: 'q' });
        } catch {
          return false;
        }
        if (!tried) return false;

        const triedUci = `${tried.from}${tried.to}${tried.promotion || ''}`;
        const isExact = triedUci === bestUci;

        if (isExact) {
          // Correct! Apply the move.
          soundRef.current.play('victory');
          applyMove(source, target, 'q');
          setCoachLastAttemptSan(tried.san);
          setCoachSubPhase('retry-correct');
        } else {
          // Wrong — decrement attempts, keep board at preFen
          soundRef.current.play('move');
          const remaining = coachAttemptsLeft - 1;
          setCoachAttemptsLeft(remaining);
          setCoachLastAttemptSan(tried.san);
          if (remaining <= 0) {
            setCoachSubPhase('reveal');
          } else {
            setCoachSubPhase('retry-wrong');
          }
        }
        return false; // visually snap back; we handled via applyMove if correct
      }

      return applyMove(source, target);
    },
    [applyMove, gamePhase, coachActive, coachSubPhase, coachAttemptsLeft]
  );

  // Game-end detection — transitions phase to 'ended'
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    if (!game.isGameOver() || gameResult) return;
    const key = `${game.fen()}|${moveHistory.length}`;
    if (gameResultShownRef.current === key) return;
    gameResultShownRef.current = key;

    let result: GameResult;
    if (game.isCheckmate()) result = { type: 'checkmate', winner: game.turn() === 'w' ? 'b' : 'w' };
    else if (game.isStalemate()) result = { type: 'stalemate' };
    else if (game.isThreefoldRepetition()) result = { type: 'draw', reason: 'Draw by repetition' };
    else if (game.isInsufficientMaterial()) result = { type: 'draw', reason: 'Draw — insufficient material' };
    else result = { type: 'draw', reason: 'Draw' };

    clock.stop();
    setGameResult(result);
    setGamePhase('ended');
  }, [gamePhase, game, gameResult, moveHistory.length, clock]);

  const goToMove = useCallback(
    (index: number) => {
      boardRef.current?.clearPremoves();
      setCurrentMoveIndex(index);
      const fen = positions[index + 1] || positions[0];
      setGame(new Chess(fen));
    },
    [positions]
  );

  // Start a game with the current draft settings
  const startGame = useCallback(() => {
    sf.cancelMove();
    boardRef.current?.clearPremoves();

    // Both 'cpu' and 'coach' modes play against the computer
    if (draftMode === 'cpu' || draftMode === 'coach') {
      if (!sf.opponentEnabled) sf.toggleOpponent();
      sf.setOpponentColor(draftCpuColor);
      sf.setElo(draftCpuElo);
      setComputerPlays(
        draftCpuColor === 'random'
          ? Math.random() < 0.5 ? 'w' : 'b'
          : draftCpuColor === 'white' ? 'w' : 'b'
      );
    } else {
      if (sf.opponentEnabled) sf.toggleOpponent();
      setComputerPlays(null);
    }
    if (draftTc) clock.start(draftTc);
    else clock.disable();

    // Reset board
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

    setCommittedMode(draftMode);
    setGamePhase('playing');
  }, [sf, clock, draftMode, draftCpuColor, draftCpuElo, draftTc]);

  // Return to setup (quit current game or after game end)
  const backToSetup = useCallback(() => {
    sf.cancelMove();
    boardRef.current?.clearPremoves();
    clock.stop();
    clock.disable();
    setGameResult(null);
    gameResultShownRef.current = null;
    setGamePhase('setup');
  }, [sf, clock]);

  const undoMove = useCallback(() => {
    if (moveHistory.length === 0) return;
    if (gamePhase !== 'playing') return;
    sf.cancelMove();
    boardRef.current?.clearPremoves();
    const vsCpu = committedMode === 'cpu' || committedMode === 'coach';
    const undoCount = vsCpu && moveHistory.length >= 2 ? 2 : 1;
    const newHistory = moveHistory.slice(0, -undoCount);
    const newPositions = positions.slice(0, -undoCount);
    const fen = newPositions[newPositions.length - 1];
    setGame(new Chess(fen));
    setMoveHistory(newHistory);
    setPositions(newPositions);
    setCurrentMoveIndex(newHistory.length - 1);
    setMoveEvals((p) => p.slice(0, newHistory.length));
    setNags((p) => p.slice(0, newHistory.length));
  }, [moveHistory, positions, sf, gamePhase, committedMode]);

  const importPgn = useCallback(
    (pgn: string) => {
      const g = new Chess();
      try {
        g.loadPgn(pgn);
      } catch {
        showToast('Invalid PGN');
        return;
      }
      const history = g.history();
      const all = [new Chess().fen()];
      const replay = new Chess();
      for (const m of history) {
        try {
          replay.move(m);
        } catch {
          break;
        }
        all.push(replay.fen());
      }
      // Imported games are analysis-only (free play mode, no timer, no CPU).
      if (sf.opponentEnabled) sf.toggleOpponent();
      clock.disable();
      setComputerPlays(null);
      setCommittedMode('free');
      setGame(new Chess(all[all.length - 1]));
      setMoveHistory(history.slice(0, all.length - 1));
      setPositions(all);
      setCurrentMoveIndex(all.length - 2);
      setMoveEvals(Array(all.length - 1).fill(null));
      setNags(Array(all.length - 1).fill(null));
      setGameResult(null);
      gameResultShownRef.current = null;
      // Imported game: skip setup and land straight in playing phase
      setGamePhase('playing');
    },
    [showToast, sf, clock]
  );

  useEffect(() => {
    const pgn = sessionStorage.getItem('loadPgn');
    if (pgn) {
      sessionStorage.removeItem('loadPgn');
      importPgn(pgn);
    }
  }, [importPgn]);

  const getPgnMeta = useCallback(() => {
    const vsCpu = committedMode === 'cpu' || committedMode === 'coach';
    const white = vsCpu && computerPlays === 'w' ? `CPU (${sf.elo})` : 'Human';
    const black = vsCpu && computerPlays === 'b' ? `CPU (${sf.elo})` : 'Human';
    return {
      event: committedMode === 'coach' ? 'Training Game' : vsCpu ? 'vs Computer' : 'Casual Game',
      site: 'chess.danmarzari.com',
      date: todayTag(),
      white,
      black,
      eco: opening?.eco,
      opening: opening?.name,
    };
  }, [committedMode, computerPlays, sf.elo, opening]);

  const exportPgn = useCallback(() => {
    const pgn = buildPgn(moveHistory, getPgnMeta());
    navigator.clipboard.writeText(pgn);
    showToast('PGN copied');
  }, [moveHistory, getPgnMeta, showToast]);

  const saveGame = useCallback(async () => {
    const meta = getPgnMeta();
    const pgn = buildPgn(moveHistory, meta);
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pgn,
          title: `${meta.white} vs ${meta.black} — ${meta.date}`,
          white: meta.white,
          black: meta.black,
        }),
      });
      showToast(res.ok ? 'Saved' : 'Save failed');
    } catch {
      showToast('Save failed');
    }
  }, [moveHistory, getPgnMeta, showToast]);

  const handleResign = useCallback(() => {
    if (gamePhase !== 'playing' || !computerPlays) return;
    if (committedMode !== 'cpu' && committedMode !== 'coach') return;
    sound.play('defeat');
    clock.stop();
    setGameResult({ type: 'resign', winner: computerPlays });
    setGamePhase('ended');
  }, [gamePhase, committedMode, computerPlays, sound, clock]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // ------- Coach actions --------------------------------------------------
  const dismissCoach = useCallback(() => {
    setCoachActive(false);
    setCoachSubPhase('analyzing');
    setCoachExplanation(null);
    setCoachLastAttemptSan(null);
    coachBadMoveUciRef.current = null;
    coachPreFenRef.current = null;
    coachBestMoveUciRef.current = null;
    coachBestPvRef.current = [];
    coachResponsePvRef.current = [];
    coachBadIndexRef.current = -1;
    // Resume the clock so the CPU's turn can run out normally
    clockRef.current.resume();
  }, []);

  // Skip: keep the original bad move, proceed normally
  const coachSkip = useCallback(() => {
    const preFen = coachPreFenRef.current;
    const badUci = coachBadMoveUciRef.current;
    if (!preFen || !badUci) {
      dismissCoach();
      return;
    }
    // Re-apply the original move
    const tryGame = new Chess(preFen);
    try {
      const m = tryGame.move({
        from: badUci.slice(0, 2),
        to: badUci.slice(2, 4),
        promotion: badUci.slice(4, 5) || 'q',
      });
      if (m) {
        applyMove(m.from, m.to, m.promotion || 'q');
      }
    } catch {
      // ignore
    }
    dismissCoach();
  }, [applyMove, dismissCoach]);

  // Show solution: apply the engine's best move and proceed
  const coachShowSolution = useCallback(() => {
    const preFen = coachPreFenRef.current;
    const bestUci = coachBestMoveUciRef.current;
    if (!preFen || !bestUci) {
      setCoachSubPhase('reveal');
      return;
    }
    setCoachSubPhase('reveal');
  }, []);

  // Continue (after reveal or correct answer)
  const coachContinue = useCallback(() => {
    // If we're in 'reveal', apply the engine's best move now
    if (coachSubPhase === 'reveal') {
      const preFen = coachPreFenRef.current;
      const bestUci = coachBestMoveUciRef.current;
      if (preFen && bestUci) {
        const g = new Chess(preFen);
        try {
          const m = g.move({
            from: bestUci.slice(0, 2),
            to: bestUci.slice(2, 4),
            promotion: bestUci.slice(4, 5) || 'q',
          });
          if (m) applyMove(m.from, m.to, m.promotion || 'q');
        } catch {
          // ignore
        }
      }
    }
    dismissCoach();
  }, [coachSubPhase, applyMove, dismissCoach]);

  const saveAnnotation = useCallback((idx: number, value: string) => {
    setAnnotations((prev) => {
      const next = { ...prev };
      if (value) next[idx] = value;
      else delete next[idx];
      return next;
    });
    setAnnotating(null);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') setAnnotating(null);
      else if (e.key === 'ArrowLeft' && currentMoveIndex >= 0) goToMove(currentMoveIndex - 1);
      else if (e.key === 'ArrowRight' && currentMoveIndex < moveHistory.length - 1)
        goToMove(currentMoveIndex + 1);
      else if (e.key === 'Home') goToMove(-1);
      else if (e.key === 'End') goToMove(moveHistory.length - 1);
      else if (e.key === 'f' || e.key === 'F')
        setBoardOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else if (e.key === 'n' || e.key === 'N') backToSetup();
      else if (e.key === 'u' || e.key === 'U') undoMove();
      else if (e.key === 's' || e.key === 'S') saveGame();
      else if (e.key === 'x' || e.key === 'X') exportPgn();
      else if (e.key === 'i' || e.key === 'I') setShowImport(true);
      else if (e.key === 'r' || e.key === 'R') handleResign();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    currentMoveIndex,
    moveHistory.length,
    goToMove,
    backToSetup,
    undoMove,
    saveGame,
    exportPgn,
    handleResign,
  ]);

  const currentFen = positions[currentMoveIndex + 1] || positions[0];

  const lastMove = useMemo(() => {
    if (currentMoveIndex < 0) return null;
    try {
      const g = new Chess();
      for (let i = 0; i <= currentMoveIndex; i++) g.move(moveHistory[i]);
      const hist = g.history({ verbose: true });
      const last = hist[hist.length - 1];
      return last ? { from: last.from, to: last.to } : null;
    } catch {
      return null;
    }
  }, [currentMoveIndex, moveHistory]);

  const primaryScore = sf.lines[0]?.score ?? null;
  const primaryMate = sf.lines[0]?.mate ?? null;

  const allowPremoves =
    gamePhase === 'playing' &&
    (committedMode === 'cpu' || committedMode === 'coach') &&
    !coachActive &&
    !!computerPlays;

  // When reveal phase shows the best move, overlay an arrow on the board
  const coachArrow: { from: Square; to: Square; color?: string } | null =
    coachActive && coachSubPhase === 'reveal' && coachBestMoveUciRef.current
      ? {
          from: coachBestMoveUciRef.current.slice(0, 2) as Square,
          to: coachBestMoveUciRef.current.slice(2, 4) as Square,
          color: '#759900',
        }
      : hoverArrow;

  return (
    <div className="max-w-7xl mx-auto p-2 md:p-4">
      <div className="flex flex-col lg:flex-row gap-3 items-start justify-center">
        {/* Left: eval bar (hidden during setup) */}
        {gamePhase !== 'setup' && (
          <div className="hidden lg:block shrink-0">
            <EvalBar
              score={primaryScore}
              mate={primaryMate}
              depth={sf.depth}
              height={BOARD_WIDTH}
              orientation={boardOrientation}
              isAnalyzing={sf.isAnalyzing}
            />
          </div>
        )}

        {/* Center: board + clocks + status */}
        <div
          className={`shrink-0 mx-auto lg:mx-0 space-y-2 ${gamePhase === 'setup' ? 'opacity-60 pointer-events-none' : ''}`}
          style={{ maxWidth: BOARD_WIDTH, width: '100%' }}
        >
          {clock.tc && gamePhase !== 'setup' && (
            <ClockDisplay
              seconds={boardOrientation === 'white' ? clock.state.black : clock.state.white}
              active={clock.state.activeColor === (boardOrientation === 'white' ? 'b' : 'w')}
              flagged={clock.state.flagged === (boardOrientation === 'white' ? 'b' : 'w')}
              label={boardOrientation === 'white' ? 'Black' : 'White'}
            />
          )}

          <ChessBoard
            ref={boardRef}
            position={currentFen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            boardWidth={BOARD_WIDTH}
            showCoords={showCoords}
            lastMove={lastMove}
            externalArrow={coachArrow}
            allowPremoves={allowPremoves}
          />

          {clock.tc && gamePhase !== 'setup' && (
            <ClockDisplay
              seconds={boardOrientation === 'white' ? clock.state.white : clock.state.black}
              active={clock.state.activeColor === (boardOrientation === 'white' ? 'w' : 'b')}
              flagged={clock.state.flagged === (boardOrientation === 'white' ? 'w' : 'b')}
              label={boardOrientation === 'white' ? 'White' : 'Black'}
            />
          )}

          {gamePhase !== 'setup' && (
            <>
              <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                <span className="text-[var(--foreground-strong)]">{status}</span>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  {(committedMode === 'cpu' || committedMode === 'coach') && computerPlays && (
                    <span>
                      You: {computerPlays === 'w' ? '● Black' : '○ White'}
                      <span className="mx-2 text-[var(--border)]">|</span>
                      CPU {sf.elo}
                    </span>
                  )}
                  {allowPremoves && (
                    <span className="text-[10px] opacity-70">right-click to clear premoves</span>
                  )}
                </div>
              </div>

              {moveHistory.length > 0 && (
                <CpLossGraph
                  evals={moveEvals}
                  nags={nags}
                  currentMoveIndex={currentMoveIndex}
                  onJumpTo={goToMove}
                  width={BOARD_WIDTH}
                />
              )}

              <div className="flex items-center justify-between text-xs">
                <div className="text-[var(--muted)] truncate">
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
                  <div className="flex items-center gap-3 font-mono shrink-0">
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
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 space-y-2 w-full min-w-[280px] lg:max-w-sm">
          {gamePhase === 'setup' ? (
            <SetupPanel
              mode={draftMode}
              onModeChange={setDraftMode}
              cpuColor={draftCpuColor}
              onCpuColorChange={setDraftCpuColor}
              cpuElo={draftCpuElo}
              onCpuEloChange={setDraftCpuElo}
              tc={draftTc}
              onTcChange={setDraftTc}
              onStart={startGame}
            />
          ) : (
            <>
              {coachActive && (
                <CoachPanel
                  subPhase={coachSubPhase}
                  explanation={coachExplanation}
                  attemptsLeft={coachAttemptsLeft}
                  badMoveSan={coachBadMoveSan}
                  lastAttemptSan={coachLastAttemptSan}
                  onSkip={coachSkip}
                  onShowSolution={coachShowSolution}
                  onContinue={coachContinue}
                />
              )}
              <GameStatusPanel
                mode={committedMode}
                cpuColor={computerPlays}
                cpuElo={sf.elo}
                tc={clock.tc}
                isCpuThinking={sf.isComputerThinking}
                onQuit={backToSetup}
                onResign={handleResign}
                canResign={
                  gamePhase === 'playing' &&
                  (committedMode === 'cpu' || committedMode === 'coach') &&
                  !!computerPlays &&
                  !coachActive
                }
                phase={gamePhase}
              />
              <EngineAnalysis
                lines={sf.lines}
                depth={sf.depth}
                isThinking={sf.isAnalyzing}
                onHoverLine={setHoverArrow}
              />
              <LiveStats
                nags={nags}
                whiteAccuracy={whiteAcc}
                blackAccuracy={blackAcc}
                moveCount={moveHistory.length}
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
                onNewGame={backToSetup}
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
                canUndo={moveHistory.length > 0 && gamePhase === 'playing'}
                canGoBack={currentMoveIndex > -1}
                canGoForward={currentMoveIndex < moveHistory.length - 1}
                canResign={
                  gamePhase === 'playing' &&
                  (committedMode === 'cpu' || committedMode === 'coach') &&
                  !!computerPlays
                }
              />
            </>
          )}
        </div>
      </div>

      <PgnImport isOpen={showImport} onClose={() => setShowImport(false)} onImport={importPgn} />

      <GameEndModal
        result={gameResult}
        humanColor={
          (committedMode === 'cpu' || committedMode === 'coach') && computerPlays
            ? computerPlays === 'w' ? 'b' : 'w'
            : null
        }
        whiteAccuracy={whiteAcc}
        blackAccuracy={blackAcc}
        nags={nags}
        onClose={() => setGameResult(null)}
        onNewGame={() => {
          setGameResult(null);
          backToSetup();
        }}
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
