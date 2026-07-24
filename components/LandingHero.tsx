'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Lightning, 
  ArrowRight, 
  Cpu, 
  CheckCircle, 
  UploadSimple, 
  FileVideo, 
  FileArchive, 
  ShieldCheck,
  UserCheck,
  ArrowsClockwise
} from '@phosphor-icons/react';
import { motion, useSpring, AnimatePresence } from 'motion/react';
import { ShinyText, BlurText, CountUp } from '@/components/TextAnimations';
import { AuroraBackground } from '@/components/AuroraBackground';
import { MagneticButton } from '@/components/MagneticButton';
import { soundEngine } from '@/lib/audio/sound-engine';

export function LandingHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  // Transfer simulation state
  const [transferState, setTransferState] = useState<'idle' | 'transferring' | 'completed'>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);

  // 3D Card tilt spring configuration
  const xRotation = useSpring(0, { damping: 25, stiffness: 200 });
  const yRotation = useSpring(0, { damping: 25, stiffness: 200 });

  const handleMouseMoveTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltRef.current) return;
    const rect = tiltRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Relative coordinates (-0.5 to 0.5)
    const relativeX = (e.clientX - rect.left) / width - 0.5;
    const relativeY = (e.clientY - rect.top) / height - 0.5;

    // Apply tilt values (max 8 degrees for premium restraint)
    xRotation.set(-relativeY * 8);
    yRotation.set(relativeX * 8);
  };

  const handleMouseLeaveTilt = () => {
    xRotation.set(0);
    yRotation.set(0);
  };

  // Start P2P simulator transfer
  const startSimulation = (name: string, size: string) => {
    if (transferState === 'transferring') return;
    soundEngine.playHoverClick();
    setFileName(name);
    setFileSize(size);
    setProgress(0);
    setSpeed(0);
    setTransferState('transferring');
  };

  // Handle simulated progress increments
  useEffect(() => {
    if (transferState !== 'transferring') return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + Math.floor(Math.random() * 8) + 4;
        
        // Randomize mock transfer speed around 800 - 1100 Mbps
        setSpeed(Math.floor(820 + Math.sin(Date.now() / 200) * 150));

        if (nextProgress >= 100) {
          clearInterval(interval);
          setTransferState('completed');
          soundEngine.playCompletionChime();
          return 100;
        }
        return nextProgress;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [transferState]);

  // Particle flow from left to right when transferring
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Packet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      opacity: number;
    }

    const flowingPackets: Packet[] = [];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw horizontal connection pipe/beam
      ctx.strokeStyle = transferState === 'transferring' 
        ? 'rgba(234, 140, 40, 0.1)' 
        : 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, height * 0.5);
      ctx.lineTo(width * 0.9, height * 0.5);
      ctx.stroke();

      // Emit new packets if simulation is active
      if (transferState === 'transferring' && Math.random() > 0.3) {
        flowingPackets.push({
          x: width * 0.15,
          y: height * 0.5 + (Math.random() - 0.5) * 30,
          vx: 4 + Math.random() * 6,
          vy: (Math.random() - 0.5) * 1.5,
          color: Math.random() > 0.4 ? '#ea8c28' : '#22c55e',
          size: 2 + Math.random() * 3,
          opacity: 0.8 + Math.random() * 0.2
        });
      }

      // Draw and update packets
      for (let i = flowingPackets.length - 1; i >= 0; i--) {
        const p = flowingPackets[i];
        p.x += p.vx;
        p.y += p.vy;

        // Draw glowing particle
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Remove if passed right side
        if (p.x > width * 0.82) {
          flowingPackets.splice(i, 1);
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [transferState]);

  return (
    <section ref={heroRef} className="relative overflow-hidden pt-12 pb-20 border-b border-[var(--border-color)]">
      {/* Aurora Ambient Lighting Background */}
      <AuroraBackground />

      {/* Floating Transfer Simulation Particles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70" />

      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column (55% Content + Interactive Sender Panel) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Free & Open Source Pill */}
            <div data-hero-badge className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono">
              <CheckCircle className="w-4 h-4 text-[var(--success)]" weight="fill" />
              <span className="text-[var(--text-primary)] font-semibold">100% Free • Open Source • Zero Cloud Wait</span>
            </div>

            {/* Headline */}
            <h1 data-hero-title className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-tight text-[var(--text-primary)] font-display">
              <BlurText text="Instant Direct P2P Sharing" className="text-[var(--text-primary)]" />
            </h1>

            {/* Subtext */}
            <p data-hero-sub className="text-sm sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-[55ch]">
              No file size limits. No server uploads. Files stream directly between devices over end-to-end encrypted tunnels. <strong className="text-[var(--text-primary)] font-semibold">Try the simulator below to see it in action!</strong>
            </p>

            {/* Interactive Sender simulation tray */}
            <div className="bg-[var(--bg-surface)]/60 backdrop-blur border border-[var(--border-color)] p-5 rounded-2xl space-y-4 shadow-xl">
              <span className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider block font-bold">
                Interactive Simulator Control
              </span>

              {transferState === 'idle' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    onClick={() => startSimulation('cyberpunk_motion_assets.mp4', '1.4 GB')}
                    className="interactive-dropzone p-4 rounded-xl flex items-center gap-3 text-left hover:scale-[1.01] transition-transform cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)]">
                      <FileVideo className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-[var(--text-primary)] font-bold block truncate max-w-[150px]">cyberpunk_assets.mp4</span>
                      <span className="text-[var(--text-secondary)]">Size: 1.4 GB</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => startSimulation('massive_game_folder.zip', '45.8 GB')}
                    className="interactive-dropzone p-4 rounded-xl flex items-center gap-3 text-left hover:scale-[1.01] transition-transform cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-sky-400">
                      <FileArchive className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-[var(--text-primary)] font-bold block truncate max-w-[150px]">game_folder.zip</span>
                      <span className="text-[var(--text-secondary)]">Size: 45.8 GB</span>
                    </div>
                  </button>
                </div>
              )}

              {transferState === 'transferring' && (
                <div className="bg-[var(--bg-main)]/80 p-4 rounded-xl border border-[var(--border-color)] space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-primary)] font-bold animate-pulse flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-ping" />
                      Streaming Directly to Recipient...
                    </span>
                    <span className="text-[var(--accent)] font-bold">{progress}%</span>
                  </div>
                  <div className="w-full bg-[var(--border-color)] h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[var(--accent)] h-full transition-all duration-300 shadow-[0_0_10px_var(--accent)]" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
                    <span>File: {fileName}</span>
                    <span>Throughput: {speed} Mbps</span>
                  </div>
                </div>
              )}

              {transferState === 'completed' && (
                <div className="bg-[var(--bg-main)]/80 p-4 rounded-xl border border-emerald-500/30 space-y-3 font-mono text-xs">
                  <div className="flex items-center gap-2.5 text-[var(--success)] font-bold">
                    <CheckCircle className="w-5 h-5" weight="fill" />
                    <span>Bit-For-Bit Transfer Simulation Complete!</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {fileName} ({fileSize}) was transferred in 0.0 seconds of cloud upload delay!
                  </p>
                  <button 
                    onClick={() => setTransferState('idle')}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer"
                  >
                    <ArrowsClockwise className="w-3.5 h-3.5" />
                    Reset Simulator
                  </button>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 pt-2">
              <MagneticButton className="w-full sm:w-auto block sm:inline-block">
                <Link
                  data-hero-cta
                  href="/send"
                  className="px-6 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-mono text-sm font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer shadow-lg w-full sm:w-auto"
                >
                  <Lightning className="w-5 h-5" weight="fill" />
                  Share Real File Instantly
                </Link>
              </MagneticButton>

              <MagneticButton className="w-full sm:w-auto block sm:inline-block">
                <a
                  data-hero-cta
                  href="#architecture"
                  className="px-5 py-3.5 rounded-xl bg-[var(--bg-surface)]/80 backdrop-blur border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <span>How It Works</span>
                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
                </a>
              </MagneticButton>
            </div>

          </div>

          {/* Right Column (45% High-Fidelity Apple Device Mockup) */}
          <motion.div
            ref={tiltRef}
            onMouseMove={handleMouseMoveTilt}
            onMouseLeave={handleMouseLeaveTilt}
            style={{
              rotateX: xRotation,
              rotateY: yRotation,
              transformStyle: 'preserve-3d',
              perspective: 1000,
            }}
            className="lg:col-span-5 relative z-20 flex justify-center"
          >
            {/* Device Wrapper */}
            <div 
              style={{ transform: 'translateZ(35px)' }}
              className="device-mockup w-[290px] h-[550px] p-3 flex flex-col justify-between"
            >
              {/* Dynamic Island is auto-drawn by device-mockup::before CSS */}

              {/* Screen Top Status */}
              <div className="relative z-10 flex items-center justify-between px-2 pt-5 font-mono text-[8px] text-[var(--text-secondary)]">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <span>5G Direct</span>
                  <div className="w-3.5 h-1.5 border border-[var(--text-secondary)] rounded-sm p-[1px]">
                    <div className="w-full h-full bg-[var(--text-secondary)] rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* Screen Body */}
              <div className="flex-grow flex flex-col justify-center items-center px-4 py-6 text-center space-y-5">
                
                {transferState === 'idle' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="w-14 h-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center mx-auto shadow-inner pulse-glow-amber">
                      <UploadSimple className="w-6 h-6 text-[var(--accent)]" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-mono text-xs font-bold text-[var(--text-primary)]">Ready for Direct Stream</h4>
                      <p className="font-mono text-[9px] text-[var(--text-secondary)] leading-relaxed">
                        Select a sample file on the left to simulate browser-to-browser P2P transport.
                      </p>
                    </div>
                  </div>
                )}

                {transferState === 'transferring' && (
                  <div className="space-y-5 w-full">
                    {/* Ring Progress Indicator */}
                    <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                      <svg className="absolute w-full h-full transform -rotate-90">
                        <circle 
                          cx="56" cy="56" r="48" 
                          stroke="var(--border-color)" 
                          strokeWidth="6" 
                          fill="transparent" 
                        />
                        <circle 
                          cx="56" cy="56" r="48" 
                          stroke="var(--accent)" 
                          strokeWidth="6" 
                          fill="transparent" 
                          strokeDasharray={301.6}
                          strokeDashoffset={301.6 - (301.6 * progress) / 100}
                          className="transition-all duration-300"
                        />
                      </svg>
                      <div className="font-mono text-lg font-bold text-[var(--text-primary)]">
                        {progress}%
                      </div>
                    </div>

                    <div className="space-y-1 font-mono text-left bg-[var(--bg-main)]/90 p-3 rounded-lg border border-[var(--border-color)] text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-secondary)]">WebRTC Link:</span>
                        <span className="text-[var(--success)] font-bold">E2EE ACTIVE</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-[var(--text-secondary)]">Rate:</span>
                        <span className="text-[var(--accent)] font-bold">{speed} Mbps</span>
                      </div>
                    </div>
                  </div>
                )}

                {transferState === 'completed' && (
                  <div className="space-y-4 w-full animate-fade-in">
                    <div className="w-14 h-14 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30 flex items-center justify-center mx-auto pulse-glow-green">
                      <CheckCircle className="w-8 h-8 text-[var(--success)]" weight="fill" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-mono text-xs font-bold text-[var(--text-primary)]">Download Ready!</h4>
                      <p className="font-mono text-[9px] text-[var(--text-secondary)]">
                        {fileName} was completely reconstructed using BLAKE3 Merkle validation.
                      </p>
                    </div>

                    {/* Mock Save button */}
                    <div className="pt-2">
                      <button 
                        onClick={() => soundEngine.playHoverClick()}
                        className="w-full py-2.5 rounded-lg bg-[var(--success)] text-[var(--bg-main)] font-mono text-[10px] font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Save to Phone Memory
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Screen Bottom Bar */}
              <div className="relative z-10 pb-2 flex justify-center">
                <div className="w-24 h-1 bg-[var(--border-color)] rounded-full" />
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
