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
  Flag,
  Maximize2,
  Volume2,
  VolumeX,
  Grid3x3,
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
  onResign: () => void;
  onFullscreen: () => void;
  onToggleSound: () => void;
  onToggleCoords: () => void;
  soundEnabled: boolean;
  coordsVisible: boolean;
  canUndo: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  canResign: boolean;
}

function IconButton({
  onClick,
  disabled,
  title,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${
        active ? 'text-[var(--accent)]' : 'text-[var(--foreground)] hover:text-[var(--foreground-strong)]'
      }`}
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
  onResign,
  onFullscreen,
  onToggleSound,
  onToggleCoords,
  soundEnabled,
  coordsVisible,
  canUndo,
  canGoBack,
  canGoForward,
  canResign,
}: GameControlsProps) {
  return (
    <div className="bg-[var(--surface)] rounded border border-[var(--border)] p-1.5 space-y-1">
      {/* Navigation */}
      <div className="flex items-center justify-center gap-0.5">
        <IconButton onClick={onGoToStart} disabled={!canGoBack} title="Start (Home)">
          <SkipBack size={16} />
        </IconButton>
        <IconButton onClick={onGoBack} disabled={!canGoBack} title="Previous (←)">
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton onClick={onGoForward} disabled={!canGoForward} title="Next (→)">
          <ChevronRight size={16} />
        </IconButton>
        <IconButton onClick={onGoToEnd} disabled={!canGoForward} title="End">
          <SkipForward size={16} />
        </IconButton>
      </div>
      <div className="h-px bg-[var(--border)]" />
      {/* Game actions */}
      <div className="flex items-center justify-center gap-0.5 flex-wrap">
        <IconButton onClick={onNewGame} title="New game (N)">
          <Plus size={16} />
        </IconButton>
        <IconButton onClick={onFlipBoard} title="Flip board (F)">
          <FlipVertical2 size={16} />
        </IconButton>
        <IconButton onClick={onUndo} disabled={!canUndo} title="Undo (U)">
          <RotateCcw size={16} />
        </IconButton>
        <IconButton onClick={onResign} disabled={!canResign} title="Resign (R)">
          <Flag size={16} />
        </IconButton>
        <IconButton onClick={onImportPgn} title="Import PGN (I)">
          <Upload size={16} />
        </IconButton>
        <IconButton onClick={onExportPgn} title="Copy PGN (X)">
          <Download size={16} />
        </IconButton>
        <IconButton onClick={onSaveGame} title="Save game (S)">
          <Save size={16} />
        </IconButton>
      </div>
      <div className="h-px bg-[var(--border)]" />
      {/* View settings */}
      <div className="flex items-center justify-center gap-0.5">
        <IconButton onClick={onToggleSound} title={soundEnabled ? 'Sound on' : 'Sound off'} active={soundEnabled}>
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </IconButton>
        <IconButton onClick={onToggleCoords} title="Toggle coordinates" active={coordsVisible}>
          <Grid3x3 size={16} />
        </IconButton>
        <IconButton onClick={onFullscreen} title="Fullscreen">
          <Maximize2 size={16} />
        </IconButton>
      </div>
    </div>
  );
}
