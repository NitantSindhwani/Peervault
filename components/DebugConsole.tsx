'use client';

import { useState } from 'react';
import { TerminalWindow, CaretUp, CaretDown, Trash, Copy, Check } from '@phosphor-icons/react';

export interface LogEntry {
  id: string;
  timestamp: string;
  category: 'ICE' | 'SIGNAL' | 'CHANNEL' | 'ERROR' | 'DATA' | 'INFO';
  message: string;
  details?: any;
}

export interface DebugConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
}

export function DebugConsole({ logs, onClear }: DebugConsoleProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyLogs = () => {
    const formatted = logs
      .map((l) => `[${l.timestamp}] [${l.category}] ${l.message}${l.details ? ' ' + JSON.stringify(l.details) : ''}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryBadge = (category: LogEntry['category']) => {
    switch (category) {
      case 'ERROR':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'ICE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'SIGNAL':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'CHANNEL':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'DATA':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-xl font-mono text-xs shadow-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] overflow-hidden transition-all duration-300">
      {/* Drawer Header */}
      <div className="px-4 py-2.5 bg-[var(--bg-main)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--accent)] font-bold">
          <TerminalWindow className="w-4 h-4" weight="fill" />
          <span>Real-Time Diagnostic Logger ({logs.length})</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLogs}
            className="p-1.5 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            title="Copy Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="p-1.5 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
              title="Clear Logs"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-md hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
          >
            {isOpen ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Drawer Logs Container */}
      {isOpen && (
        <div className="h-64 overflow-y-auto p-3 space-y-1.5 bg-black/40 scrollbar-thin scrollbar-thumb-gray-700">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic py-8 text-center">No telemetry logs recorded yet. Action events will appear here in real time.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-0.5 border-b border-white/5 last:border-0 leading-relaxed">
                <span className="text-gray-500 shrink-0 text-[10px] pt-0.5">{log.timestamp}</span>
                <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold uppercase shrink-0 ${getCategoryBadge(log.category)}`}>
                  {log.category}
                </span>
                <span className="text-[var(--text-primary)] break-all flex-1">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
