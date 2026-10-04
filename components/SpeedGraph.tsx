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

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.parentElement?.clientWidth || 200;
    canvas.width = logicalWidth * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, logicalWidth, height);

    if (data.length < 2) return;

    const maxVal = Math.max(...data, 10);
    const stepX = logicalWidth / (data.length - 1);

    // Resolve stroke color
    const strokeColor = color.startsWith('var(') ? '#EA8C28' : color;

    // Draw sparkline curve
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

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
    ctx.lineTo(logicalWidth, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = strokeColor.startsWith('#')
      ? `${strokeColor}1A` // ~10% opacity in hex
      : 'rgba(234, 140, 40, 0.1)';
    ctx.fill();
  }, [data, height, color]);

  return (
    <div className="w-full overflow-hidden">
      <canvas ref={canvasRef} className="w-full block" />
    </div>
  );
}
