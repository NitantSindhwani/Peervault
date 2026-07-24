'use client';

import { useState } from 'react';
import {
  ChartLineUp,
  ShareNetwork,
  ShieldCheck,
  Globe,
  Lightning,
  BellRinging,
  ToggleLeft,
  ToggleRight,
} from '@phosphor-icons/react';

export default function DashboardPage() {
  const [meshNodeEnabled, setMeshNodeEnabled] = useState(false);
  const [relayedDataMb, setRelayedDataMb] = useState(0);
  const [activeRelayPeers, setActiveRelayPeers] = useState(0);

  const toggleMeshNode = () => {
    const nextState = !meshNodeEnabled;
    setMeshNodeEnabled(nextState);
    if (nextState) {
      setRelayedDataMb(142.6);
      setActiveRelayPeers(3);
    } else {
      setRelayedDataMb(0);
      setActiveRelayPeers(0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
          <ChartLineUp className="w-3.5 h-3.5" />
          <span>Telemetry & Enterprise Hub</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          Node Telemetry & Controls
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Manage peer mesh participation, configure delivery webhooks, & download signed certificates.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Mesh Node Gamified Telemetry Widget (Q4 Implementation) */}
        <div className="lg:col-span-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[var(--accent)] font-bold uppercase tracking-wider">Architecture #05</span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Peer Mesh Relay Node (Opt-In)</h3>
            </div>
            <button
              onClick={toggleMeshNode}
              className="text-3xl text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              {meshNodeEnabled ? (
                <ToggleRight className="w-10 h-10 text-[var(--accent)]" weight="fill" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)]" />
              )}
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">
            Allow your browser node to act as an encrypted intermediate relay for firewalled peers. Payload contents remain 100% end-to-end encrypted.
          </p>

          {/* Gamified Relay Telemetry Display */}
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] grid grid-cols-2 gap-4 font-mono text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--text-secondary)] uppercase">Data Relayed:</span>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {relayedDataMb} <span className="text-xs text-[var(--accent)] font-normal">MB</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--text-secondary)] uppercase">Active Relay Peers:</span>
              <div className="text-xl font-bold text-[var(--success)]">
                {activeRelayPeers} <span className="text-xs text-[var(--text-secondary)] font-normal">Peers</span>
              </div>
            </div>
          </div>
        </div>

        {/* Webhooks & Certificates Panel */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Webhooks Box */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <BellRinging className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-bold text-base text-[var(--text-primary)]">Delivery Webhooks (REST / Slack)</h3>
            </div>
            
            <div className="space-y-3 font-mono text-xs">
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-bold hover:opacity-90">
                Save Webhook
              </button>
            </div>
          </div>

          {/* Verification Log */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--success)]" />
                <h3 className="font-bold text-base text-[var(--text-primary)]">Signed Delivery Proofs</h3>
              </div>
              <span className="text-[10px] text-[var(--text-secondary)]">Ed25519 Signed</span>
            </div>

            <div className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-primary)] font-bold">Dataset_Archive.zip</span>
                <span className="text-[var(--success)]">Verified</span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">Root: e8a94b12f8c37d10ab67e9124a8723bc</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
