'use client';

import { useState, useMemo, useCallback, useEffect, forwardRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';

export type ChessboardRef = { clearPremoves: (clearLastPieceColour?: boolean) => void };

const BOARD_THEMES: Record<string, { light: string; dark: string }> = {
  brown: { light: '#f0d9b5', dark: '#b58863' },
  blue: { light: '#dee3e6', dark: '#8ca2ad' },
  green: { light: '#eeeed2', dark: '#769656' },
  purple: { light: '#ede0ff', dark: '#7d5ba6' },
};

interface ChessBoardProps {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  boardOrientation?: 'white' | 'black';
  boardWidth?: number;
  showCoords?: boolean;
  showLegalMoves?: boolean;
  lastMove?: { from: string; to: string } | null;
  externalArrow?: { from: Square; to: Square; color?: string } | null;
  allowPremoves?: boolean;
  // Squares to highlight as hints — used by Mentor's progressive retry hints.
  // Rendered with a cyan inset ring so they're visually distinct from
  // selected squares, last-move tints, premoves, etc.
  hintSquares?: string[];
}

const ChessBoardImpl = forwardRef<ChessboardRef, ChessBoardProps>(function ChessBoardImpl(
  {
    position,
    onPieceDrop,
    boardOrientation = 'white',
    boardWidth = 560,
    showCoords = true,
    showLegalMoves = true,
    lastMove,
    externalArrow,
    allowPremoves = false,
    hintSquares = [],
  },
  ref
) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [themeId, setThemeId] = useState('brown');

  useEffect(() => {
    const t = localStorage.getItem('boardTheme') || 'brown';
    setThemeId(t);
    const handler = () => setThemeId(localStorage.getItem('boardTheme') || 'brown');
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
    };
  }, []);

  const theme = BOARD_THEMES[themeId] || BOARD_THEMES.brown;

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !showLegalMoves) return [];
    try {
      const g = new Chess(position);
      return g.moves({ square: selectedSquare as Square, verbose: true }).map((m) => m.to as string);
    } catch {
      return [];
    }
  }, [position, selectedSquare, showLegalMoves]);

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!showLegalMoves) return;
      if (selectedSquare && legalMoves.includes(square)) {
        const result = onPieceDrop(selectedSquare, square);
        setSelectedSquare(null);
        return result;
      }
      try {
        const g = new Chess(position);
        const piece = g.get(square as Square);
        setSelectedSquare(piece ? (square === selectedSquare ? null : square) : null);
      } catch {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, legalMoves, onPieceDrop, position, showLegalMoves]
  );

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = { ...styles[lastMove.from], background: 'rgba(155, 199, 0, 0.28)' };
      styles[lastMove.to] = { ...styles[lastMove.to], background: 'rgba(155, 199, 0, 0.42)' };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { ...styles[selectedSquare], background: 'rgba(20, 130, 220, 0.35)' };
    }

    for (const sq of legalMoves) {
      const existing = styles[sq] || {};
      styles[sq] = {
        ...existing,
        background: existing.background
          ? `${existing.background}, radial-gradient(circle, rgba(0,0,0,0.28) 20%, transparent 22%)`
          : 'radial-gradient(circle, rgba(0,0,0,0.28) 20%, transparent 22%)',
      };
    }

    // Hint squares — cyan inset ring. Layered last so it's always visible
    // on top of any other tint applied to the same square.
    for (const sq of hintSquares) {
      const existing = styles[sq] || {};
      styles[sq] = {
        ...existing,
        boxShadow: 'inset 0 0 0 4px rgba(34, 211, 238, 0.85)', // cyan-400
      };
    }

    return styles;
  }, [selectedSquare, legalMoves, lastMove, hintSquares]);

  const arrows: [Square, Square, string?][] = externalArrow
    ? [[externalArrow.from, externalArrow.to, externalArrow.color || '#1da198']]
    : [];

  return (
    <div className="shadow-[0_8px_24px_rgba(0,0,0,0.5)] rounded overflow-hidden">
      <Chessboard
        ref={ref}
        position={position}
        onPieceDrop={(source, target) => {
          setSelectedSquare(null);
          return onPieceDrop(source, target);
        }}
        onSquareClick={handleSquareClick}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customBoardStyle={{ borderRadius: '2px' }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        customSquareStyles={customSquareStyles}
        customArrows={arrows as unknown as [Square, Square][]}
        animationDuration={200}
        showBoardNotation={showCoords}
        arePremovesAllowed={allowPremoves}
        customPremoveLightSquareStyle={{ backgroundColor: '#d6a82d' }}
        customPremoveDarkSquareStyle={{ backgroundColor: '#b88a26' }}
        clearPremovesOnRightClick={true}
      />
    </div>
  );
});

export default ChessBoardImpl;
