'use client';

import React, { useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(234, 140, 40, 0.08)',
  borderColor = 'rgba(234, 140, 40, 0.2)',
  radius = 350,
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  borderColor?: string;
  radius?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const reduce = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] transition-all ${className}`}
      style={{
        position: 'relative',
      }}
    >
      {/* Background Spotlight Radial Gradient */}
      {!reduce && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(${radius}px circle at ${coords.x}px ${coords.y}px, ${spotlightColor}, transparent 80%)`,
          }}
        />
      )}

      {/* Border Spotlight Glow */}
      {!reduce && isHovered && (
        <div
          className="pointer-events-none absolute -inset-[1px] rounded-2xl transition-opacity duration-300"
          style={{
            border: '1px solid transparent',
            backgroundImage: `radial-gradient(${radius * 0.6}px circle at ${coords.x}px ${coords.y}px, ${borderColor}, transparent 80%)`,
            backgroundOrigin: 'border-box',
            backgroundClip: 'border-clip',
          }}
        />
      )}

      {/* Actual Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
