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
    <div className="rounded-lg overflow-hidden shadow-xl">
      <Chessboard
        position={position}
        onPieceDrop={(source, target) => onPieceDrop(source, target)}
        boardOrientation={boardOrientation}
        boardWidth={boardWidth}
        customBoardStyle={{
          borderRadius: '0',
        }}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
        customArrows={arrowsAndHighlights?.arrows}
        customSquareStyles={arrowsAndHighlights?.customSquareStyles}
        animationDuration={200}
      />
    </div>
  );
}
