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
import CoachPanel, { type CoachSubPhase, type DemoMove } from '@/components/CoachPanel';
import PgnImport from '@/components/PgnImport';
import { ClockDisplay } from '@/components/Clock';
import GameEndModal, { type GameResult } from '@/components/GameEndModal';
import AnnotationEditor from '@/components/AnnotationEditor';
import { useStockfish, type OpponentColor } from '@/hooks/useStockfish';
import { useSound } from '@/hooks/useSound';
import { useClock, type TimeControl } from '@/hooks/useClock';
import { useSettings } from '@/hooks/useSettings';
import { cpToWinPercent, classifyMove, moveAccuracy, type NagType, type PlyEval } from '@/lib/accuracy';
import { identifyOpening } from '@/lib/openings';
import { buildPgn, todayTag } from '@/lib/pgn';
import { explainMove, isWinningCapture, type CoachExplanation } from '@/lib/coaching';
import { readUserRating, writeUserRating, updateRating, mentorOpponentRating } from '@/lib/rating';

const BOARD_WIDTH = 560;

type GamePhase = 'setup' | 'playing' | 'ended';

// Material balance for `perspective` minus opponent, in pawn-equivalents.
// Used by the coach demo to detect when the refutation's advantage is "exposed".
function relativeMaterial(fen: string, perspective: 'w' | 'b'): number {
  const vals: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  try {
    const g = new Chess(fen);
    let mine = 0;
    let theirs = 0;
    for (const row of g.board()) {
      for (const cell of row) {
        if (!cell) continue;
        const v = vals[cell.type] || 0;
        if (cell.color === perspective) mine += v;
        else theirs += v;
      }
    }
    return mine - theirs;
  } catch {
    return 0;
  }
}

// Walks `pv` from `startFen` and returns true if the line ends with `perspective`
// having lost net material of at least `thresholdPawns`. Used to filter out
// purely positional "mistakes" from triggering the coach when the user has
// opted out of positional coaching.
function lineEndsInMaterialLoss(
  startFen: string,
  pv: string[],
  perspective: 'w' | 'b',
  thresholdPawns = 1,
  maxPlies = 14
): boolean {
  const startBalance = relativeMaterial(startFen, perspective);
  let pos = startFen;
  let observedMate = false;
  for (let i = 0; i < Math.min(pv.length, maxPlies); i++) {
    const uci = pv[i];
    if (!uci || uci.length < 4) break;
    try {
      const g = new Chess(pos);
      g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || 'q' });
      pos = g.fen();
      if (g.isCheckmate()) {
        observedMate = true;
        break;
      }
    } catch {
      break;
    }
  }
  // Mate against the student counts as a material-losing line for our purposes.
  if (observedMate) {
    // Was it our king mated? It's mate in the resulting position; if the side
    // to move is `perspective`, then `perspective` is being mated.
    try {
      const g = new Chess(pos);
      if (g.turn() === perspective) return true;
    } catch {
      // ignore
    }
  }
  const endBalance = relativeMaterial(pos, perspective);
  return startBalance - endBalance >= thresholdPawns;
}

interface PlayViewProps {
  // Which setup modes the user can pick between. When only one mode is
  // allowed, SetupPanel hides the Mode selector and locks to it.
  allowedModes?: GameMode[];
  // Optional tab label shown above the setup card (e.g. "Mentor", "Explore")
  tabLabel?: string;
  // When true, opponent ELO is driven by the user's stored rating instead
  // of being picked from the slider (Mentor uses this).
  adaptiveElo?: boolean;
}

