'use client';

import { QRCodeViewer } from '@/components/QRCodeViewer';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  UploadSimple,
  ShieldCheck,
  Lightning,
  Copy,
  Check,
  Folder,
  Timer,
  ArrowsClockwise,
  LockKey,
  CheckCircle,
} from '@phosphor-icons/react';
import { TelemetryDashboard } from '@/components/TelemetryDashboard';
import { useTransfer } from '@/lib/hooks/useTransfer';
import { buildDirectoryTree, filterSelectedFiles, FileTreeNode } from '@/lib/utils/folder-walker';
import { FolderTreeViewer } from '@/components/FolderTreeViewer';

export default function SendPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState(1);

  // Folder Slicer state
  const [directoryNodes, setDirectoryNodes] = useState<FileTreeNode[] | null>(null);
  const [rawFiles, setRawFiles] = useState<File[]>([]);

  const [copied, setCopied] = useState(false);

  const { state, errorMsg, roomId, telemetry, startSender } = useTransfer({
    role: 'sender',
    file: selectedFile,
    passphrase,
    useOpaque: true,
    enableStaging: true,
    ttlHours,
    maxDownloads,
  });

  const isTransferring = state !== 'idle';

  // PWA Native File Launch Handler
  useEffect(() => {
    if (typeof window !== 'undefined' && 'launchQueue' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (launchParams.files && launchParams.files.length > 0) {
          const handle = launchParams.files[0];
          const file = await handle.getFile();
          handleFileSelect(file);
        }
      });
    }
  }, []);

  /**
   * INSTANT File Selection — Zero RAM load, Zero waiting!
   */
  const handleFileSelect = (file: File) => {
    // Instant file handle attachment without reading ArrayBuffer into memory upfront
    setSelectedFile(file);
    setDirectoryNodes(null);
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setRawFiles(filesArray);
      const tree = buildDirectoryTree(filesArray);
      setDirectoryNodes(tree);

      const totalFolderSize = filesArray.reduce((acc, f) => acc + f.size, 0);
      const folderName = filesArray[0].webkitRelativePath.split('/')[0] || 'dataset_folder';
      const syntheticFile = new File([], `${folderName}.zip`, { type: 'application/zip' });
      Object.defineProperty(syntheticFile, 'size', { value: totalFolderSize });
      setSelectedFile(syntheticFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const copyShareUrl = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/receive/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)]">
          <UploadSimple className="w-3.5 h-3.5" />
          <span>100% Free • Direct Device-to-Device Stream</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] font-display">
          Instant Direct P2P Sharing
        </h1>
        <p className="text-sm text-[var(--text-secondary)] font-mono max-w-[65ch]">
          Zero cloud upload delay. Your file is streamed directly from your device to the recipient via encrypted WebRTC channels.
        </p>
      </div>

      {!isTransferring ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Dropzone & Folder Slicer (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[320px] ${
                isDragOver
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 glow-amber'
                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--accent)]'
              }`}
            >
              <input
                type="file"
                className="hidden"
                id="file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <input
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                id="folder-input"
                onChange={handleFolderSelect}
              />

              <div className="space-y-4 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)]">
                  <UploadSimple className="w-8 h-8" weight="bold" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-mono text-[var(--text-primary)]">
                    {selectedFile ? selectedFile.name : 'Select Any File or Folder to Share Instantly'}
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-secondary)] mt-1">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Instant Stream`
                      : 'No file size limits — file streams directly from your disk'}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <label
                    htmlFor="file-input"
                    className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 cursor-pointer shadow-lg"
                  >
                    Select File
                  </label>
                  <label
                    htmlFor="folder-input"
                    className="px-4 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] font-mono text-xs text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer flex items-center gap-1.5"
                  >
                    <Folder className="w-4 h-4 text-amber-400" weight="fill" />
                    Select Folder
                  </label>
                </div>
              </div>
            </div>

            {/* Folder Slicer Viewer Panel */}
            {directoryNodes && (
              <FolderTreeViewer
                nodes={directoryNodes}
                onSelectionChange={(updatedNodes) => {
                  setDirectoryNodes(updatedNodes);
                  const selectedFiles = filterSelectedFiles(updatedNodes, rawFiles);
                  const activeSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
                  if (selectedFile) {
                    Object.defineProperty(selectedFile, 'size', { value: activeSize });
                  }
                }}
              />
            )}
          </div>

          {/* Transfer Security & Config Panel (5 cols) */}
          <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 space-y-6">
            <div className="border-b border-[var(--border-color)] pb-3 space-y-1">
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-display">Security & Expiry Settings</h3>
              <p className="text-xs text-[var(--text-secondary)] font-mono">100% Free & Fully Unlocked</p>
            </div>

            {/* Optional Passphrase */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-[var(--text-primary)]">
                Optional Password Lock
              </label>
              <input
                type="text"
                placeholder="Set optional password for recipient"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Expiry Selectors */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Auto-Expire Room</span>
                </label>
                <select
                  value={ttlHours}
                  onChange={(e) => setTtlHours(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value={1}>1 Hour</option>
                  <option value={6}>6 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={72}>72 Hours</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                  <ArrowsClockwise className="w-3.5 h-3.5 text-[var(--success)]" />
                  <span>Download Limit</span>
                </label>
                <select
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value={1}>Self-Destruct (1 Use)</option>
                  <option value={3}>3 Downloads</option>
                  <option value={10}>10 Downloads</option>
                  <option value={0}>Unlimited</option>
                </select>
              </div>
            </div>

            {/* All Security Protections Badge */}
            <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-4 space-y-2 font-mono text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2 text-[var(--success)] font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>All Security Features Active By Default</span>
              </div>
              <ul className="space-y-1 text-[11px] pt-1">
                <li className="flex items-center gap-1.5">✓ End-to-End Encrypted (AES-256-GCM)</li>
                <li className="flex items-center gap-1.5">✓ Zero Cloud Storage Residue</li>
                <li className="flex items-center gap-1.5">✓ Automatic Metadata Scrubbing</li>
                <li className="flex items-center gap-1.5">✓ Resume Interrupted Transfers</li>
              </ul>
            </div>

            {/* Create Room Button */}
            <button
              disabled={!selectedFile}
              onClick={startSender}
              className="w-full py-3.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed glow-amber flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lightning className="w-5 h-5" weight="fill" />
              Generate Instant Sharing Link
            </button>
          </div>

        </div>
      ) : (
        /* Active Transfer Sender Dashboard */
        <div className="space-y-8">
          
          {/* Share Link & QR Card */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-xl">
            
            <div className="md:col-span-8 space-y-4">
              <div className="space-y-1 font-mono">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30 text-xs text-[var(--success)] font-bold mb-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>0-Second Link Generated (Zero Server Upload)</span>
                </div>
                <h3 className="text-2xl font-bold text-[var(--text-primary)] font-display">
                  {state === 'waiting_peer' ? 'Ready to Stream — Send Link Below' : `Status: ${state.toUpperCase()}`}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Your file remains 100% on your device disk. <strong>Zero bytes are uploaded to any cloud server</strong>. Streaming begins the moment your recipient opens the link.
                </p>
              </div>

              {/* URL Input + Copy */}
              {roomId && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/receive/${roomId}`}
                    className="flex-1 px-3.5 py-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] font-mono text-xs text-[var(--text-primary)] font-bold selection:bg-[var(--accent)]"
                  />
                  <button
                    onClick={copyShareUrl}
                    className="px-5 py-3 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg glow-amber"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied Link!' : 'Copy Share Link'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* QR Code Container */}
            {roomId && (
              <div className="md:col-span-4 flex justify-center border-t md:border-t-0 md:border-l border-[var(--border-color)] pt-4 md:pt-0 md:pl-6">
                <QRCodeViewer
                  url={`${typeof window !== 'undefined' ? window.location.origin : ''}/receive/${roomId}`}
                  size={160}
                />
              </div>
            )}

          </div>

          {/* Status Indicator Card */}
          {state === 'waiting_peer' ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--accent)]/30 rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mx-auto border border-[var(--accent)]/30 animate-pulse">
                <Lightning className="w-6 h-6" weight="fill" />
              </div>
              <div className="space-y-1 font-mono">
                <h4 className="text-base font-bold text-[var(--text-primary)] font-display">
                  Waiting for Recipient to Open Link...
                </h4>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  Keep this browser tab open. As soon as your recipient opens the link, a direct peer-to-peer connection will be established instantly.
                </p>
              </div>
            </div>
          ) : (
            /* Active Live Sender Telemetry */
            <TelemetryDashboard mock={false} liveData={telemetry} />
          )}

        </div>
      )}

    </div>
  );
}
