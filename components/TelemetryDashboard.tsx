'use client';

import { useState, useEffect } from 'react';
import { Gauge, GitFork } from '@phosphor-icons/react';
import { SpeedGraph } from './SpeedGraph';
import { NodeTopologyCanvas } from './NodeTopologyCanvas';

export interface TelemetryData {
  transferSpeedMb: number;
  rttMs: number;
  bbrState: string;
  chunkIndex: number;
  totalChunks: number;
  progressPercent: number;
  connectionType: string;
  merkleVerifiedCount: number;
  memoryUsedMb: number;
}

export interface TelemetryDashboardProps {
  mock?: boolean;
  liveData?: Partial<TelemetryData>;
}

export function TelemetryDashboard({ mock = true, liveData }: TelemetryDashboardProps) {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    transferSpeedMb: 114.8,
    rttMs: 2.1,
    bbrState: 'PROBE_BW',
    chunkIndex: 5410,
    totalChunks: 8192,
    progressPercent: 66,
    connectionType: 'Direct LAN/P2P',
    merkleVerifiedCount: 5410,
    memoryUsedMb: 48.2,
  });

  const [speedHistory, setSpeedHistory] = useState<number[]>([
    85, 92, 104, 118, 112, 114.8,
  ]);

  useEffect(() => {
    if (!mock) {
      if (liveData) {
        setTelemetry((prev) => ({
          ...prev,
          ...liveData,
        }));
        if (liveData.transferSpeedMb !== undefined) {
          setSpeedHistory((prev) => [...prev.slice(-20), liveData.transferSpeedMb!]);
        }
      }
      return;
    }

    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const nextChunk = Math.min(prev.totalChunks, prev.chunkIndex + 45);
        const nextProgress = Math.min(100, Math.round((nextChunk / prev.totalChunks) * 100));
        const speedVar = parseFloat((100 + Math.sin(Date.now() / 1000) * 20).toFixed(1));
        const rttVar = parseFloat(Math.max(1, 2.0 + Math.cos(Date.now() / 800) * 0.8).toFixed(1));

        setSpeedHistory((h) => [...h.slice(-20), speedVar]);

        return {
          ...prev,
          transferSpeedMb: speedVar,
          rttMs: rttVar,
          chunkIndex: nextChunk,
          progressPercent: nextProgress,
          merkleVerifiedCount: nextChunk,
          memoryUsedMb: parseFloat((45 + Math.sin(Date.now() / 2000) * 5).toFixed(1)),
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [mock, liveData]);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)]">
            <Gauge className="w-5 h-5" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-[var(--text-primary)] font-display">Real-Time Telemetry Dashboard</h3>
              {mock && (
                <span className="px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-mono text-[10px] uppercase font-bold">
                  Demo Simulation
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-[var(--text-secondary)]">WebRTC DataChannel • SCTP Stream #0</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            {telemetry.connectionType}
          </span>
        </div>
      </div>

      {/* Kinetic 60fps WebRTC Packet Arc Canvas */}
      <NodeTopologyCanvas
        speedBytesPerSec={telemetry.transferSpeedMb * 1024 * 1024}
        rttMs={telemetry.rttMs}
      />

      {/* Speed & Progress Hero Metric */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Speed */}
        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-2">
          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Throughput Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-[var(--text-primary)] tabular-nums">{telemetry.transferSpeedMb}</span>
            <span className="text-xs font-mono text-[var(--accent)]">MB/s</span>
          </div>
          <SpeedGraph data={speedHistory} height={32} />
        </div>

        {/* RTT Ping */}
        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Round Trip Time (RTT)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-[var(--text-primary)] tabular-nums">{telemetry.rttMs}</span>
            <span className="text-xs font-mono text-[var(--success)]">ms</span>
          </div>
          <p className="text-[10px] font-mono text-[var(--text-secondary)] pt-4">Sampling via Control Frame</p>
        </div>

        {/* Memory Heap */}
        <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Browser JS Heap Memory</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold text-[var(--text-primary)] tabular-nums">{telemetry.memoryUsedMb}</span>
            <span className="text-xs font-mono text-[var(--text-secondary)]">MB</span>
          </div>
          <p className="text-[10px] font-mono text-[var(--success)] pt-4">Heap Budget &lt; 200MB Safe</p>
        </div>

      </div>

      {/* Progress Bar & Merkle Verification */}
      <div className="bg-[var(--bg-main)] p-5 rounded-xl border border-[var(--border-color)] space-y-3 font-mono text-xs">
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-primary)] font-bold flex items-center gap-2">
            <GitFork className="w-4 h-4 text-[var(--accent)]" />
            BLAKE3 Merkle Integrity Engine
          </span>
          <span className="text-[var(--accent)] font-bold">{telemetry.progressPercent}% Complete</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--border-color)] h-3 rounded-full overflow-hidden">
          <div
            className="bg-[var(--accent)] h-full transition-all duration-300 glow-amber"
            style={{ width: `${telemetry.progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
          <span>Verified Leaves: {telemetry.merkleVerifiedCount.toLocaleString()} / {telemetry.totalChunks.toLocaleString()}</span>
          <span>Chunk Size: 64 KB</span>
        </div>
      </div>

    </div>
  );
}
