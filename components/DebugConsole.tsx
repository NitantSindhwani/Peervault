'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  TerminalWindow,
  CaretUp,
  CaretDown,
  Trash,
  Copy,
  Check,
  Funnel,
  DownloadSimple,
  MagnifyingGlass,
  Code,
  Sparkle,
} from '@phosphor-icons/react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto intercept window console logs for state-of-the-art capture
  const [interceptedLogs, setInterceptedLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;

    console.log = (...args: any[]) => {
      origLog(...args);
      const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (str.includes('[PeerConnection]') || str.includes('[Transfer]') || str.includes('[DiskWriter]')) {
        setInterceptedLogs((prev) => [
          ...prev.slice(-100),
          {
            id: `${Date.now()}_${Math.random()}`,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            category: 'INFO',
            message: str,
          },
        ]);
      }
    };

    console.warn = (...args: any[]) => {
      origWarn(...args);
      const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      setInterceptedLogs((prev) => [
        ...prev.slice(-100),
        {
          id: `${Date.now()}_${Math.random()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          category: 'SIGNAL',
          message: `[WARN] ${str}`,
        },
      ]);
    };

    console.error = (...args: any[]) => {
      origErr(...args);
      const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      setInterceptedLogs((prev) => [
        ...prev.slice(-100),
        {
          id: `${Date.now()}_${Math.random()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          category: 'ERROR',
          message: `[ERROR] ${str}`,
        },
      ]);
    };

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    };
  }, []);

  const allLogs = useMemo(() => {
    const combined = [...logs, ...interceptedLogs];
    const seen = new Set<string>();
    return combined
      .filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      })
      .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
  }, [logs, interceptedLogs]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const matchesCategory = activeCategory === 'ALL' || log.category === activeCategory;
      const matchesSearch =
        searchQuery === '' ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allLogs, activeCategory, searchQuery]);

  const copyLogs = () => {
    const formatted = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.category}] ${l.message}${l.details ? ' ' + JSON.stringify(l.details) : ''}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogFile = () => {
    const jsonStr = JSON.stringify(allLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peervault-debug-telemetry-${Date.now()}.json`;
    a.click();
  };

  const getCategoryBadge = (category: LogEntry['category']) => {
    switch (category) {
      case 'ERROR':
        return 'bg-red-500/20 text-red-400 border-red-500/40 glow-red';
      case 'ICE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'SIGNAL':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'CHANNEL':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'DATA':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    }
  };

  const categories = ['ALL', 'ERROR', 'ICE', 'SIGNAL', 'CHANNEL', 'DATA'];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-2xl font-mono text-xs shadow-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] overflow-hidden backdrop-blur-xl transition-all duration-300">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[var(--bg-main)] border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--accent)] font-bold">
          <TerminalWindow className="w-4 h-4" weight="fill" />
          <span>PeerVault Telemetry Debugger</span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] border border-[var(--accent)]/30 font-semibold flex items-center gap-1">
            <Sparkle className="w-3 h-3" /> State of the Art
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLogs}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold"
            title="Copy Filtered Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={downloadLogFile}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
            title="Export JSON Telemetry"
          >
            <DownloadSimple className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          {onClear && (
            <button
              onClick={() => {
                onClear();
                setInterceptedLogs([]);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
              title="Clear Logs"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
          >
            {isOpen ? <CaretDown className="w-4 h-4" /> : <CaretUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Controls & Filter Toolbar */}
          <div className="px-4 py-2 bg-black/40 border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-[var(--accent)] text-[var(--bg-main)] shadow-md'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[140px] max-w-[220px]">
              <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[var(--accent)] text-[11px]"
              />
            </div>
          </div>

          {/* Logs Container */}
          <div className="h-72 overflow-y-auto p-3 space-y-1.5 bg-black/60 font-mono text-[11px] scrollbar-thin scrollbar-thumb-gray-700">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 italic py-12 text-center flex flex-col items-center gap-2">
                <Code className="w-6 h-6 opacity-40" />
                <span>No telemetry logs match active filter filter. Real-time events will stream here automatically.</span>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/15 p-2 transition-all"
                >
                  <div
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="flex items-start gap-2.5 cursor-pointer"
                  >
                    <span className="text-gray-500 text-[10px] shrink-0 pt-0.5">{log.timestamp}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase shrink-0 ${getCategoryBadge(log.category)}`}>
                      {log.category}
                    </span>
                    <span className="text-[var(--text-primary)] font-medium break-all flex-1">{log.message}</span>
                  </div>

                  {/* Expanded JSON / Details view */}
                  {expandedId === log.id && log.details && (
                    <pre className="mt-2 p-2 rounded bg-black/80 border border-white/10 text-[10px] text-emerald-400 overflow-x-auto font-mono whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
