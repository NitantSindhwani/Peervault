'use client';

import { useState, useRef, useEffect } from 'react';
import { UploadSimple, FileArrowUp, Folder, Lightning, LockKey } from '@phosphor-icons/react';
import { soundEngine } from '@/lib/audio/sound-engine';

export interface LiquidDropzoneProps {
  onFileSelect: (file: File) => void;
  onFolderSelect?: (files: FileList) => void;
}

export function LiquidDropzone({ onFileSelect, onFolderSelect }: LiquidDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [pointerPos, setPointerPos] = useState({ x: 50, y: 50 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = 280);

    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      step += 0.03;

      // Draw metallic liquid wave background
      const targetX = (pointerPos.x / 100) * width;
      const targetY = (pointerPos.y / 100) * height;

      const gradient = ctx.createRadialGradient(
        targetX,
        targetY,
        10,
        targetX,
        targetY,
        width * 0.7
      );

      if (isDragOver) {
        gradient.addColorStop(0, 'rgba(234, 140, 40, 0.25)');
        gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.15)');
        gradient.addColorStop(1, 'rgba(13, 15, 20, 0.95)');
      } else {
        gradient.addColorStop(0, 'rgba(234, 140, 40, 0.12)');
        gradient.addColorStop(0.7, 'rgba(18, 21, 28, 0.8)');
        gradient.addColorStop(1, 'rgba(13, 15, 20, 0.95)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw dynamic fluid displacement rings
      const rings = isDragOver ? 4 : 2;
      for (let i = 0; i < rings; i++) {
        const radius = 60 + i * 40 + Math.sin(step + i) * 8;
        ctx.beginPath();
        ctx.arc(targetX, targetY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isDragOver ? 'rgba(234, 140, 40, 0.4)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(frameId);
  }, [isDragOver, pointerPos]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPointerPos({ x, y });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    soundEngine.playDropImpact();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragOver) {
          setIsDragOver(true);
          soundEngine.playHoverClick();
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden shadow-2xl ${
        isDragOver
          ? 'border-[var(--accent)] scale-[1.01] shadow-[0_0_50px_rgba(234,140,40,0.3)]'
          : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="relative z-10 p-8 sm:p-12 text-center space-y-6">
        <div
          className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center transition-all duration-300 ${
            isDragOver
              ? 'bg-[var(--accent)] text-[var(--bg-main)] scale-110 shadow-lg'
              : 'bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border-color)]'
          }`}
        >
          <FileArrowUp className="w-10 h-10" weight="bold" />
        </div>

        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-[var(--text-primary)] font-display tracking-tight">
            {isDragOver ? 'Release to Stream Instantly' : 'Drag & Drop Any File or Dataset'}
          </h3>
          <p className="text-xs font-mono text-[var(--text-secondary)] max-w-md mx-auto">
            Zero RAM buffering • Unlimited file size • AES-256-GCM encrypted on-device
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 font-mono text-xs">
          <button
            onClick={() => {
              soundEngine.playHoverClick();
              fileInputRef.current?.click();
            }}
            className="px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-bold hover:opacity-90 transition-opacity glow-amber flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <UploadSimple className="w-4 h-4" weight="bold" />
            Browse File
          </button>

          {onFolderSelect && (
            <button
              onClick={() => {
                soundEngine.playHoverClick();
                folderInputRef.current?.click();
              }}
              className="px-6 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] font-bold hover:border-[var(--accent)] transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Folder className="w-4 h-4 text-[var(--accent)]" weight="bold" />
              Select Directory / Folder
            </button>
          )}
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              soundEngine.playDropImpact();
              onFileSelect(e.target.files[0]);
            }
          }}
        />

        {onFolderSelect && (
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                soundEngine.playDropImpact();
                onFolderSelect(e.target.files);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
