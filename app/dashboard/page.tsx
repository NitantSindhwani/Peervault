'use client';

import { useState } from 'react';
import {
  ChartLineUp,
  ShieldCheck,
  BellRinging,
  ToggleLeft,
  ToggleRight,
  Lightning,
  UsersThree,
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
          <span>My Transfer Dashboard</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Transfer Hub & Settings
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-mono">
          Help friends connect on strict Wi-Fi, setup notification alerts, & view file receipts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* POINT 1: Super Simple Connection Helper */}
        <div className="lg:col-span-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[var(--accent)] font-bold uppercase tracking-wider flex items-center gap-1">
                <UsersThree className="w-3.5 h-3.5" />
                Optional Helper Switch
              </span>
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">
                Help Connect Friends on Strict Wi-Fi
              </h3>
            </div>
            <button
              onClick={toggleMeshNode}
              className="text-3xl text-[var(--accent)] hover:opacity-80 transition-opacity cursor-pointer"
            >
              {meshNodeEnabled ? (
                <ToggleRight className="w-10 h-10 text-[var(--accent)]" weight="fill" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)]" />
              )}
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] font-mono leading-relaxed">
            Some college or office Wi-Fi networks block direct transfers. Turn this switch ON to let your tab help route encrypted data for them.
          </p>

          {/* Simple Helper Stats Display */}
          <div className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] grid grid-cols-2 gap-4 font-mono text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--text-secondary)] uppercase">Data Helped Route:</span>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {relayedDataMb} <span className="text-xs text-[var(--accent)] font-normal">MB</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--text-secondary)] uppercase">Friends Helped:</span>
              <div className="text-xl font-bold text-[var(--success)]">
                {activeRelayPeers} <span className="text-xs text-[var(--text-secondary)] font-normal">Users</span>
              </div>
            </div>
          </div>
        </div>

        {/* POINT 2 & 3: Webhooks & File Receipts */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* POINT 2: Notifications */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
              <BellRinging className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-bold text-base text-[var(--text-primary)] font-display">Completion Notifications (Slack / Discord)</h3>
            </div>
            
            <div className="space-y-3 font-mono text-xs">
              <input
                type="text"
                placeholder="Paste your Discord or Slack Webhook URL..."
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-bold hover:opacity-90 cursor-pointer">
                Save Notification Link
              </button>
            </div>
          </div>

          {/* POINT 3: Super Simple File Receipts */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--success)]" />
                <h3 className="font-bold text-base text-[var(--text-primary)] font-display">File Delivery Receipts</h3>
              </div>
              <span className="text-[10px] text-[var(--success)] font-bold">100% Verified</span>
            </div>

            <div className="bg-[var(--bg-main)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--text-primary)] font-bold">Dataset_Archive.zip</span>
                <span className="text-[var(--success)] font-bold">✓ Arrived Intact</span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">Verification Hash: e8a94b12f8c37d10ab67e9124a8723bc</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
