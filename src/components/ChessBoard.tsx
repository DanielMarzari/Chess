'use client';

import { useState, useMemo, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';

interface ChessBoardProps {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  boardOrientation?: 'white' | 'black';
  boardWidth?: number;
  showCoords?: boolean;
  showLegalMoves?: boolean;
  lastMove?: { from: string; to: string } | null;
  premove?: { from: string; to: string } | null;
  externalArrow?: { from: Square; to: Square; color?: string } | null;
}

export default function ChessBoard({
  position,
  onPieceDrop,
  boardOrientation = 'white',
  boardWidth = 560,
  showCoords = true,
  showLegalMoves = true,
  lastMove,
  premove,
  externalArrow,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // Compute legal-move destinations for the currently selected square
  const legalMoves = useMemo(() => {
    if (!selectedSquare || !showLegalMoves) return [];
    try {
      const g = new Chess(position);
      const moves = g.moves({ square: selectedSquare as Square, verbose: true });
      return moves.map((m) => m.to as string);
    } catch {
      return [];
    }
  }, [position, selectedSquare, showLegalMoves]);

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!showLegalMoves) return;
      // If a square is selected and user clicks a legal destination, make the move
      if (selectedSquare && legalMoves.includes(square)) {
        const result = onPieceDrop(selectedSquare, square);
        setSelectedSquare(null);
        return result;
      }
      // Otherwise try to select a piece on this square
      try {
        const g = new Chess(position);
        const piece = g.get(square as Square);
        if (piece) {
          setSelectedSquare(square === selectedSquare ? null : square);
        } else {
          setSelectedSquare(null);
        }
      } catch {
        setSelectedSquare(null);
      }
    },
    [selectedSquare, legalMoves, onPieceDrop, position, showLegalMoves]
  );

  // Build customSquareStyles
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Last move — yellow tint
    if (lastMove) {
      styles[lastMove.from] = { ...styles[lastMove.from], background: 'rgba(155, 199, 0, 0.28)' };
      styles[lastMove.to] = { ...styles[lastMove.to], background: 'rgba(155, 199, 0, 0.42)' };
    }

    // Premove — orange tint (overrides last move)
    if (premove) {
      styles[premove.from] = { ...styles[premove.from], background: 'rgba(234, 179, 8, 0.55)' };
      styles[premove.to] = { ...styles[premove.to], background: 'rgba(234, 179, 8, 0.55)' };
    }

    // Selected square — blue tint
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        background: 'rgba(20, 130, 220, 0.35)',
      };
    }

    // Legal move destinations — dot in the middle
    for (const sq of legalMoves) {
      const existing = styles[sq] || {};
      styles[sq] = {
        ...existing,
        background: existing.background
          ? `${existing.background}, radial-gradient(circle, rgba(0,0,0,0.28) 20%, transparent 22%)`
          : 'radial-gradient(circle, rgba(0,0,0,0.28) 20%, transparent 22%)',
      };
    }

    return styles;
  }, [selectedSquare, legalMoves, lastMove, premove]);

  const arrows: [Square, Square, string?][] = externalArrow
    ? [[externalArrow.from, externalArrow.to, externalArrow.color || '#1da198']]
    : [];

  return (
    <div className="shadow-[0_8px_24px_rgba(0,0,0,0.5)] rounded overflow-hidden">
      <Chessboard
        position={position}
        onPieceDrop={(source, target) => {
          setSelectedSquare(null);
          return onPieceDrop(source, target);
        }}
        onSquareClick={handleSquareClick}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customBoardStyle={{ borderRadius: '2px' }}
        customDarkSquareStyle={{ backgroundColor: '#b58863' }}
        customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
        customSquareStyles={customSquareStyles}
        customArrows={arrows as unknown as [Square, Square][]}
        animationDuration={200}
        showBoardNotation={showCoords}
      />
    </div>
  );
}
