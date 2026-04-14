'use client';

import {
  RotateCcw,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  FlipVertical2,
  Plus,
  Upload,
  Download,
  Save,
} from 'lucide-react';

interface GameControlsProps {
  onNewGame: () => void;
  onFlipBoard: () => void;
  onUndo: () => void;
  onGoToStart: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoToEnd: () => void;
  onImportPgn: () => void;
  onExportPgn: () => void;
  onSaveGame: () => void;
  canUndo: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-2 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-[var(--foreground)] hover:text-[var(--foreground-strong)]"
    >
      {children}
    </button>
  );
}

export default function GameControls({
  onNewGame,
  onFlipBoard,
  onUndo,
  onGoToStart,
  onGoBack,
  onGoForward,
  onGoToEnd,
  onImportPgn,
  onExportPgn,
  onSaveGame,
  canUndo,
  canGoBack,
  canGoForward,
}: GameControlsProps) {
  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] p-1.5 space-y-1">
      <div className="flex items-center justify-center gap-0.5">
        <IconButton onClick={onGoToStart} disabled={!canGoBack} title="Go to start">
          <SkipBack size={16} />
        </IconButton>
        <IconButton onClick={onGoBack} disabled={!canGoBack} title="Previous move">
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton onClick={onGoForward} disabled={!canGoForward} title="Next move">
          <ChevronRight size={16} />
        </IconButton>
        <IconButton onClick={onGoToEnd} disabled={!canGoForward} title="Go to end">
          <SkipForward size={16} />
        </IconButton>
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div className="flex items-center justify-center gap-0.5 flex-wrap">
        <IconButton onClick={onNewGame} title="New game">
          <Plus size={16} />
        </IconButton>
        <IconButton onClick={onFlipBoard} title="Flip board">
          <FlipVertical2 size={16} />
        </IconButton>
        <IconButton onClick={onUndo} disabled={!canUndo} title="Undo move">
          <RotateCcw size={16} />
        </IconButton>
        <IconButton onClick={onImportPgn} title="Import PGN">
          <Upload size={16} />
        </IconButton>
        <IconButton onClick={onExportPgn} title="Export PGN">
          <Download size={16} />
        </IconButton>
        <IconButton onClick={onSaveGame} title="Save game">
          <Save size={16} />
        </IconButton>
      </div>
    </div>
  );
}
