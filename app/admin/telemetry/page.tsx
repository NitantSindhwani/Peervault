'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  LockKey,
  Globe,
  DownloadSimple,
  ArrowClockwise,
  UserCheck,
  MagnifyingGlass,
  Funnel,
  Code,
  CheckCircle,
  Lightning,
  X,
} from '@phosphor-icons/react';
import { formatBytes } from '@/lib/utils/format';

interface AuditLogEntry {
  id: string;
  event: string;
  roomId: string;
  fileName: string;
  fileSize: number;
  progressPercent?: number;
  speedBytesPerSec?: number;
  ip: string;
  country: string;
  city: string;
  userAgent: string;
  timestamp: string;
}

export default function AdminTelemetryPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [activeRooms, setActiveRooms] = useState<AuditLogEntry[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEvent, setFilterEvent] = useState<'all' | 'room_created' | 'transfer_completed'>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchTelemetry = async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/log?key=${encodeURIComponent(key)}`);
      if (!res.ok) {
        throw new Error('Unauthorized Access Key');
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setActiveRooms(data.activeRooms || []);
      setTotalVolume(data.totalBytesStreamed || 0);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || 'Authentication Failed');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTelemetry(adminKey);
  };

  useEffect(() => {
    if (!isAuthenticated || !adminKey) return;
    const interval = setInterval(() => {
      fetchTelemetry(adminKey);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, adminKey]);

  // Filtered & Searched Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesFilter = filterEvent === 'all' || log.event === filterEvent;
      const matchesSearch =
        log.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.roomId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.country.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [logs, filterEvent, searchTerm]);

  const exportCSV = () => {
    const headers = 'ID,Event,RoomID,FileName,FileSizeBytes,IP,Country,City,Timestamp\n';
    const rows = logs
      .map(
        (l) =>
          `"${l.id}","${l.event}","${l.roomId}","${l.fileName.replace(/"/g, '""')}",${l.fileSize},"${l.ip}","${l.country}","${l.city}","${l.timestamp}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peervault_audit_logs_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Header */}
      <div className="space-y-2 border-b border-[var(--border-color)] pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>System Master Telemetry</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Network Metrics & Audit Matrix
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-mono max-w-[70ch]">
          Real-time monitoring of active P2P transfers, client IP addresses, geolocation routing, and transfer volume.
        </p>
      </div>

      {!isAuthenticated ? (
        /* Password Lock Card */
        <div className="max-w-md mx-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)] mx-auto">
              <LockKey className="w-6 h-6" weight="bold" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] font-display">Admin Access Lock</h3>
            <p className="text-xs text-[var(--text-secondary)] font-mono">
              Enter secret key to view system network telemetry.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 font-mono">
            <input
              type="password"
              placeholder="Enter Admin Secret Key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || !adminKey}
              className="w-full py-3.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] text-xs font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Unlock Telemetry Control'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated Dashboard View */
        <div className="space-y-8 font-mono">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)] uppercase font-bold">Active Handshakes</span>
              <div className="text-3xl font-bold text-[var(--accent)] tabular-nums">{activeRooms.length}</div>
              <span className="text-[10px] text-[var(--success)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                Live P2P Signaling
              </span>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)] uppercase font-bold">Total Audit Events</span>
              <div className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">{logs.length}</div>
              <span className="text-[10px] text-[var(--text-secondary)]">Client IP Audit Queue</span>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl space-y-1">
              <span className="text-[11px] text-[var(--text-secondary)] uppercase font-bold">Total Volume Streamed</span>
              <div className="text-3xl font-bold text-[var(--success)] tabular-nums">{formatBytes(totalVolume)}</div>
              <span className="text-[10px] text-[var(--text-secondary)]">Zero Cloud Storage Cost</span>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-xl space-y-1 flex flex-col justify-between">
              <span className="text-[11px] text-[var(--text-secondary)] uppercase font-bold">Export Audit Data</span>
              <button
                onClick={exportCSV}
                className="w-full py-2 px-3 rounded bg-[var(--bg-main)] border border-[var(--accent)] text-[var(--accent)] text-xs font-bold hover:bg-[var(--accent)] hover:text-[var(--bg-main)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DownloadSimple className="w-4 h-4" />
                Export CSV Spreadsheet
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <MagnifyingGlass className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by IP, File Name, Room ID, or Country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              <Funnel className="w-4 h-4 text-[var(--text-secondary)]" />
              <button
                onClick={() => setFilterEvent('all')}
                className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors ${
                  filterEvent === 'all'
                    ? 'bg-[var(--accent)] text-[var(--bg-main)]'
                    : 'bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All ({logs.length})
              </button>

              <button
                onClick={() => setFilterEvent('room_created')}
                className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors ${
                  filterEvent === 'room_created'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Created
              </button>

              <button
                onClick={() => setFilterEvent('transfer_completed')}
                className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-colors ${
                  filterEvent === 'transfer_completed'
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Completed
              </button>

              <button
                onClick={() => fetchTelemetry(adminKey)}
                className="p-2 rounded bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer ml-2"
                title="Refresh logs"
              >
                <ArrowClockwise className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Transfers & Audit Table */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <Globe className="w-4 h-4 text-[var(--accent)]" />
                <span>Real-Time Audit Log Stream ({filteredLogs.length} matching)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[11px] text-[var(--text-secondary)] uppercase">
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Client IP</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">File Name</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Room ID</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]/40 text-[11px]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-main)] transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${
                            log.event === 'transfer_completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {log.event === 'transfer_completed' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Lightning className="w-3 h-3" />
                          )}
                          {log.event}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-[var(--text-primary)] tabular-nums">{log.ip}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)]">
                        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-main)] border border-[var(--border-color)] text-[10px] font-bold text-[var(--accent)] mr-1">
                          {log.country}
                        </span>
                        {log.city}
                      </td>
                      <td className="py-3 px-3 text-[var(--text-primary)] truncate max-w-[200px]">{log.fileName}</td>
                      <td className="py-3 px-3 text-[var(--accent)] tabular-nums">{formatBytes(log.fileSize)}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] font-mono text-[10px]">{log.roomId}</td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
                        >
                          <Code className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deep Inspection Modal */}
          {selectedLog && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 max-w-xl w-full space-y-4 font-mono shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                  <span className="text-sm font-bold text-[var(--accent)]">Inspect Log Entry: {selectedLog.id}</span>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <pre className="bg-[var(--bg-main)] p-4 rounded-xl border border-[var(--border-color)] text-xs text-[var(--text-primary)] overflow-x-auto">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
