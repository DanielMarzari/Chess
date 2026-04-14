'use client';

import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';

interface ChessBoardProps {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  boardOrientation?: 'white' | 'black';
  boardWidth?: number;
  arrowsAndHighlights?: {
    arrows?: [Square, Square][];
    customSquareStyles?: Record<string, React.CSSProperties>;
  };
}

export default function ChessBoard({
  position,
  onPieceDrop,
  boardOrientation = 'white',
  boardWidth = 560,
  arrowsAndHighlights,
}: ChessBoardProps) {
  return (
    <div className="shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
      <Chessboard
        position={position}
        onPieceDrop={(source, target) => onPieceDrop(source, target)}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customBoardStyle={{
          borderRadius: '2px',
        }}
        customDarkSquareStyle={{ backgroundColor: '#b58863' }}
        customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
        customArrows={arrowsAndHighlights?.arrows}
        customSquareStyles={arrowsAndHighlights?.customSquareStyles}
        animationDuration={200}
      />
    </div>
  );
}
