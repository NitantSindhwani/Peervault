'use client';

import React, { useRef, useState } from 'react';
import { motion, useSpring, useReducedMotion } from 'motion/react';

export function TiltCard({
  children,
  className = '',
  spotlightColor = 'rgba(234, 140, 40, 0.06)',
  borderColor = 'rgba(234, 140, 40, 0.15)',
  radius = 300,
  maxTilt = 10,
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  borderColor?: string;
  radius?: number;
  maxTilt?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Eased springs for 3D rotation
  const xRot = useSpring(0, { damping: 20, stiffness: 150 });
  const yRot = useSpring(0, { damping: 20, stiffness: 150 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Relative position coordinates
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setCoords({ x: mouseX, y: mouseY });

    if (reduce) return;

    // Center offsets (-0.5 to 0.5)
    const relativeX = mouseX / width - 0.5;
    const relativeY = mouseY / height - 0.5;

    xRot.set(-relativeY * maxTilt);
    yRot.set(relativeX * maxTilt);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    xRot.set(0);
    yRot.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: reduce ? 0 : xRot,
        rotateY: reduce ? 0 : yRot,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      className={`relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] transition-all select-none ${className}`}
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

      {/* Actual Content Wrapper with 3D Z-depth translation on hover */}
      <div 
        style={{ transform: !reduce && isHovered ? 'translateZ(20px)' : 'translateZ(0px)', transition: 'transform 0.25s var(--ease-snappy)' }}
        className="relative z-10 w-full h-full"
      >
        {children}
      </div>
    </motion.div>
  );
}
