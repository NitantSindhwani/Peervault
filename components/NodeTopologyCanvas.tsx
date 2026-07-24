'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  progress: number;
  speed: number;
  size: number;
}

export function NodeTopologyCanvas({
  speedBytesPerSec = 125184000,
  rttMs = 1.9,
  active = true,
}: {
  speedBytesPerSec?: number;
  rttMs?: number;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 220);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = 220;
      }
    };
    window.addEventListener('resize', handleResize);

    // Sender node on left, Receiver node on right
    const sender = { x: width * 0.18, y: height * 0.5 };
    const receiver = { x: width * 0.82, y: height * 0.5 };

    // Particles array
    const particles: Particle[] = [];
    const particleCount = 28;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: sender.x,
        y: sender.y,
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.008,
        size: 2.5 + Math.random() * 2,
      });
    }

    let pulse = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      pulse += 0.04;

      // 1. Draw Connection Arc Line
      const controlY = height * 0.15;
      ctx.beginPath();
      ctx.moveTo(sender.x, sender.y);
      ctx.quadraticCurveTo(width * 0.5, controlY, receiver.x, receiver.y);
      ctx.strokeStyle = 'rgba(234, 140, 40, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Secondary Ground Line
      ctx.beginPath();
      ctx.moveTo(sender.x, sender.y + 15);
      ctx.lineTo(receiver.x, receiver.y + 15);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Render Kinetic Packet Particles traversing the Quadratic Curve
      particles.forEach((p) => {
        if (active) {
          p.progress += p.speed * (speedBytesPerSec > 0 ? 1.2 : 0.4);
          if (p.progress >= 1) p.progress = 0;
        }

        const t = p.progress;
        // Bezier curve point calculation
        p.x = (1 - t) * (1 - t) * sender.x + 2 * (1 - t) * t * (width * 0.5) + t * t * receiver.x;
        p.y = (1 - t) * (1 - t) * sender.y + 2 * (1 - t) * t * controlY + t * t * receiver.y;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = active ? 'rgba(234, 140, 40, 0.9)' : 'rgba(156, 163, 175, 0.4)';
        ctx.shadowColor = '#EA8C28';
        ctx.shadowBlur = active ? 8 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 4. Render Sender Node (Left Pulse Ring)
      const senderPulseRadius = 24 + Math.sin(pulse) * 4;
      ctx.beginPath();
      ctx.arc(sender.x, sender.y, senderPulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(234, 140, 40, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sender.x, sender.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#EA8C28';
      ctx.fill();

      ctx.font = '11px monospace';
      ctx.fillStyle = '#EA8C28';
      ctx.textAlign = 'center';
      ctx.fillText('Sender Node (Local)', sender.x, sender.y + 36);

      // 5. Render Receiver Node (Right Pulse Ring)
      const receiverPulseRadius = 24 + Math.cos(pulse) * 4;
      ctx.beginPath();
      ctx.arc(receiver.x, receiver.y, receiverPulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(receiver.x, receiver.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#22C55E';
      ctx.fill();

      ctx.font = '11px monospace';
      ctx.fillStyle = '#22C55E';
      ctx.fillText(`Receiver Node (${rttMs} ms)`, receiver.x, receiver.y + 36);

      // 6. Draw Center Flow Speed Badge
      const midX = width * 0.5;
      const midY = height * 0.32;
      ctx.fillStyle = 'rgba(13, 15, 20, 0.85)';
      ctx.strokeStyle = 'rgba(234, 140, 40, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - 70, midY - 14, 140, 28, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s Stream`, midX, midY + 4);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [speedBytesPerSec, rttMs, active]);

  return (
    <div className="w-full relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between font-mono text-xs text-[var(--accent)] mb-2 px-2">
        <span className="flex items-center gap-2 font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          Kinetic WebRTC Topology Topology
        </span>
        <span className="text-[var(--text-secondary)] text-[10px]">60fps Canvas Render</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-[220px] block rounded-xl bg-[var(--bg-main)]" />
    </div>
  );
}
