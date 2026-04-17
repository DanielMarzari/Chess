'use client';

import { useState, useEffect, useRef } from 'react';
import { Chess, type Square } from 'chess.js';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, RotateCcw, Zap, Loader } from 'lucide-react';
import ChessBoard from './ChessBoard';
import { classifyMove, cpToWinPercent, NAG_META, type NagType } from '@/lib/accuracy';

interface Game {
  id: number;
  pgn: string;
  title?: string;
  white?: string;
  black?: string;
  result?: string;
}

interface PlyAnalysis {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number | null; // cp from white's perspective
  evalAfter: number | null;
  bestUci: string | null;
  bestSan: string | null;
  nag: NagType | null;
  mover: 'w' | 'b';
  cpLoss: number;
}

interface ReviewPanelProps {
  ply: PlyAnalysis;
  onBest: () => void;
  onRetry: () => void;
  onNext: () => void;
  isLoading: boolean;
}

function ReviewPanel({ ply, onBest, onRetry, onNext, isLoading }: ReviewPanelProps) {
  const meta = ply.nag ? NAG_META[ply.nag] : null;
  const isBad = ply.nag && ['blunder', 'mistake', 'inaccuracy', 'miss'].includes(ply.nag);
  const isGood = ply.nag && ['brilliant', 'great', 'best', 'good'].includes(ply.nag);

  const deltaStr = () => {
    if (ply.cpLoss <= 0) return null;
    return `+${(ply.cpLoss / 100).toFixed(1)}`;
  };

  const messageStr = () => {
    if (ply.nag === 'miss') {
      return `${ply.san} is a Miss ${deltaStr()}`;
    }
    if (isBad) {
      return `${ply.san} — ${meta?.label} ${deltaStr()}`;
    }
    if (isGood) {
      return `${ply.san} is ${meta?.label}`;
    }
    return `${ply.san}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
          <span className="text-lg">👨‍🎓</span>
        </div>
        <div className="flex-1 bg-[var(--surface-2)] rounded-lg p-4">
          <p
            className="text-sm font-medium"
            style={{
              color: isGood ? meta?.color : isBad ? meta?.color : 'var(--foreground)',
            }}
          >
            {messageStr()}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBest}
          disabled={!ply.bestUci || isLoading}
          className="flex-1 py-2 px-3 rounded text-sm bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          <Zap size={14} />
          Best
        </button>
        <button
          onClick={onRetry}
          disabled={isLoading}
          className="flex-1 py-2 px-3 rounded text-sm bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          <RotateCcw size={14} />
          Retry
        </button>
        <button
          onClick={onNext}
          disabled={isLoading}
          className="flex-1 py-2 px-3 rounded text-sm bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ReviewRunner({ game }: { game: Game }) {
  const router = useRouter();
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);

  const [analysis, setAnalysis] = useState<PlyAnalysis[]>([]);
  const [currentPlyIndex, setCurrentPlyIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  // Initialize Stockfish worker
  useEffect(() => {
    try {
      const worker = new Worker('/stockfish/stockfish.js');
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg === 'uciok') {
          readyRef.current = true;
        }
      };

      worker.postMessage('uci');
      return () => {
        worker.terminate();
      };
    } catch (err) {
      console.error('Failed to init Stockfish:', err);
      return () => {};
    }
  }, []);

  // Parse PGN and analyze
  useEffect(() => {
    if (!readyRef.current) return;

    const analyzeGame = async () => {
      try {
        const g = new Chess();
        g.loadPgn(game.pgn);
        const moves = g.moves({ verbose: true });

        const newAnalysis: PlyAnalysis[] = [];
        let gameState = new Chess();

        // First pass: collect all positions
        moves.forEach((move, idx) => {
          const fenBefore = gameState.fen();
          gameState.move(move);
          const fenAfter = gameState.fen();

          newAnalysis.push({
            ply: idx,
            san: move.san,
            uci: `${move.from}${move.to}${move.promotion || ''}`,
            fenBefore,
            fenAfter,
            evalBefore: null,
            evalAfter: null,
            bestUci: null,
            bestSan: null,
            nag: null,
            mover: idx % 2 === 0 ? 'w' : 'b',
            cpLoss: 0,
          });
        });

        setAnalysis(newAnalysis);

        // Second pass: analyze each ply using Stockfish
        for (let i = 0; i < newAnalysis.length; i++) {
          const ply = newAnalysis[i];

          // Analyze position before move
          await analyzePosition(ply.fenBefore, (evalCp, bestUci, bestSan) => {
            setAnalysis((prev) => {
              const updated = [...prev];
              updated[i].evalBefore = evalCp;
              updated[i].bestUci = bestUci || null;
              updated[i].bestSan = bestSan || null;
              return updated;
            });
          });

          // Analyze position after move
          await analyzePosition(ply.fenAfter, (evalCp) => {
            setAnalysis((prev) => {
              const updated = [...prev];
              updated[i].evalAfter = evalCp;

              // Compute NAG and cpLoss
              if (updated[i].evalBefore !== null && updated[i].evalAfter !== null) {
                const evalBefore = updated[i].evalBefore!;
                const evalAfter = updated[i].evalAfter!;
                const mover = updated[i].mover;

                // CP loss from mover's perspective
                const cpLoss =
                  mover === 'w'
                    ? Math.max(0, evalBefore - evalAfter)
                    : Math.max(0, evalAfter - evalBefore);

                updated[i].cpLoss = cpLoss;
                updated[i].nag = classifyMove(cpLoss);
              }

              return updated;
            });
          });

          setAnalyzeProgress(((i + 1) / newAnalysis.length) * 100);
        }

        setIsAnalyzing(false);
      } catch (err) {
        console.error('Analysis failed:', err);
        setIsAnalyzing(false);
      }
    };

    analyzeGame();
  }, [game.pgn]);

  const analyzePosition = (fen: string, callback: (evalCp: number, bestUci?: string, bestSan?: string) => void): Promise<void> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve();
        return;
      }

      let bestMove = '';
      let bestEval = 0;

      const handler = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.startsWith('bestmove')) {
          const parts = msg.split(' ');
          bestMove = parts[1] || '';

          // Convert bestMove UCI to SAN
          let bestSan = '';
          if (bestMove) {
            try {
              const g = new Chess(fen);
              const m = g.move({
                from: bestMove.slice(0, 2) as Square,
                to: bestMove.slice(2, 4) as Square,
                promotion: bestMove.slice(4, 5) || undefined,
              });
              bestSan = m?.san || '';
            } catch {
              bestSan = '';
            }
          }

          workerRef.current?.removeEventListener('message', handler);
          callback(bestEval, bestMove, bestSan);
          resolve();
        } else if (msg.startsWith('info')) {
          const parts = msg.split(' ');
          const scoreIdx = parts.indexOf('score');
          if (scoreIdx >= 0 && scoreIdx + 2 < parts.length) {
            const scoreType = parts[scoreIdx + 1];
            if (scoreType === 'cp') {
              bestEval = parseInt(parts[scoreIdx + 2]) || 0;
            }
          }
        }
      };

      workerRef.current.addEventListener('message', handler);
      workerRef.current.postMessage(`position fen ${fen}`);
      workerRef.current.postMessage('go depth 15');
    });
  };

  const currentPly = analysis[currentPlyIndex];

  if (isAnalyzing) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center">
        <Loader className="animate-spin mx-auto mb-4" size={32} />
        <p className="text-[var(--muted)]">Analyzing game...</p>
        <div className="w-full bg-[var(--surface-2)] rounded-full h-2 mt-4 overflow-hidden">
          <div
            className="bg-[var(--accent)] h-full transition-all"
            style={{ width: `${analyzeProgress}%` }}
          />
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">{Math.round(analyzeProgress)}%</p>
      </div>
    );
  }

  if (!currentPly) {
    return (
      <div className="max-w-2xl mx-auto p-4 text-center">
        <p className="text-[var(--muted)]">No moves to analyze</p>
      </div>
    );
  }

  const handleNext = () => {
    if (currentPlyIndex < analysis.length - 1) {
      setCurrentPlyIndex(currentPlyIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentPlyIndex > 0) {
      setCurrentPlyIndex(currentPlyIndex - 1);
    }
  };

  // Build board position for current ply
  const g = new Chess();
  for (let i = 0; i < currentPlyIndex; i++) {
    const move = analysis[i];
    try {
      g.move({
        from: move.uci.slice(0, 2) as Square,
        to: move.uci.slice(2, 4) as Square,
        promotion: move.uci.slice(4, 5) || undefined,
      });
    } catch {
      break;
    }
  }
  const boardFen = g.fen();

  // Compute overlay arrow
  let overlayArrow: { from: Square; to: Square; color?: string } | null = null;
  if (currentPly.nag && ['blunder', 'mistake', 'inaccuracy', 'miss'].includes(currentPly.nag) && currentPly.bestUci) {
    const from = currentPly.bestUci.slice(0, 2) as Square;
    const to = currentPly.bestUci.slice(2, 4) as Square;
    overlayArrow = {
      from,
      to,
      color: '#759900',
    };
  }

  const moves = analysis.map((p) => p.san);
  const nags = analysis.map((p) => p.nag);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.push('/review')}
          className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <h1 className="text-xl font-bold flex-1">Game Review</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Board */}
        <div className="lg:col-span-2">
          <ChessBoard
            position={boardFen}
            onPieceDrop={() => false}
            showLegalMoves={false}
            boardWidth={560}
            externalArrow={overlayArrow}
          />

          {/* Move navigation */}
          <div className="flex items-center justify-between mt-4 gap-2">
            <button
              onClick={handlePrev}
              disabled={currentPlyIndex === 0}
              className="flex-1 py-2 rounded text-sm bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              ← Previous
            </button>
            <span className="text-xs text-[var(--muted)] font-mono">
              {currentPlyIndex + 1} / {analysis.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPlyIndex === analysis.length - 1}
              className="flex-1 py-2 rounded text-sm bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Review panel and move list */}
        <div className="space-y-4">
          <ReviewPanel
            ply={currentPly}
            onBest={() => {}}
            onRetry={() => {}}
            onNext={handleNext}
            isLoading={false}
          />

          {/* Move list with annotation dots */}
          <div className="bg-[var(--surface-2)] rounded-lg p-3 text-sm max-h-96 overflow-y-auto">
            <div className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
              Moves
            </div>
            <div className="space-y-1 font-mono text-xs">
              {moves.map((move, i) => {
                const moveNum = Math.floor(i / 2) + 1;
                const isWhite = i % 2 === 0;
                const isCurrentMove = i === currentPlyIndex;
                const nag = nags[i];
                const meta = nag ? NAG_META[nag] : null;

                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1 p-1 rounded cursor-pointer hover:bg-[var(--surface)] transition-colors ${
                      isCurrentMove ? 'bg-[var(--accent)]/20' : ''
                    }`}
                    onClick={() => setCurrentPlyIndex(i)}
                  >
                    {isWhite && <span className="w-6 text-[var(--muted)]">{moveNum}.</span>}
                    <span className={isCurrentMove ? 'font-bold' : ''}>{move}</span>
                    {meta && (
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full ml-auto"
                        style={{ background: meta.color }}
                        title={meta.label}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
