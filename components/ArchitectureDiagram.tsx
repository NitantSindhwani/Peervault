'use client';

import { useState } from 'react';
import { Cpu, ShieldCheck, ShareNetwork, LockKey, ArrowRight, Database } from '@phosphor-icons/react';

export function ArchitectureDiagram() {
  const [activeNode, setActiveNode] = useState<string>('sender');

  const nodeDetails: Record<string, { title: string; desc: string; specs: string[] }> = {
    sender: {
      title: 'Sender Browser Node',
      desc: 'Off-thread multithreaded WASM/WebCrypto pipeline that slices local files into 64KB ArrayBuffers, encrypts with AES-256-GCM, and computes BLAKE3 Merkle hashes.',
      specs: [
        'Custom BBR-Style Congestion Control (#01)',
        'Off-Thread WASM + SIMD Engine (#02)',
        'Store-and-Forward Ephemeral Chunks (#03)',
        'Merkle Tree Integrity Verification (#06)',
      ],
    },
    signaling: {
      title: 'Supabase Realtime Signaling Spine',
      desc: 'Zero-knowledge signaling channel running over WebSockets. Relays compressed SDP offers/answers and OPAQUE PAKE credentials without inspecting payload content.',
      specs: [
        'OPAQUE PAKE Mutual Auth Protocol (#04)',
        'Peer Mesh Signaling Relay Topology (#05)',
        'Compressed SDP via CompressionStream (#10)',
        'Supabase Edge Function Rate Limiter (#15)',
      ],
    },
    recipient: {
      title: 'Recipient Browser Node',
      desc: 'Receives encrypted ArrayBuffers over WebRTC DataChannel, verifies leaf hashes against Merkle root, and streams directly to disk using FileSystemAccessAPI.',
      specs: [
        'Sliding-Window Backpressure Control (#07)',
        'Zero-Copy FileSystemWritableFileStream (#11)',
        'Network Topology Auto-Fallback State Machine (#12)',
        'Dynamic Network Throttling & Adaptive Sizing (#13)',
      ],
    },
  };

  return (
    <section id="architecture" className="py-20 bg-[var(--bg-main)] border-b border-[var(--border-color)] bg-grid-pattern">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
            <ShareNetwork className="w-3.5 h-3.5" />
            <span>Interactive DataFlow Matrix</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
            15-Point Technical Topology
          </h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-[65ch]">
            Click any node in the data path below to inspect its cryptographic and transport specifications.
          </p>
        </div>

        {/* Matrix Pipeline Interactive Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left 8 Cols: Interactive Diagram */}
          <div className="lg:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl space-y-8">
            
            {/* Top Row: Signaling Engine Spine */}
            <div
              onClick={() => setActiveNode('signaling')}
              className={`cursor-pointer p-5 rounded-xl border transition-all ${
                activeNode === 'signaling'
                  ? 'border-[var(--accent)] bg-[var(--bg-main)] glow-amber'
                  : 'border-[var(--border-color)] bg-[var(--bg-main)]/60 hover:border-[var(--text-secondary)]'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-xs mb-2">
                <span className="text-[var(--accent)] font-bold flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Supabase Realtime Signaling Engine
                </span>
                <span className="text-[var(--text-secondary)]">OPAQUE PAKE Relay (#04)</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                Relays compressed SDP offers/answers & ICE candidates over WebSockets with zero plain-text key exposure.
              </p>
            </div>

            {/* Middle Connection Flow */}
            <div className="flex items-center justify-center gap-4 py-2 font-mono text-xs text-[var(--accent)]">
              <span className="h-px bg-[var(--border-color)] flex-1" />
              <span className="px-3 py-1 rounded-full bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center gap-1.5">
                <ShareNetwork className="w-3.5 h-3.5" />
                Direct WebRTC P2P DataChannel Pipeline (SCTP / UDP)
              </span>
              <span className="h-px bg-[var(--border-color)] flex-1" />
            </div>

            {/* Bottom Row: Sender & Recipient Nodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Sender Node */}
              <div
                onClick={() => setActiveNode('sender')}
                className={`cursor-pointer p-5 rounded-xl border transition-all ${
                  activeNode === 'sender'
                    ? 'border-[var(--accent)] bg-[var(--bg-main)] glow-amber'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)]/60 hover:border-[var(--text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs mb-2">
                  <span className="text-[var(--text-primary)] font-bold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[var(--accent)]" />
                    Sender Browser Node
                  </span>
                  <span className="text-[var(--success)] text-[10px]">64KB Chunk Slicer</span>
                </div>
                <ul className="space-y-1 text-[11px] font-mono text-[var(--text-secondary)] mt-3">
                  <li>• Custom BBR Pacing (#01)</li>
                  <li>• WASM + SIMD Engine (#02)</li>
                  <li>• Ephemeral Staging (#03)</li>
                  <li>• Merkle Tree Hashing (#06)</li>
                </ul>
              </div>

              {/* Recipient Node */}
              <div
                onClick={() => setActiveNode('recipient')}
                className={`cursor-pointer p-5 rounded-xl border transition-all ${
                  activeNode === 'recipient'
                    ? 'border-[var(--accent)] bg-[var(--bg-main)] glow-amber'
                    : 'border-[var(--border-color)] bg-[var(--bg-main)]/60 hover:border-[var(--text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs mb-2">
                  <span className="text-[var(--text-primary)] font-bold flex items-center gap-2">
                    <LockKey className="w-4 h-4 text-[var(--success)]" />
                    Recipient Browser Node
                  </span>
                  <span className="text-[var(--accent)] text-[10px]">Disk Streamer</span>
                </div>
                <ul className="space-y-1 text-[11px] font-mono text-[var(--text-secondary)] mt-3">
                  <li>• Backpressure Control (#07)</li>
                  <li>• FileSystem Access Stream (#11)</li>
                  <li>• Connection Fallback (#12)</li>
                  <li>• Adaptive Chunk Sizing (#13)</li>
                </ul>
              </div>

            </div>

          </div>

          {/* Right 4 Cols: Active Node Specifications */}
          <div className="lg:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6">
            <div className="border-b border-[var(--border-color)] pb-4 space-y-1">
              <span className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-wider">Node Inspector</span>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">
                {nodeDetails[activeNode].title}
              </h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
              {nodeDetails[activeNode].desc}
            </p>

            <div className="space-y-3 pt-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-[var(--text-primary)]">Active Subsystems</h4>
              <div className="space-y-2">
                {nodeDetails[activeNode].specs.map((spec, i) => (
                  <div key={i} className="bg-[var(--bg-main)] p-2.5 rounded-lg border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    <span>{spec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
