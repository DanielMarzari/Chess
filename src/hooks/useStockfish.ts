'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface EngineLineInfo {
  depth: number;
  score: number; // white's perspective
  mate: number | null;
  pv: string;
}

export interface BestMove {
  from: string;
  to: string;
  promotion?: string;
}

export type OpponentColor = 'white' | 'black' | 'random';

function eloToSkill(elo: number): number {
  if (elo <= 800) return 0;
  if (elo <= 1000) return 2;
  if (elo <= 1200) return 5;
  if (elo <= 1400) return 8;
  if (elo <= 1600) return 10;
  if (elo <= 1800) return 12;
  if (elo <= 2000) return 14;
  if (elo <= 2200) return 15;
  if (elo <= 2400) return 17;
  if (elo <= 2600) return 18;
  if (elo <= 2800) return 19;
  return 20;
}

function eloMoveTime(elo: number): number {
  if (elo < 1000) return 80;
  if (elo < 1200) return 120;
  if (elo < 1400) return 200;
  if (elo < 1600) return 350;
  if (elo < 1800) return 500;
  if (elo < 2000) return 700;
  if (elo < 2200) return 900;
  if (elo < 2400) return 1100;
  return 1400;
}

type Task =
  | { kind: 'analyze'; fen: string; turn: 'w' | 'b' }
  | { kind: 'move'; fen: string; elo: number; callback: (m: BestMove) => void };

/**
 * Single Stockfish worker with a strict UCI state machine:
 *   - Never sends setoption or go while a search is in progress
 *   - Always waits for `bestmove` before starting the next task
 *   - Queues incoming requests; later analysis requests replace earlier ones
 *     (we only care about the current position), but move requests always run
 *   - Gates startup behind `readyok` so no commands are lost during WASM init
 */
