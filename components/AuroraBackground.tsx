'use client';

import { useReducedMotion } from 'motion/react';

export function AuroraBackground() {
  const reduce = useReducedMotion();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Dark Base Vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,var(--bg-main)_90%] z-10" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 z-10" />
      
      {/* Light Beams cutting across */}
      {!reduce && (
        <>
          <div className="absolute top-1/2 left-1/4 w-[1px] h-[150%] bg-gradient-to-b from-transparent via-[var(--accent)]/15 to-transparent animate-beam-1 transform -translate-x-1/2 -translate-y-1/2 rotate-45" />
          <div className="absolute top-1/2 left-1/2 w-[1px] h-[150%] bg-gradient-to-b from-transparent via-[var(--success)]/10 to-transparent animate-beam-2 transform -translate-x-1/2 -translate-y-1/2 rotate-45" />
          <div className="absolute top-1/2 left-3/4 w-[1px] h-[150%] bg-gradient-to-b from-transparent via-[var(--accent)]/10 to-transparent animate-beam-3 transform -translate-x-1/2 -translate-y-1/2 rotate-45" />
        </>
      )}

      {/* Noise Texture */}
      <div className="absolute inset-0 noise-overlay z-15" />

      {/* Aurora Blobs */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30 filter blur-[120px] mix-blend-screen scale-110">
        
        {/* Blob 1 - Accent Glow */}
        <div 
          className={`absolute w-[450px] h-[450px] rounded-full bg-[var(--accent)]/30 transform -translate-x-12 -translate-y-12`}
          style={!reduce ? {
            animation: 'drift-one 20s infinite alternate ease-in-out',
          } : undefined}
        />

        {/* Blob 2 - Success Glow */}
        <div 
          className={`absolute w-[500px] h-[500px] rounded-full bg-[var(--success)]/20 transform translate-x-24 translate-y-12`}
          style={!reduce ? {
            animation: 'drift-two 25s infinite alternate ease-in-out',
          } : undefined}
        />

        {/* Blob 3 - Deep Ambient Purple/Blue Glow */}
        <div 
          className={`absolute w-[600px] h-[600px] rounded-full bg-blue-500/10 transform -translate-y-24 translate-x-12`}
          style={!reduce ? {
            animation: 'drift-three 30s infinite alternate ease-in-out',
          } : undefined}
        />

      </div>

      {/* Custom keyframes injected via style tag for self-contained robustness */}
      <style jsx global>{`
        @keyframes drift-one {
          0% { transform: translate(-10%, -10%) scale(1); }
          50% { transform: translate(15%, 5%) scale(1.1); }
          100% { transform: translate(-5%, 15%) scale(0.9); }
        }
        @keyframes drift-two {
          0% { transform: translate(10%, 15%) scale(1.1); }
          50% { transform: translate(-15%, -10%) scale(0.9); }
          100% { transform: translate(5%, -5%) scale(1); }
        }
        @keyframes drift-three {
          0% { transform: translate(-15%, 5%) scale(0.9); }
          50% { transform: translate(10%, -15%) scale(1); }
          100% { transform: translate(-5%, 10%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
