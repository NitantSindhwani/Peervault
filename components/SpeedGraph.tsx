'use client';

import { useEffect, useRef } from 'react';

export interface SpeedGraphProps {
  data?: number[];
  height?: number;
  color?: string;
}

export function SpeedGraph({ data = [], height = 40, color = 'var(--accent)' }: SpeedGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 200);
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) return;

    const maxVal = Math.max(...data, 10);
    const stepX = width / (data.length - 1);

    // Draw sparkline curve
    ctx.beginPath();
    ctx.strokeStyle = '#ea8c28';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    data.forEach((val, i) => {
      const x = i * stepX;
      const y = height - (val / maxVal) * (height - 8) - 4;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill area under curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(234, 140, 40, 0.1)';
    ctx.fill();
  }, [data, height]);

  return (
    <div className="w-full overflow-hidden">
      <canvas ref={canvasRef} className="w-full block" />
    </div>
  );
}