export function useStockfish() {
  // Analysis state exposed to UI
  const [lines, setLines] = useState<EngineLineInfo[]>([]);
  const [depth, setDepth] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);

  // Opponent settings
  const [opponentEnabled, setOpponentEnabled] = useState(false);
  const [opponentColor, setOpponentColor] = useState<OpponentColor>('black');
  const [elo, setElo] = useState(1500);

  // Worker + state machine refs
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const busyRef = useRef(false); // true while engine is searching (between go and bestmove)
  const pendingAnalyzeRef = useRef<{ fen: string; turn: 'w' | 'b' } | null>(null);
  const pendingMoveRef = useRef<{ fen: string; elo: number; callback: (m: BestMove) => void } | null>(null);
  const currentTaskRef = useRef<Task | null>(null);
  const parsedLinesRef = useRef<Map<number, EngineLineInfo>>(new Map());

  const send = (cmd: string) => workerRef.current?.postMessage(cmd);

  // Actually execute a task. Assumes engine is idle (no search in progress).
  const launch = useCallback((task: Task) => {
    currentTaskRef.current = task;
    busyRef.current = true;
    parsedLinesRef.current.clear();

    if (task.kind === 'analyze') {
      setLines([]);
      setDepth(0);
      setIsAnalyzing(true);
      send('setoption name MultiPV value 3');
      send('setoption name UCI_LimitStrength value false');
      send('setoption name Skill Level value 20');
      send(`position fen ${task.fen}`);
      send('go depth 22');
    } else {
      setIsComputerThinking(true);
      send('setoption name MultiPV value 1');
      if (task.elo >= 1320) {
        send('setoption name UCI_LimitStrength value true');
        send(`setoption name UCI_Elo value ${Math.min(3190, task.elo)}`);
        send(`setoption name Skill Level value ${eloToSkill(task.elo)}`);
      } else {
        send('setoption name UCI_LimitStrength value false');
        send(`setoption name Skill Level value ${eloToSkill(task.elo)}`);
      }
      send(`position fen ${task.fen}`);
      send(`go movetime ${eloMoveTime(task.elo)}`);
    }
  }, []);

  // Pick the next task to run based on pending queues. Move tasks take priority.
  const pumpQueue = useCallback(() => {
    if (!readyRef.current) return;
    if (busyRef.current) return;
    if (pendingMoveRef.current) {
      const t = pendingMoveRef.current;
      pendingMoveRef.current = null;
      launch({ kind: 'move', ...t });
      return;
    }
    if (pendingAnalyzeRef.current) {
      const t = pendingAnalyzeRef.current;
      pendingAnalyzeRef.current = null;
      launch({ kind: 'analyze', ...t });
    }
  }, [launch]);

  // Handle a bestmove — transitions from busy to idle.
  const onBestMove = useCallback(
    (msg: string) => {
      const task = currentTaskRef.current;
      currentTaskRef.current = null;
      busyRef.current = false;
      setIsAnalyzing(false);
      setIsComputerThinking(false);

      if (task?.kind === 'move') {
        const parts = msg.split(' ');
        const moveStr = parts[1];
        if (moveStr && moveStr !== '(none)') {
          const move: BestMove = {
            from: moveStr.slice(0, 2),
            to: moveStr.slice(2, 4),
            promotion: moveStr.length > 4 ? moveStr.slice(4, 5) : undefined,
          };
          try {
            task.callback(move);
          } catch {
            // noop
          }
        }
      }
      // Drain pending queue
      setTimeout(pumpQueue, 10);
    },
    [pumpQueue]
  );

  // Init worker (once)
  useEffect(() => {
    let disposed = false;
    try {
      const worker = new Worker('/stockfish/stockfish.js');
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (disposed) return;
        const msg = e.data as string;
        if (typeof msg !== 'string') return;

        if (msg === 'uciok' || msg === 'readyok') {
          if (!readyRef.current) {
            readyRef.current = true;
            pumpQueue();
          }
          return;
        }

        if (
          msg.startsWith('info') &&
          msg.includes(' depth ') &&
          msg.includes(' pv ') &&
          currentTaskRef.current?.kind === 'analyze'
        ) {
          const parts = msg.split(' ');
          const depthIdx = parts.indexOf('depth');
          const scoreIdx = parts.indexOf('score');
          const pvIdx = parts.indexOf('pv');
          const multipvIdx = parts.indexOf('multipv');
          if (depthIdx === -1 || scoreIdx === -1 || pvIdx === -1) return;

          const task = currentTaskRef.current;
          const turn = task?.kind === 'analyze' ? task.turn : 'w';
          const d = parseInt(parts[depthIdx + 1]);
          const lineNum = multipvIdx !== -1 ? parseInt(parts[multipvIdx + 1]) : 1;
          const scoreType = parts[scoreIdx + 1];
          let rawScore = parseInt(parts[scoreIdx + 2]);
          const sign = turn === 'w' ? 1 : -1;

          let mate: number | null = null;
          if (scoreType === 'mate') {
            mate = rawScore * sign;
            rawScore = rawScore > 0 ? 10000 : -10000;
          }
          const score = rawScore * sign;
          const pv = parts.slice(pvIdx + 1).join(' ');

          parsedLinesRef.current.set(lineNum, { depth: d, score, mate, pv });
          setDepth(d);
          const sorted = Array.from(parsedLinesRef.current.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v);
          setLines(sorted);
          return;
        }

        if (msg.startsWith('bestmove')) {
          onBestMove(msg);
          return;
        }
      };

      // Handle worker errors — recover by discarding the current search
      worker.onerror = (err) => {
        if (disposed) return;
        console.error('[stockfish] worker error:', err.message || err);
        // Best-effort: mark engine as not busy and try to continue
        const task = currentTaskRef.current;
        currentTaskRef.current = null;
        busyRef.current = false;
        setIsAnalyzing(false);
        setIsComputerThinking(false);
        // If it was a move request, call callback with no move so UI doesn't hang
        if (task?.kind === 'move') {
          // Just drop the callback — opponent effect will re-fire on next state tick
        }
        setTimeout(pumpQueue, 100);
      };

      // Kick off UCI handshake
      send('uci');
      send('ucinewgame');
      send('isready');
    } catch (e) {
      console.error('Failed to init Stockfish:', e);
    }

    return () => {
      disposed = true;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [onBestMove, pumpQueue]);

  // Public API: request analysis of a position (replaces any pending analysis).
  const analyze = useCallback(
    (fen: string) => {
      const turn: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      pendingAnalyzeRef.current = { fen, turn };

      if (!readyRef.current) return; // queue will drain once ready
      if (!busyRef.current) {
        pumpQueue();
      } else if (currentTaskRef.current?.kind === 'analyze') {
        // Interrupt an in-progress analysis; bestmove handler will pump next
        send('stop');
      }
      // If a move is computing, leave it alone; it'll pump analyze next
    },
    [pumpQueue]
  );

  // Public API: request a move from the engine.
  const requestMove = useCallback(
    (fen: string, onMove: (m: BestMove) => void) => {
      pendingMoveRef.current = { fen, elo, callback: onMove };
      // Drop any pending analysis in favor of the move
      if (!readyRef.current) return;
      if (!busyRef.current) {
        pumpQueue();
      } else {
        // Interrupt whatever is running
        send('stop');
      }
    },
    [elo, pumpQueue]
  );

  const cancelMove = useCallback(() => {
    pendingMoveRef.current = null;
    if (currentTaskRef.current?.kind === 'move') {
      send('stop');
    }
  }, []);

  const toggleOpponent = useCallback(() => {
    setOpponentEnabled((prev) => {
      if (prev) {
        pendingMoveRef.current = null;
        if (currentTaskRef.current?.kind === 'move') send('stop');
      }
      return !prev;
    });
  }, []);

  return {
    lines,
    depth,
    isAnalyzing,
    analyze,
    opponentEnabled,
    toggleOpponent,
    opponentColor,
    setOpponentColor,
    elo,
    setElo,
    isComputerThinking,
    requestMove,
    cancelMove,
  };
}