export default function PlayView({
  allowedModes = ['cpu', 'coach', 'free'],
  tabLabel,
  adaptiveElo = false,
}: PlayViewProps = {}) {
  // User's adaptive rating (only meaningful when adaptiveElo === true)
  const [userRating, setUserRatingState] = useState(1200);
  useEffect(() => {
    setUserRatingState(readUserRating());
  }, []);
  // Game phase — controls the entire lifecycle
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');

  // Draft settings — edited in setup phase, committed on Start.
  // Default the draft mode to the first allowed mode so single-mode tabs
  // (e.g. Mentor) always start on the right option.
  const defaultMode: GameMode = allowedModes[0] ?? 'cpu';
  const [draftMode, setDraftMode] = useState<GameMode>(defaultMode);
  const [draftCpuColor, setDraftCpuColor] = useState<OpponentColor>('black');
  const [draftCpuElo, setDraftCpuElo] = useState(1500);
  // When adaptiveElo, keep the draft ELO in sync with the user's rating.
  useEffect(() => {
    if (adaptiveElo) setDraftCpuElo(mentorOpponentRating(userRating));
  }, [adaptiveElo, userRating]);
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

  // Auto-save bookkeeping. Coach games (Mentor) and Explore games are saved
  // automatically once the user has actually played at least one move so they
  // show up in /review stats. Loaded PGNs are NOT auto-saved unless the user
  // adds moves to them.
  const gameHasUserMovesRef = useRef(false);
  const autoSavedKeyRef = useRef<string | null>(null);
  // How many times the coach has actually intervened in the current game.
  // Persisted with the game so /review can sum it as "Learning" engagement.
  const coachingMomentsCountRef = useRef(0);
  // Snapshot of the user's rating at the start of the current game. Saved
  // with the game so /review can plot your rating trend over time.
  const gameStartRatingRef = useRef<number | null>(null);
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
  // Position override — when non-null, the chessboard shows THIS fen instead
  // of game.fen(). Used during the demo playout of the bad move's consequences.
  const [demoPosition, setDemoPosition] = useState<string | null>(null);
  // An arrow drawn on the board (during demo, previews the upcoming move).
  const [demoArrow, setDemoArrow] = useState<{ from: Square; to: Square; color?: string } | null>(null);
  // The refutation PV we captured from the engine at trigger time (UCI moves).
  const coachRefutationRef = useRef<string[]>([]);
  // Top 3 best-move UCIs from preFen (captured during analyzing→explain).
  // Used to give progressive square hints during retry-wrong:
  //   - 2 attempts left (after first miss): highlight FROM-squares of all 3
  //   - 1 attempt left  (after second miss): highlight FROM-square of top 1
  const [coachTop3Ucis, setCoachTop3Ucis] = useState<string[]>([]);
  // Retry-demo queue + text (populated when user plays a wrong retry attempt)
  const retryDemoQueueRef = useRef<string[]>([]);
  const retryDemoStartFenRef = useRef<string | null>(null);
  // UCI of the user's most recent retry attempt — used by retry-good to
  // commit the move when the engine confirms it's a reasonable choice.
  const retryAttemptUciRef = useRef<string | null>(null);
  const [retryRefutationText, setRetryRefutationText] = useState<string | null>(null);

  // Demo move recording — both the main demo and the retry-demo populate
  // this as they play out, so the user can later branch into the line.
  const demoMoveLogRef = useRef<DemoMove[]>([]);
  const [demoMoveLog, setDemoMoveLog] = useState<DemoMove[]>([]);

  // Contest state — when the user clicks a move in the demo history to try
  // an alternative. The engine plays its response at FULL strength.
  const [contestCycle, setContestCycle] = useState(0); // 0..2; capped by UI at 3
  const [contestStartIdx, setContestStartIdx] = useState<number | null>(null);
  const [contestUserSan, setContestUserSan] = useState<string | null>(null);
  const [contestEngineSan, setContestEngineSan] = useState<string | null>(null);
  const [contestResultText, setContestResultText] = useState<string | null>(null);
  const contestStartFenRef = useRef<string | null>(null); // FEN before user's contest move
  const contestUserUciRef = useRef<string | null>(null); // user's contest move
  const contestPostUserFenRef = useRef<string | null>(null); // FEN after user's contest move
  // Stash the previous coach sub-phase so we can return to it on contest exit
  const contestReturnSubPhaseRef = useRef<CoachSubPhase>('retry-wrong');
  // Hover preview: when the user hovers a demo move in the coach panel, we
  // override the board to show that position (with the demo move as a
  // neutral-colored arrow) so they can pick the right one before clicking.
  const [demoHoverIdx, setDemoHoverIdx] = useState<number | null>(null);

  const sf = useStockfish();
  const sound = useSound();
  const settings = useSettings();

  // Persist key for the in-progress game. Defined early so the callbacks
  // below (startGame, backToSetup, etc.) can list clearPersistedGame in
  // their dep arrays without hitting TDZ during render.
  const persistKey = `chess-active-game-${tabLabel ?? 'default'}`;
  const clearPersistedGame = useCallback(() => {
    try {
      localStorage.removeItem(persistKey);
    } catch {
      /* ignore */
    }
  }, [persistKey]);

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
    // Respect user's coaching preferences — skip NAG types they've turned off.
    if (nag === 'blunder' && !settings.coachOnBlunder) return;
    if (nag === 'mistake' && !settings.coachOnMistake) return;
    if (nag === 'inaccuracy' && !settings.coachOnInaccuracy) return;

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

    // Capture the refutation: the engine's best line from the CURRENT
    // (post-bad-move) position. Require depth ≥ 14 before trusting the PV —
    // at shallower depths, the tail of the PV can contain noise moves (the
    // "hung rook in the middle of the line" problem). Truncate to at most
    // half the depth (plus one) as a safety net so we never play plies the
    // engine hasn't verified.
    const primaryForRefutation = sf.lines[0];
    const pvDepth = primaryForRefutation?.depth ?? 0;
    if (!primaryForRefutation || pvDepth < 14) return;
    const pv = primaryForRefutation.pv.trim().split(/\s+/).filter(Boolean);
    const trustedPlies = Math.min(12, Math.max(4, Math.floor(pvDepth / 2) + 1));
    coachRefutationRef.current = pv.slice(0, trustedPlies);
    // Clear demo log + contest state for the new lesson
    demoMoveLogRef.current = [];
    setDemoMoveLog([]);
    setContestCycle(0);
    setContestStartIdx(null);
    setContestUserSan(null);
    setContestEngineSan(null);
    setContestResultText(null);

    // Positional-only filter: if the engine's line doesn't end in net material
    // loss for the student, and the user has opted out of positional coaching,
    // skip the trigger entirely. Mark the move so we don't re-examine it.
    //
    // Important: measure material change from the PRE-bad-move position with
    // the user's move included as the first ply. Otherwise an even trade like
    // Bxg6 / fxg6 looks like "you lost a bishop" because we'd start from the
    // post-Bxg6 position (where you had a freebie bishop) — but you also
    // captured one in your move, so the net is zero.
    const fullLine = badUci ? [badUci, ...pv] : pv;
    if (
      !settings.coachOnPositional &&
      fullLine.length > 0 &&
      !lineEndsInMaterialLoss(preFen, fullLine, mover)
    ) {
      // Positional-only bail: this move isn't worth coaching under current
      // settings. Mark handled so we don't re-examine it on subsequent renders.
      coachedIndicesRef.current.add(lastIdx);
      return;
    }

    // We're committing to coach this move — mark it handled so re-renders
    // don't re-trigger after coach state resolves.
    coachedIndicesRef.current.add(lastIdx);

    // DO NOT rewind the game state yet. We want the user to see their move
    // finish animating, then the demo plays out the consequences, THEN we
    // rewind to the pre-move position for the explanation + retry.

    // Pause the clock immediately so no time bleeds during the lesson.
    clockRef.current.pause();

    // Count this as a coaching moment for engagement tracking
    coachingMomentsCountRef.current += 1;

    // Activate coach; demo starts after a brief pause.
    setCoachActive(true);
    setCoachSubPhase('pausing');
    setCoachExplanation(null);
    setCoachAttemptsLeft(3);
    setCoachBadMoveSan(badSan);
    setCoachLastAttemptSan(null);
    coachBestMoveUciRef.current = null;
    coachBestPvRef.current = [];
    coachResponsePvRef.current = [];
    // Also store the current engine's PV as the "refutation response" so the
    // heuristic explainer has something concrete to point at.
    if (pv.length > 0) coachResponsePvRef.current = pv.slice(0, 2);
  }, [gamePhase, committedMode, coachActive, moveHistory, nags, moveEvals, computerPlays, positions, sf.lines, settings]);

  // Transition 'pausing' → 'demo' after a short beat.
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'pausing') return;
    const t = setTimeout(() => {
      // Seed demo position at the post-bad-move FEN (what's currently on the board)
      const postBadFen = positions[coachBadIndexRef.current + 1] || null;
      if (postBadFen && coachRefutationRef.current.length > 0) {
        setDemoPosition(postBadFen);
        setCoachSubPhase('demo');
      } else {
        // No refutation line available (engine didn't get far enough in time) —
        // skip the demo and go straight to rewinding.
        setCoachSubPhase('rewinding');
      }
    }, 900);
    return () => clearTimeout(t);
  }, [coachActive, coachSubPhase, positions]);

  // Demo playback: walk the engine's refutation line. Termination logic is
  // TRADE-AWARE — once the advantage is exposed (material loss for student,
  // or mate), we keep playing through any in-progress capture sequence and
  // only stop when the dust has settled (≥ 2 consecutive non-capture plies).
  // This guarantees the demo never cuts off mid-trade and obscures the actual
  // material outcome. Hard cap at 16 plies as a safety net.
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'demo') return;
    const moves = coachRefutationRef.current;
    if (moves.length === 0) {
      setCoachSubPhase('rewinding');
      return;
    }

    let cancelled = false;
    const postBadFen = positions[coachBadIndexRef.current + 1] || positions[0];
    let currentPos = postBadFen;
    let idx = 0;
    const mover = coachMoverRef.current; // the student's color
    const startBalance = relativeMaterial(postBadFen, mover);
    let exposedAtIdx: number | null = null;
    let nonCaptureStreak = 0;
    const SOFT_CAP = 16;
    const HARD_CAP = 20;

    const playNext = () => {
      if (cancelled) return;
      if (idx >= moves.length || idx >= HARD_CAP) {
        setTimeout(() => {
          if (cancelled) return;
          setDemoArrow(null);
          setDemoMoveLog([...demoMoveLogRef.current]);
          setCoachSubPhase('rewinding');
        }, 1400);
        return;
      }

      const uci = moves[idx];
      if (!uci || uci.length < 4) {
        setCoachSubPhase('rewinding');
        return;
      }

      const arrowColor = idx % 2 === 0 ? '#dc322f' : '#3893e8';
      setDemoArrow({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, color: arrowColor });

      setTimeout(() => {
        if (cancelled) return;
        const g = new Chess(currentPos);
        try {
          const m = g.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.slice(4, 5) || 'q',
          });
          const isCapture = !!m?.captured || (m?.flags?.includes('e') ?? false);
          if (isCapture) soundRef.current.play('capture');
          else if (g.inCheck()) soundRef.current.play('check');
          else soundRef.current.play('move');
          const fenBefore = currentPos;
          currentPos = g.fen();
          setDemoPosition(currentPos);
          setDemoArrow(null);
          // Record into the demo log so the user can later contest this move
          if (m) {
            demoMoveLogRef.current.push({
              uci,
              san: m.san,
              fenBefore,
              fenAfter: currentPos,
              mover: m.color,
              ply: idx,
            });
          }
          idx++;
          if (isCapture) nonCaptureStreak = 0;
          else nonCaptureStreak++;

          const currentBalance = relativeMaterial(currentPos, mover);
          const delta = startBalance - currentBalance;
          const isTerminal = g.isGameOver();
          if (exposedAtIdx === null && (delta >= 1 || isTerminal)) {
            exposedAtIdx = idx - 1;
          }

          // Trade-aware stop: once exposed AND the trade has settled (2 quiet
          // plies in a row) → stop. Otherwise hard-cap at SOFT_CAP if the
          // last move was non-capture, HARD_CAP unconditionally.
          //
          // Purely positional refutations (no material ever shifts) are the
          // worst case for overstay — without a "loss moment" to anchor on,
          // the demo used to play ~16 plies of the engine's main variation,
          // which made the user wonder whether those plies were really best
          // for both sides. Cap them at 6 plies so the user sees just enough
          // of the engine's idea to judge whether the resulting position is
          // worse for them.
          const POSITIONAL_CAP = 6;
          const tradeSettled = exposedAtIdx !== null && nonCaptureStreak >= 2;
          const softLimit = idx >= SOFT_CAP && !isCapture;
          const positionalLimit = exposedAtIdx === null && idx >= POSITIONAL_CAP && !isCapture;

          if (isTerminal || tradeSettled || softLimit || positionalLimit) {
            setTimeout(() => {
              if (cancelled) return;
              setDemoArrow(null);
              // Publish the demo log so the user can branch in
              setDemoMoveLog([...demoMoveLogRef.current]);
              setCoachSubPhase('rewinding');
            }, 1300);
            return;
          }

          setTimeout(playNext, 800);
        } catch {
          setCoachSubPhase('rewinding');
        }
      }, 750);
    };

    const kick = setTimeout(playNext, 300);
    return () => {
      cancelled = true;
      clearTimeout(kick);
    };
  }, [coachActive, coachSubPhase, positions]);

  // ----- Retry-analyzing → retry-demo --------------------------------------
  // After the user plays a wrong retry attempt, we hand the engine the
  // post-attempt FEN and wait for a usable PV. Then we either:
  //   - play it out (if the eval drop is meaningful), OR
  //   - skip the demo and tell the user it was a reasonable move
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'retry-analyzing') return;
    if (sf.lines.length === 0) return;

    const primary = sf.lines[0];
    if (primary.depth < 14) return; // need reliable depth for the demo's tail moves

    const attemptFen = retryDemoStartFenRef.current;
    if (!attemptFen) {
      setCoachSubPhase('retry-wrong');
      return;
    }

    const pvTokens = primary.pv.trim().split(/\s+/).filter(Boolean);
    if (pvTokens.length === 0) return;
    // Depth-scaled truncation: never show moves beyond the engine's reliable
    // lookahead. At depth 14 we trust ~8 plies, at depth 20 we trust ~11.
    const retryTrusted = Math.min(12, Math.max(4, Math.floor(primary.depth / 2) + 1));

    // Staleness guard: PV's first move must be legal at attemptFen.
    try {
      const g = new Chess(attemptFen);
      const r = g.move({
        from: pvTokens[0].slice(0, 2),
        to: pvTokens[0].slice(2, 4),
        promotion: pvTokens[0].slice(4, 5) || 'q',
      });
      if (!r) return;
    } catch {
      return;
    }

    // Eval drop FROM THE STUDENT'S PERSPECTIVE.
    // sf normalizes scores to white's POV; convert to mover's POV.
    const evalBeforeWhite = coachEvalsRef.current.before;
    const evalAfterWhite = primary.mate !== null
      ? primary.mate > 0 ? 10000 : -10000
      : primary.score;
    const mover = coachMoverRef.current;
    const dropForMover =
      mover === 'w' ? evalBeforeWhite - evalAfterWhite : evalAfterWhite - evalBeforeWhite;

    // Best-move SAN from preFen (already captured during the main analysis)
    const preFen = coachPreFenRef.current;
    const bestUci = coachBestMoveUciRef.current;
    let bestSan = '';
    if (preFen && bestUci) {
      try {
        const g = new Chess(preFen);
        const m = g.move({
          from: bestUci.slice(0, 2),
          to: bestUci.slice(2, 4),
          promotion: bestUci.slice(4, 5) || 'q',
        });
        if (m) bestSan = m.san;
      } catch {
        bestSan = '';
      }
    }

    // Helper to convert "user's attempt is fine, just not engine's #1" into
    // a retry-good celebration: applies the user's move, no decrement.
    const acceptAsGood = (text: string) => {
      setRetryRefutationText(text);
      setDemoPosition(null);
      setDemoArrow(null);
      // Apply the user's actual attempt to game state
      const u = retryAttemptUciRef.current;
      if (u) {
        try {
          applyMove(u.slice(0, 2), u.slice(2, 4), u.slice(4, 5) || 'q');
        } catch {
          // ignore
        }
      }
      setCoachSubPhase('retry-good');
    };

    // If the eval barely budged, this is an honest "fine but not best" call —
    // celebrate the move and don't decrement attempts.
    const SMALL_DROP_CP = 50;
    if (dropForMover < SMALL_DROP_CP) {
      const dropPawns = Math.max(0, dropForMover) / 100;
      acceptAsGood(
        bestSan
          ? `Reasonable move — the engine just slightly prefers ${bestSan} (about ${dropPawns.toFixed(1)} pawns better).`
          : `Reasonable move — engine prefers a different square.`
      );
      return;
    }

    // Positional-only retry: if the engine's PV from the attempt position
    // doesn't end in material loss AND the user has opted out of positional
    // coaching, treat it as a "good move" too — there's no concrete material
    // penalty, the engine just has a slight positional preference.
    const linesMaterialLoss = lineEndsInMaterialLoss(attemptFen, pvTokens, mover);
    if (!settings.coachOnPositional && !linesMaterialLoss) {
      const dropPawns = dropForMover / 100;
      acceptAsGood(
        bestSan
          ? `Engine gives no concrete material penalty here — it just prefers ${bestSan} positionally (about ${dropPawns.toFixed(1)} pawns).`
          : `No clear material refutation — engine prefers a different move positionally.`
      );
      return;
    }

    // Real refutation incoming — capture the PV, truncated to the depth-
    // scaled trusted length, and let the demo effect play it out.
    retryDemoQueueRef.current = pvTokens.slice(0, retryTrusted);
    setCoachSubPhase('retry-demo');
  }, [coachActive, coachSubPhase, sf.lines, coachAttemptsLeft, settings]);

  // Retry-demo: play through the engine's refutation line until the
  // material/positional advantage is exposed (or we hit the cap), then
  // rewind to preFen and enter retry-wrong with appropriate text.
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'retry-demo') return;

    let cancelled = false;
    const queue = retryDemoQueueRef.current;
    const startFen = retryDemoStartFenRef.current;
    if (!startFen || queue.length === 0) {
      setDemoPosition(null);
      setDemoArrow(null);
      setCoachSubPhase('retry-wrong');
      return;
    }

    let pos = startFen;
    let idx = 0;
    const mover = coachMoverRef.current;
    const startBalance = relativeMaterial(startFen, mover);
    let exposedAtIdx: number | null = null;
    let observedMate = false;
    let nonCaptureStreak = 0;
    const SOFT_CAP = 14;
    const HARD_CAP = 18;

    const finishDemo = () => {
      if (cancelled) return;
      setDemoPosition(null);
      setDemoArrow(null);

      const finalBalance = relativeMaterial(pos, mover);
      const delta = startBalance - finalBalance;
      let text: string;
      if (observedMate) {
        text = `That line ends in a forced mate against you.`;
      } else if (delta >= 2) {
        text = `That line costs you about ${delta.toFixed(0)} pawns of material.`;
      } else if (delta >= 1) {
        text = `That line drops about ${delta.toFixed(0)} pawn worth of material.`;
      } else {
        text = `Engine plays out that line and your position holds up — but it's not the strongest reply available.`;
      }
      setRetryRefutationText(text);
      // Publish the demo log so the user can branch in
      setDemoMoveLog([...demoMoveLogRef.current]);

      const remaining = coachAttemptsLeft - 1;
      setCoachAttemptsLeft(remaining);
      if (remaining <= 0) setCoachSubPhase('reveal');
      else setCoachSubPhase('retry-wrong');
    };

    const playNext = () => {
      if (cancelled) return;
      if (idx >= queue.length || idx >= HARD_CAP) {
        setTimeout(finishDemo, 1200);
        return;
      }

      const uci = queue[idx];
      if (!uci || uci.length < 4) {
        finishDemo();
        return;
      }

      const arrowColor = idx % 2 === 0 ? '#dc322f' : '#3893e8';
      setDemoArrow({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        color: arrowColor,
      });

      setTimeout(() => {
        if (cancelled) return;
        const g = new Chess(pos);
        try {
          const m = g.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.slice(4, 5) || 'q',
          });
          const isCapture = !!m?.captured || (m?.flags?.includes('e') ?? false);
          if (isCapture) soundRef.current.play('capture');
          else if (g.inCheck()) soundRef.current.play('check');
          else soundRef.current.play('move');
          const fenBefore = pos;
          pos = g.fen();
          setDemoPosition(pos);
          setDemoArrow(null);
          if (m) {
            demoMoveLogRef.current.push({
              uci,
              san: m.san,
              fenBefore,
              fenAfter: pos,
              mover: m.color,
              ply: idx,
            });
          }
          idx++;
          if (isCapture) nonCaptureStreak = 0;
          else nonCaptureStreak++;

          const balance = relativeMaterial(pos, mover);
          const delta = startBalance - balance;
          const isTerminal = g.isGameOver();
          if (isTerminal && g.isCheckmate()) observedMate = true;

          if (exposedAtIdx === null && (delta >= 1 || isTerminal)) {
            exposedAtIdx = idx - 1;
          }

          // Trade-aware termination: stop only when the exchange has settled.
          const tradeSettled = exposedAtIdx !== null && nonCaptureStreak >= 2;
          const softLimit = idx >= SOFT_CAP && !isCapture;

          if (isTerminal || tradeSettled || softLimit) {
            setTimeout(finishDemo, 1300);
            return;
          }

          setTimeout(playNext, 800);
        } catch {
          finishDemo();
        }
      }, 700);
    };

    const kick = setTimeout(playNext, 350);
    return () => {
      cancelled = true;
      clearTimeout(kick);
    };
  }, [coachActive, coachSubPhase, coachAttemptsLeft]);

  // Transition 'rewinding' → 'explain': actually rewind the game state now.
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'rewinding') return;
    const t = setTimeout(() => {
      // Clear demo overrides
      setDemoPosition(null);
      setDemoArrow(null);

      // Rewind the game state by removing the bad move from history.
      const badIdx = coachBadIndexRef.current;
      const preFen = coachPreFenRef.current;
      if (badIdx < 0 || !preFen) {
        setCoachSubPhase('explain');
        return;
      }
      setMoveHistory((prev) => prev.slice(0, badIdx));
      setPositions((prev) => prev.slice(0, badIdx + 1));
      setCurrentMoveIndex(badIdx - 1);
      setGame(new Chess(preFen));
      setMoveEvals((p) => p.slice(0, badIdx));
      setNags((p) => p.slice(0, badIdx));

      setCoachSubPhase('analyzing'); // wait for engine to reanalyze preFen for the explanation
    }, 650);
    return () => clearTimeout(t);
  }, [coachActive, coachSubPhase]);

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
    const preFenGuard = coachPreFenRef.current;
    if (!preFenGuard) return;

    // STALENESS GUARD: when the game was rewound to preFen, the engine had to
    // switch from analyzing the post-bad-move position (opponent to move) back
    // to preFen (you to move). While it's switching, sf.lines may briefly
    // hold stale PV data whose first move is a legal move for the OPPONENT
    // but isn't legal for you. If the PV's first move isn't playable from
    // preFen, treat it as stale and wait for the next update.
    try {
      const guardGame = new Chess(preFenGuard);
      const result = guardGame.move({
        from: bestUci.slice(0, 2),
        to: bestUci.slice(2, 4),
        promotion: bestUci.slice(4, 5) || 'q',
      });
      if (!result) return;
    } catch {
      return;
    }

    coachBestMoveUciRef.current = bestUci;
    coachBestPvRef.current = pvTokens;

    // Capture the FIRST move of each of the top-3 PVs (engine MultiPV is set
    // to 3 in useStockfish). Used by retry-wrong to give progressive hints.
    const top3 = sf.lines
      .slice(0, 3)
      .map((line) => line.pv?.trim().split(/\s+/)[0])
      .filter((u): u is string => !!u && u.length >= 4);
    setCoachTop3Ucis(top3);

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

    // Lightweight refutation heuristic: find the most valuable WINNING capture
    // the opponent has available in postBadFen (defender-aware — ignores
    // captures of defended pieces that would lose material). Only chess.js,
    // no engine call.
    try {
      const post = new Chess(postBadFen);
      const moves = post.moves({ verbose: true }) as Array<{
        from: string;
        to: string;
        flags: string;
        captured?: string;
        promotion?: string;
      }>;
      const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      const winningCaptures = moves
        .filter((m) => m.flags.includes('c') || m.flags.includes('e'))
        .filter((m) => {
          const uci = `${m.from}${m.to}${m.promotion || ''}`;
          return isWinningCapture(postBadFen, uci);
        })
        .sort((a, b) => (values[b.captured || 'p'] || 0) - (values[a.captured || 'p'] || 0));
      if (winningCaptures.length > 0) {
        const best = winningCaptures[0];
        coachResponsePvRef.current = [`${best.from}${best.to}${best.promotion || ''}`];
      } else {
        // Clear — don't fabricate a refutation. Explainer will fall back to
        // an eval-based message instead of claiming a capture exists.
        coachResponsePvRef.current = [];
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
      // Mark the game as having actual user/CPU activity for auto-save eligibility
      gameHasUserMovesRef.current = true;
      return true;
    },
    []
  );

  // Opponent turn — only fires during play phase vs CPU
  const requestMoveRef = useRef(sf.requestMove);
  requestMoveRef.current = sf.requestMove;

  // In coach mode, we need the engine to have analyzed the post-user-move
  // position to at least depth 14 before letting the CPU reply. Otherwise the
  // coach trigger (which requires depth ≥ 14 to trust the PV) never gets a
  // chance to fire: the CPU's response overwrites the position and the trigger
  // bails because `lastIdx` now points at the CPU's move. Without this gate,
  // coaching silently stops working.
  const coachWaitingForAnalysis =
    committedMode === 'coach' &&
    moveHistory.length > 0 &&
    !coachedIndicesRef.current.has(moveHistory.length - 1) &&
    (sf.lines[0]?.depth ?? 0) < 14;
  const cpuToMove =
    gamePhase === 'playing' &&
    (committedMode === 'cpu' || committedMode === 'coach') &&
    !coachActive &&
    !coachWaitingForAnalysis &&
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

      // Block all interaction while the coach is in pausing/demo/rewind states
      if (
        coachActive &&
        (coachSubPhase === 'pausing' ||
          coachSubPhase === 'demo' ||
          coachSubPhase === 'rewinding' ||
          coachSubPhase === 'analyzing' ||
          coachSubPhase === 'retry-analyzing' ||
          coachSubPhase === 'retry-demo' ||
          coachSubPhase === 'contest-analyzing' ||
          coachSubPhase === 'contest-playout' ||
          coachSubPhase === 'contest-result')
      ) {
        return false;
      }

      // Contest mode: user is dropping their alternative move at a branched position
      if (coachActive && coachSubPhase === 'contesting') {
        const startFen = contestStartFenRef.current;
        if (!startFen) return false;
        const tryGame = new Chess(startFen);
        let tried;
        try {
          tried = tryGame.move({ from: source, to: target, promotion: 'q' });
        } catch {
          return false;
        }
        if (!tried) return false;
        const triedUci = `${tried.from}${tried.to}${tried.promotion || ''}`;
        contestUserUciRef.current = triedUci;
        const postUserFen = tryGame.fen();
        contestPostUserFenRef.current = postUserFen;
        soundRef.current.play('move');
        setContestUserSan(tried.san);
        setDemoPosition(postUserFen);
        setDemoArrow(null);
        // Start recording a new demo line for this contest layer — begins
        // with the user's own branched move so they can later contest it
        // too if they go another layer deep.
        demoMoveLogRef.current = [
          {
            uci: triedUci,
            san: tried.san,
            fenBefore: startFen,
            fenAfter: postUserFen,
            mover: tried.color,
            ply: 0,
          },
        ];
        // Engine analyzes at full strength — this preempts whatever sf was
        // doing. analyze() doesn't apply ELO limits.
        sf.analyze(postUserFen);
        setCoachSubPhase('contest-analyzing');
        return false;
      }

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
          return false;
        }

        // Wrong attempt — kick the engine onto the post-attempt position so
        // we can show a real refutation. The 'retry-analyzing' effect will
        // wait for engine depth, decide whether the move is genuinely bad
        // (eval drop ≥ 50cp), and either play out the line or print an
        // honest "reasonable, just not best" message.
        const attemptFen = tryGame.fen();
        soundRef.current.play('move');
        setCoachLastAttemptSan(tried.san);
        retryDemoStartFenRef.current = attemptFen;
        retryDemoQueueRef.current = [];
        retryAttemptUciRef.current = triedUci;
        setRetryRefutationText(null);
        // Clear demo log + contest state — this retry will produce its own line
        demoMoveLogRef.current = [];
        setDemoMoveLog([]);
        setContestCycle(0);
        setContestStartIdx(null);
        setContestUserSan(null);
        setContestEngineSan(null);
        setContestResultText(null);
        setDemoPosition(attemptFen);
        setCoachSubPhase('retry-analyzing');
        // Ask engine to analyze this position. analyze() will preempt the
        // current preFen analysis cleanly via useStockfish's queue.
        sf.analyze(attemptFen);
        return false;
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

  // PGN metadata helper — needs to be defined before autoSaveCurrentGame
  // and backToSetup since both depend on it.
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

  // Auto-save: any Mentor or Explore game with at least one user/CPU move
  // gets persisted to /api/games once. Two trigger points:
  //   - The game ends naturally (gameResult set) — useEffect below
  //   - The user quits mid-game via backToSetup — handled inside that callback
  const autoSaveCurrentGame = useCallback(
    (note?: string) => {
      if (!gameHasUserMovesRef.current) return;
      if (moveHistory.length === 0) return;
      // Build a deterministic dedup key per finished game state
      const key = `${moveHistory.join(',')}|${gameResult?.type ?? 'ongoing'}`;
      if (autoSavedKeyRef.current === key) return;
      autoSavedKeyRef.current = key;
      const meta = getPgnMeta();
      const pgn = buildPgn(moveHistory, meta);
      void fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pgn,
          title: `${meta.white} vs ${meta.black} — ${meta.date}${note ? ' (' + note + ')' : ''}`,
          white: meta.white,
          black: meta.black,
          coachingMoments: coachingMomentsCountRef.current,
          userRating: gameStartRatingRef.current ?? undefined,
        }),
      })
        .then((r) => {
          if (r.ok) showToast('Saved to Review');
        })
        .catch(() => {
          // silent — user can still manually save
        });
    },
    [moveHistory, gameResult, getPgnMeta, showToast]
  );

  useEffect(() => {
    if (!gameResult) return;
    autoSaveCurrentGame();
    // Game is over — stop hanging onto the persisted copy. A new game will
    // write a fresh entry when the user hits Start.
    clearPersistedGame();
  }, [gameResult, autoSaveCurrentGame, clearPersistedGame]);

  // Adaptive rating update — fires once whenever a Mentor (adaptive) game
  // ends. Translates the result into 1/0.5/0 from the human's perspective
  // and applies a standard ELO update against the opponent we just played.
  const ratingUpdatedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!adaptiveElo) return;
    if (!gameResult) return;
    if (committedMode !== 'coach' && committedMode !== 'cpu') return;
    if (!computerPlays) return;
    // Stamp by something deterministic so we only update once per finished game
    const stamp = `${moveHistory.length}|${gameResult.type}|${'winner' in gameResult ? gameResult.winner : 'd'}`;
    if (ratingUpdatedForRef.current === stamp) return;
    ratingUpdatedForRef.current = stamp;

    const humanColor: 'w' | 'b' = computerPlays === 'w' ? 'b' : 'w';
    let actual: 0 | 0.5 | 1;
    if ('winner' in gameResult) {
      actual = gameResult.winner === humanColor ? 1 : 0;
    } else {
      actual = 0.5;
    }
    const opponentRating = sf.elo;
    const newRating = updateRating(
      userRating,
      opponentRating,
      actual,
      coachingMomentsCountRef.current
    );
    setUserRatingState(newRating);
    writeUserRating(newRating);
  }, [adaptiveElo, gameResult, committedMode, computerPlays, sf.elo, userRating, moveHistory.length]);

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
    // Reset auto-save + coaching engagement tracking for the new game
    gameHasUserMovesRef.current = false;
    autoSavedKeyRef.current = null;
    coachingMomentsCountRef.current = 0;
    gameStartRatingRef.current = userRating; // snapshot for /review's progress graph

    setCommittedMode(draftMode);
    setGamePhase('playing');
    // Overwrite any previously-persisted game; this one is the current one.
    clearPersistedGame();
  }, [sf, clock, draftMode, draftCpuColor, draftCpuElo, draftTc, userRating, clearPersistedGame]);

  // Return to setup (quit current game or after game end)
  const backToSetup = useCallback(() => {
    // Auto-save in-progress game on quit (game-end path is handled by the
    // gameResult effect, so this catches the "abandoned mid-game" case).
    if (gameHasUserMovesRef.current && !gameResult) {
      autoSaveCurrentGame('aborted');
    }
    sf.cancelMove();
    boardRef.current?.clearPremoves();
    clock.stop();
    clock.disable();
    // Wipe board state so the setup screen (and the game that follows from
    // it) doesn't inherit the last game's moves, position, or evals. Without
    // this, hitting New Game mid-game leaves the previous PGN live behind
    // the dimmed setup panel until Start fires.
    const fresh = new Chess();
    setGame(fresh);
    setMoveHistory([]);
    setPositions([fresh.fen()]);
    setCurrentMoveIndex(-1);
    setMoveEvals([]);
    setNags([]);
    setAnnotations({});
    gameHasUserMovesRef.current = false;
    autoSavedKeyRef.current = null;
    coachingMomentsCountRef.current = 0;
    gameStartRatingRef.current = null;
    coachedIndicesRef.current = new Set();
    setCoachActive(false);
    setCoachSubPhase('analyzing');
    setCoachExplanation(null);
    setDemoPosition(null);
    setDemoArrow(null);
    setGameResult(null);
    gameResultShownRef.current = null;
    clearPersistedGame();
    setGamePhase('setup');
  }, [sf, clock, gameResult, autoSaveCurrentGame, clearPersistedGame]);

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
      // Imported game: don't auto-save unless the user adds moves to it.
      gameHasUserMovesRef.current = false;
      autoSavedKeyRef.current = null;
      coachingMomentsCountRef.current = 0;
      gameStartRatingRef.current = userRating;
      // Imported game: skip setup and land straight in playing phase
      setGamePhase('playing');
    },
    [showToast, sf, clock, userRating]
  );

  useEffect(() => {
    const pgn = sessionStorage.getItem('loadPgn');
    if (pgn) {
      sessionStorage.removeItem('loadPgn');
      importPgn(pgn);
    }
  }, [importPgn]);

  // ------- In-progress game persistence ----------------------------------
  // We stash the current Mentor/Explore game in localStorage so navigating
  // to /review or /settings and back doesn't blow it away. Clocks are NOT
  // restored — they can't meaningfully track time that passed on another tab.
  // `persistKey` and `clearPersistedGame` are defined earlier in the component
  // so startGame/backToSetup can depend on them without TDZ issues.

  // One-shot restore on mount. Skips when a 'loadPgn' handoff is in flight
  // (that's an explicit "open in Explore" request from /review).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      if (sessionStorage.getItem('loadPgn')) return;
      const raw = localStorage.getItem(persistKey);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        moveHistory: string[];
        positions: string[];
        currentMoveIndex: number;
        committedMode: GameMode;
        computerPlays: 'w' | 'b' | null;
        boardOrientation: 'white' | 'black';
        coachingMoments: number;
        gameStartRating: number | null;
        annotations: Record<number, string>;
        cpuElo: number;
        cpuColor: OpponentColor;
      };
      if (!Array.isArray(s.moveHistory) || !Array.isArray(s.positions)) return;
      const fen = s.positions[s.currentMoveIndex + 1] || s.positions[0];
      const g = new Chess(fen);
      setGame(g);
      setMoveHistory(s.moveHistory);
      setPositions(s.positions);
      setCurrentMoveIndex(s.currentMoveIndex);
      setCommittedMode(s.committedMode);
      setComputerPlays(s.computerPlays);
      setBoardOrientation(s.boardOrientation);
      setAnnotations(s.annotations ?? {});
      coachingMomentsCountRef.current = s.coachingMoments ?? 0;
      gameStartRatingRef.current = s.gameStartRating ?? null;
      // Prior moves already played; treat as user-authored so auto-save fires
      // on end-of-game the same way it would for a fresh session.
      gameHasUserMovesRef.current = s.moveHistory.length > 0;
      autoSavedKeyRef.current = null;
      if (s.committedMode === 'cpu' || s.committedMode === 'coach') {
        if (!sf.opponentEnabled) sf.toggleOpponent();
        sf.setOpponentColor(s.cpuColor);
        sf.setElo(s.cpuElo);
      }
      clock.disable();
      setMoveEvals([]);
      setNags([]);
      setGamePhase('playing');
    } catch {
      try {
        localStorage.removeItem(persistKey);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever meaningful state changes while playing. Debounced
  // implicitly: React batches state updates, so one persist per render.
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    try {
      localStorage.setItem(
        persistKey,
        JSON.stringify({
          moveHistory,
          positions,
          currentMoveIndex,
          committedMode,
          computerPlays,
          boardOrientation,
          coachingMoments: coachingMomentsCountRef.current,
          gameStartRating: gameStartRatingRef.current,
          annotations,
          cpuElo: draftCpuElo,
          cpuColor: draftCpuColor,
        })
      );
    } catch {
      /* ignore quota errors */
    }
  }, [
    gamePhase,
    persistKey,
    moveHistory,
    positions,
    currentMoveIndex,
    committedMode,
    computerPlays,
    boardOrientation,
    annotations,
    draftCpuElo,
    draftCpuColor,
  ]);

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
    setRetryRefutationText(null);
    setDemoPosition(null);
    setDemoArrow(null);
    coachBadMoveUciRef.current = null;
    coachPreFenRef.current = null;
    coachBestMoveUciRef.current = null;
    coachBestPvRef.current = [];
    coachResponsePvRef.current = [];
    coachBadIndexRef.current = -1;
    retryDemoQueueRef.current = [];
    retryDemoStartFenRef.current = null;
    retryAttemptUciRef.current = null;
    // Reset contest state
    demoMoveLogRef.current = [];
    setDemoMoveLog([]);
    setContestCycle(0);
    setContestStartIdx(null);
    setContestUserSan(null);
    setContestEngineSan(null);
    setContestResultText(null);
    contestStartFenRef.current = null;
    contestUserUciRef.current = null;
    contestPostUserFenRef.current = null;
    setDemoHoverIdx(null);
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
  // ----- Contest mode --------------------------------------------------
  // User clicks a move in the demo line to branch into a "what if" variation.
  // The board jumps to the position before that move, the user plays an
  // alternative, and the engine responds at FULL strength (no ELO limiting).
  const onContestMove = useCallback(
    (demoIdx: number) => {
      if (contestCycle >= 3) return;
      if (demoIdx < 0 || demoIdx >= demoMoveLog.length) return;
      // Remember which sub-phase to return to on Back-to-lesson
      contestReturnSubPhaseRef.current = coachSubPhase as CoachSubPhase;
      const target = demoMoveLog[demoIdx];
      contestStartFenRef.current = target.fenBefore;
      contestUserUciRef.current = null;
      contestPostUserFenRef.current = null;
      setContestStartIdx(demoIdx);
      setContestUserSan(null);
      setContestEngineSan(null);
      setContestResultText(null);
      setDemoPosition(target.fenBefore);
      setDemoArrow(null);
      setDemoHoverIdx(null); // clear any hover preview — we're committing to this branch
      setCoachSubPhase('contesting');
    },
    [contestCycle, demoMoveLog, coachSubPhase]
  );

  const onContestExit = useCallback(() => {
    // Restore the lesson view: clear the contest position override and
    // return to whichever retry sub-phase the user came from.
    // Depth was already bumped in finish() — don't double-increment here.
    setDemoPosition(null);
    setDemoArrow(null);
    setCoachSubPhase(contestReturnSubPhaseRef.current);
  }, []);

  // Cancel a contest before the user has played anything — no cycle spent.
  // Used when they click the wrong demo move and want to back out.
  const onContestCancel = useCallback(() => {
    contestStartFenRef.current = null;
    contestUserUciRef.current = null;
    contestPostUserFenRef.current = null;
    setContestStartIdx(null);
    setContestUserSan(null);
    setContestEngineSan(null);
    setContestResultText(null);
    setDemoPosition(null);
    setDemoArrow(null);
    // Stop whatever contest analysis might be mid-flight
    sf.cancelMove();
    setCoachSubPhase(contestReturnSubPhaseRef.current);
  }, [sf]);

  // ----- Contest analysis effect (engine analyzing user's contest attempt)
  // When in 'contest-analyzing', wait for the engine's full-strength PV from
  // the post-attempt position. Then play out 1-3 plies of refutation depending
  // on whether captures are still happening.
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'contest-analyzing') return;
    if (sf.lines.length === 0) return;
    const primary = sf.lines[0];
    if (primary.depth < 14) return; // full-strength threshold for contest

    const startFen = contestPostUserFenRef.current;
    if (!startFen) {
      setCoachSubPhase('contest-result');
      return;
    }

    const pvTokens = primary.pv.trim().split(/\s+/).filter(Boolean);
    if (pvTokens.length === 0) return;

    // Staleness guard
    try {
      const g = new Chess(startFen);
      const r = g.move({
        from: pvTokens[0].slice(0, 2),
        to: pvTokens[0].slice(2, 4),
        promotion: pvTokens[0].slice(4, 5) || 'q',
      });
      if (!r) return;
    } catch {
      return;
    }

    // Save the PV for the playout effect — depth-scaled truncation so we
    // never play moves beyond what the engine has verified.
    const contestTrusted = Math.min(6, Math.max(3, Math.floor(primary.depth / 2)));
    coachRefutationRef.current = pvTokens.slice(0, contestTrusted);
    setCoachSubPhase('contest-playout');
  }, [coachActive, coachSubPhase, sf.lines]);

  // ----- Contest playout effect ------------------------------------------
  // Plays the engine's response (up to 3 plies, trade-aware), shows result.
  useEffect(() => {
    if (!coachActive || coachSubPhase !== 'contest-playout') return;
    const queue = coachRefutationRef.current;
    const startFen = contestPostUserFenRef.current;
    if (!startFen || queue.length === 0) {
      setCoachSubPhase('contest-result');
      return;
    }

    let cancelled = false;
    let pos = startFen;
    let idx = 0;
    let nonCaptureStreak = 0;
    const SOFT_CAP = 4;
    const HARD_CAP = 6;
    let firstResponseSan: string | null = null;
    const humanColor: 'w' | 'b' = computerPlays === 'w' ? 'b' : 'w';
    const startBalance = relativeMaterial(startFen, humanColor);

    const finish = () => {
      if (cancelled) return;
      setDemoArrow(null);
      const finalBalance = relativeMaterial(pos, humanColor);
      const delta = startBalance - finalBalance;
      let resultText: string;
      if (delta >= 2) {
        resultText = `Opponent wins about ${delta.toFixed(0)} pawns of material against your move.`;
      } else if (delta >= 1) {
        resultText = `Opponent wins ~${delta.toFixed(0)} pawn of material in this line.`;
      } else if (delta <= -1) {
        resultText = `Your move actually gains ${Math.abs(delta).toFixed(0)} pawn(s) of material — interesting choice!`;
      } else {
        resultText = `No material change — your position holds up against the opponent's best reply.`;
      }
      setContestEngineSan(firstResponseSan);
      setContestResultText(resultText);
      // Refutation stacking: publish the contest's line (user's move +
      // engine's response moves) as the new demoMoveLog, and bump the depth
      // so the user can drill deeper into THIS variation next. Cap at 3.
      setDemoMoveLog([...demoMoveLogRef.current]);
      setContestCycle((c) => Math.min(3, c + 1));
      setCoachSubPhase('contest-result');
    };

    const playNext = () => {
      if (cancelled) return;
      if (idx >= queue.length || idx >= HARD_CAP) {
        setTimeout(finish, 1000);
        return;
      }
      const uci = queue[idx];
      if (!uci || uci.length < 4) {
        finish();
        return;
      }
      // Color contest moves by current cycle for visual distinction
      const cycleColors = ['#a855f7', '#14b8a6', '#f59e0b'];
      const arrowColor = cycleColors[contestCycle % 3];
      setDemoArrow({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        color: arrowColor,
      });
      setTimeout(() => {
        if (cancelled) return;
        const g = new Chess(pos);
        try {
          const m = g.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.slice(4, 5) || 'q',
          });
          const isCapture = !!m?.captured || (m?.flags?.includes('e') ?? false);
          if (isCapture) soundRef.current.play('capture');
          else if (g.inCheck()) soundRef.current.play('check');
          else soundRef.current.play('move');
          const fenBefore = pos;
          pos = g.fen();
          setDemoPosition(pos);
          setDemoArrow(null);
          if (m && idx === 0) firstResponseSan = m.san;
          // Record the engine's response move into the demo log so after the
          // contest resolves the user can click any of these moves to go a
          // further layer deeper.
          if (m) {
            demoMoveLogRef.current.push({
              uci,
              san: m.san,
              fenBefore,
              fenAfter: pos,
              mover: m.color,
              ply: demoMoveLogRef.current.length, // sequential in the layer's line
            });
          }
          idx++;
          if (isCapture) nonCaptureStreak = 0;
          else nonCaptureStreak++;
          const isTerminal = g.isGameOver();
          const settled = nonCaptureStreak >= 2;
          const softLimit = idx >= SOFT_CAP && !isCapture;
          if (isTerminal || settled || softLimit) {
            setTimeout(finish, 1100);
            return;
          }
          setTimeout(playNext, 750);
        } catch {
          finish();
        }
      }, 600);
    };

    const kick = setTimeout(playNext, 250);
    return () => {
      cancelled = true;
      clearTimeout(kick);
    };
  }, [coachActive, coachSubPhase, computerPlays, contestCycle]);

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

  // Demo-move hover preview: override position + arrow to show the
  // hovered move's "before" FEN and the move itself in neutral color.
  const previewFromHover = (() => {
    if (demoHoverIdx === null) return null;
    const m = demoMoveLog[demoHoverIdx];
    if (!m) return null;
    return {
      fen: m.fenBefore,
      arrow: {
        from: m.uci.slice(0, 2) as Square,
        to: m.uci.slice(2, 4) as Square,
        color: '#94a3b8', // slate-400 — neutral preview
      },
    };
  })();

  // Arrow priority during coaching:
  //   active demo playback > contest-reveal (green) > demo-move hover preview > PV-line hover
  const coachArrow: { from: Square; to: Square; color?: string } | null = demoArrow
    ? demoArrow
    : coachActive && coachSubPhase === 'reveal' && coachBestMoveUciRef.current
      ? {
          from: coachBestMoveUciRef.current.slice(0, 2) as Square,
          to: coachBestMoveUciRef.current.slice(2, 4) as Square,
          color: '#759900',
        }
      : previewFromHover?.arrow ?? hoverArrow;

  // Board position priority: active demo override > hover preview > game state.
  const boardPosition = demoPosition ?? previewFromHover?.fen ?? currentFen;

  // Progressive hints during retry-wrong:
  //   - First miss (2 attempts left): show FROM-squares of top 3 best moves
  //   - Second miss (1 attempt left): show FROM-square of top 1 best move
  // Encourages the user to keep guessing instead of revealing the answer.
  const hintSquares = useMemo(() => {
    if (!coachActive || coachSubPhase !== 'retry-wrong') return [];
    if (coachAttemptsLeft === 2 && coachTop3Ucis.length > 0) {
      return Array.from(new Set(coachTop3Ucis.map((u) => u.slice(0, 2))));
    }
    if (coachAttemptsLeft === 1 && coachTop3Ucis.length > 0) {
      return [coachTop3Ucis[0].slice(0, 2)];
    }
    return [];
  }, [coachActive, coachSubPhase, coachAttemptsLeft, coachTop3Ucis]);
  const isCoachBusy =
    coachActive &&
    (coachSubPhase === 'pausing' ||
      coachSubPhase === 'demo' ||
      coachSubPhase === 'rewinding' ||
      coachSubPhase === 'retry-analyzing' ||
      coachSubPhase === 'retry-demo' ||
      coachSubPhase === 'analyzing' ||
      coachSubPhase === 'contest-analyzing' ||
      coachSubPhase === 'contest-playout');

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
          {/* Opponent card — above the board */}
          {gamePhase !== 'setup' &&
            (committedMode === 'cpu' || committedMode === 'coach') &&
            computerPlays && (
              <PlayerBadge
                name="CPU"
                elo={sf.elo}
                color={computerPlays}
                turn={game.turn() === computerPlays && !game.isGameOver()}
              />
            )}

          {clock.tc && gamePhase !== 'setup' && (
            <ClockDisplay
              seconds={boardOrientation === 'white' ? clock.state.black : clock.state.white}
              active={clock.state.activeColor === (boardOrientation === 'white' ? 'b' : 'w')}
              flagged={clock.state.flagged === (boardOrientation === 'white' ? 'b' : 'w')}
              label={boardOrientation === 'white' ? 'Black' : 'White'}
            />
          )}

          <div className="relative">
            <ChessBoard
              ref={boardRef}
              position={boardPosition}
              onPieceDrop={onPieceDrop}
              boardOrientation={boardOrientation}
              boardWidth={BOARD_WIDTH}
              showCoords={showCoords}
              lastMove={demoPosition ? null : lastMove}
              externalArrow={coachArrow}
              allowPremoves={allowPremoves && !isCoachBusy}
              hintSquares={hintSquares}
            />
            {/* Coach overlay — dims the board and labels the state while
                the coach is running demos/transitions. Drops are already
                blocked at the handler level. */}
            {coachActive && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-2">
                <div className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-2 py-1 rounded-full shadow text-[10px] font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {coachSubPhase === 'pausing' && 'Paused'}
                  {coachSubPhase === 'demo' && 'Coach · watching'}
                  {coachSubPhase === 'rewinding' && 'Rewinding'}
                  {coachSubPhase === 'analyzing' && 'Analyzing'}
                  {coachSubPhase === 'explain' && 'Coach · your turn'}
                  {coachSubPhase === 'retry-analyzing' && 'Coach · checking'}
                  {coachSubPhase === 'retry-demo' && 'Testing your idea'}
                  {coachSubPhase === 'contesting' && 'Contesting · your move'}
                  {coachSubPhase === 'contest-analyzing' && 'Contesting · engine'}
                  {coachSubPhase === 'contest-playout' && 'Contesting · playout'}
                  {coachSubPhase === 'contest-result' && 'Contest result'}
                  {coachSubPhase === 'retry-wrong' && 'Try again'}
                  {coachSubPhase === 'retry-correct' && 'Nice!'}
                  {coachSubPhase === 'reveal' && 'Answer revealed'}
                  {coachSubPhase === 'done' && 'Coach'}
                </div>
              </div>
            )}
            {/* Dim + ring animation for the demo/rewind beats */}
            {isCoachBusy && (
              <div
                className="pointer-events-none absolute inset-0 ring-2 ring-[var(--accent)]/60 rounded"
                style={{ boxShadow: '0 0 24px rgba(117,153,0,0.25) inset' }}
              />
            )}
          </div>

          {clock.tc && gamePhase !== 'setup' && (
            <ClockDisplay
              seconds={boardOrientation === 'white' ? clock.state.white : clock.state.black}
              active={clock.state.activeColor === (boardOrientation === 'white' ? 'w' : 'b')}
              flagged={clock.state.flagged === (boardOrientation === 'white' ? 'w' : 'b')}
              label={boardOrientation === 'white' ? 'White' : 'Black'}
            />
          )}

          {/* User card — below the board */}
          {gamePhase !== 'setup' &&
            (committedMode === 'cpu' || committedMode === 'coach') &&
            computerPlays && (
              <PlayerBadge
                name="You"
                elo={userRating}
                color={computerPlays === 'w' ? 'b' : 'w'}
                turn={game.turn() !== computerPlays && !game.isGameOver()}
              />
            )}

          {gamePhase !== 'setup' && (
            <>
              <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                <span className="text-[var(--foreground-strong)]">{status}</span>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
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
              allowedModes={allowedModes}
              tabLabel={tabLabel}
              adaptiveElo={adaptiveElo}
              userRating={userRating}
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
                  retryRefutationText={retryRefutationText}
                  demoMoveLog={demoMoveLog}
                  contestCycle={contestCycle}
                  contestStartIdx={contestStartIdx}
                  contestUserSan={contestUserSan}
                  contestEngineSan={contestEngineSan}
                  contestResultText={contestResultText}
                  onSkip={coachSkip}
                  onShowSolution={coachShowSolution}
                  onContinue={coachContinue}
                  onContestMove={onContestMove}
                  onContestExit={onContestExit}
                  onContestCancel={onContestCancel}
                  onHoverDemoMove={setDemoHoverIdx}
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
                adaptiveElo={adaptiveElo}
                userRating={userRating}
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
                notation={settings.notation}
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

function PlayerBadge({
  name,
  elo,
  color,
  turn,
}: {
  name: string;
  elo: number;
  color: 'w' | 'b';
  turn: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-[var(--surface)] border text-sm ${
        turn ? 'border-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`inline-block w-3 h-3 rounded-sm border border-[var(--border)] ${
            color === 'w' ? 'bg-white' : 'bg-black'
          }`}
          aria-hidden
        />
        <span className="font-medium text-[var(--foreground-strong)] truncate">{name}</span>
        {turn && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" aria-label="to move" />
        )}
      </div>
      <span className="font-mono tabular-nums text-[var(--muted)] text-xs">{elo}</span>
    </div>
  );
}
