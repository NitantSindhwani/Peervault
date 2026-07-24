'use client';

import React, { useRef, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'motion/react';

export function MagneticButton({
  children,
  className = '',
  range = 40,
  actionScale = 0.98,
}: {
  children: React.ReactNode;
  className?: string;
  range?: number;
  actionScale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Create spring coordinates for smooth physics
  const springOptions = { damping: 15, stiffness: 150, mass: 0.1 };
  const x = useSpring(0, springOptions);
  const y = useSpring(0, springOptions);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    
    // Calculate center coordinates
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    // Calculate distance from cursor to center
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;

    // Restrained magnetic pull clamped to max 10px to prevent button collision/overlap
    const maxPull = 10;
    const pullX = Math.max(-maxPull, Math.min(maxPull, distanceX * 0.15));
    const pullY = Math.max(-maxPull, Math.min(maxPull, distanceY * 0.15));

    x.set(pullX);
    y.set(pullY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${className}`}
    >
      <motion.div
        style={{ x: reduce ? 0 : x, y: reduce ? 0 : y }}
        whileTap={{ scale: actionScale }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
