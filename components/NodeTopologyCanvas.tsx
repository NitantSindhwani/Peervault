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
  speedBytesPerSec = 0,
  rttMs = 0,
  active = true,
}: {
  speedBytesPerSec?: number;
  rttMs?: number;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metricsRef = useRef({ speedBytesPerSec, rttMs, active });

  useEffect(() => {
    metricsRef.current = { speedBytesPerSec, rttMs, active };
  }, [speedBytesPerSec, rttMs, active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let logicalWidth = canvas.parentElement?.clientWidth || 800;
    const logicalHeight = 220;

    const setCanvasDimensions = () => {
      if (!canvas || !canvas.parentElement) return;
      logicalWidth = canvas.parentElement.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);

    // Particles array
    const particleCount = 28;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: logicalWidth * 0.18,
        y: logicalHeight * 0.5,
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.007,
        size: 2.2 + Math.random() * 1.8,
      });
    }

    let pulse = 0;

    const render = () => {
      const { speedBytesPerSec: currentSpeed, rttMs: currentRtt, active: isCurrentlyActive } = metricsRef.current;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      pulse += 0.035;

      const sender = { x: logicalWidth * 0.18, y: logicalHeight * 0.5 };
      const receiver = { x: logicalWidth * 0.82, y: logicalHeight * 0.5 };
      const controlY = logicalHeight * 0.14;

      // 1. Draw Connection Arc Line
      ctx.beginPath();
      ctx.moveTo(sender.x, sender.y);
      ctx.quadraticCurveTo(logicalWidth * 0.5, controlY, receiver.x, receiver.y);
      ctx.strokeStyle = isCurrentlyActive ? 'rgba(234, 140, 40, 0.35)' : 'rgba(156, 163, 175, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Draw Secondary Ground Line
      ctx.beginPath();
      ctx.moveTo(sender.x, sender.y + 16);
      ctx.lineTo(receiver.x, receiver.y + 16);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Render Kinetic Packet Particles traversing the Quadratic Curve
      particles.forEach((p) => {
        if (isCurrentlyActive) {
          p.progress += p.speed * (currentSpeed > 0 ? 1.4 : 0.4);
          if (p.progress >= 1) p.progress = 0;
        }

        const t = p.progress;
        p.x = (1 - t) * (1 - t) * sender.x + 2 * (1 - t) * t * (logicalWidth * 0.5) + t * t * receiver.x;
        p.y = (1 - t) * (1 - t) * sender.y + 2 * (1 - t) * t * controlY + t * t * receiver.y;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = isCurrentlyActive ? 'rgba(234, 140, 40, 0.95)' : 'rgba(156, 163, 175, 0.3)';
        if (isCurrentlyActive) {
          ctx.shadowColor = '#EA8C28';
          ctx.shadowBlur = 6;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 4. Render Sender Node (Left Pulse Ring)
      const senderPulseRadius = 22 + Math.sin(pulse) * 4;
      ctx.beginPath();
      ctx.arc(sender.x, sender.y, senderPulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(234, 140, 40, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sender.x, sender.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#EA8C28';
      ctx.fill();

      ctx.font = '600 11px var(--font-mono, monospace)';
      ctx.fillStyle = '#F3F4F6';
      ctx.textAlign = 'center';
      ctx.fillText('Sender Node (Local)', sender.x, sender.y + 34);

      // 5. Render Receiver Node (Right Pulse Ring)
      const receiverPulseRadius = 22 + Math.cos(pulse) * 4;
      ctx.beginPath();
      ctx.arc(receiver.x, receiver.y, receiverPulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(receiver.x, receiver.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#22C55E';
      ctx.fill();

      ctx.font = '600 11px var(--font-mono, monospace)';
      ctx.fillStyle = '#F3F4F6';
      ctx.fillText(`Receiver Node (${Math.round(currentRtt)} ms)`, receiver.x, receiver.y + 34);

      // 6. Draw Center Flow Speed Badge
      const midX = logicalWidth * 0.5;
      const midY = logicalHeight * 0.30;
      ctx.fillStyle = 'rgba(12, 14, 18, 0.92)';
      ctx.strokeStyle = isCurrentlyActive ? 'rgba(234, 140, 40, 0.5)' : 'rgba(75, 85, 99, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - 75, midY - 14, 150, 28, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px var(--font-mono, monospace)';
      const mbps = (currentSpeed / (1024 * 1024)).toFixed(1);
      ctx.fillText(`${mbps} MB/s Direct Stream`, midX, midY + 4);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', setCanvasDimensions);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between font-mono text-xs text-[var(--accent)] mb-2 px-2">
        <span className="flex items-center gap-2 font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          Kinetic WebRTC Topology
        </span>
        <span className="text-[var(--text-secondary)] text-[10px]">60fps Canvas Render</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-[220px] block rounded-xl bg-[var(--bg-main)]" />
    </div>
  );
}
