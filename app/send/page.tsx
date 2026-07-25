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
  FileZip,
  Warning,
  X,
} from '@phosphor-icons/react';
import { TelemetryDashboard } from '@/components/TelemetryDashboard';
import { useTransfer } from '@/lib/hooks/useTransfer';
import { buildDirectoryTree, filterSelectedFiles, FileTreeNode } from '@/lib/utils/folder-walker';
import { FolderTreeViewer } from '@/components/FolderTreeViewer';
import { archiveFilesToZip } from '@/lib/zip/zip-archiver';
import { sfx } from '@/lib/audio/sfx';

export default function SendPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState(1);

  // Optional Zip Archive state & Modal
  const [isZipEnabled, setIsZipEnabled] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipStatusText, setZipStatusText] = useState('');

  // Folder Slicer state
  const [directoryNodes, setDirectoryNodes] = useState<FileTreeNode[] | null>(null);
  const [rawFiles, setRawFiles] = useState<File[]>([]);

  const [copied, setCopied] = useState(false);

  const { state, errorMsg, roomId, shareUrl, telemetry, startSender } = useTransfer({
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
          handleBatchFileSelect([file]);
        }
      });
    }
  }, []);

  /**
   * INSTANT File & Multi-File Batch Selection — Zero RAM load, Zero waiting!
   */
  const handleBatchFileSelect = (files: FileList | File[]) => {
    const filesArray = Array.from(files);
    if (filesArray.length === 0) return;

    if (filesArray.length === 1) {
      setSelectedFile(filesArray[0]);
      setDirectoryNodes(null);
      setRawFiles(filesArray);
      setIsZipEnabled(false);
      setShowZipModal(false);
    } else {
      // Authentic Folder / Multi-File Package Naming
      setRawFiles(filesArray);
      const tree = buildDirectoryTree(filesArray);
      setDirectoryNodes(tree);

      const totalBatchSize = filesArray.reduce((acc, f) => acc + f.size, 0);
      
      const relativePath = filesArray[0]?.webkitRelativePath;
      let batchName = '';

      if (relativePath && relativePath.includes('/')) {
        // Authentic Root Folder Name (e.g. GTAVEnhanced -> GTAVEnhanced.zip)
        const rootFolder = relativePath.split('/')[0];
        batchName = `${rootFolder}.zip`;
      } else {
        // Smart Multi-File Package Name (e.g. photo1_and_5_other_files.zip)
        const firstName = filesArray[0].name.replace(/\.[^/.]+$/, '');
        batchName = filesArray.length === 2
          ? `${firstName}_and_1_other_file.zip`
          : `${firstName}_and_${filesArray.length - 1}_other_files.zip`;
      }

      const syntheticFile = new File([], batchName, { type: 'application/zip' });
      Object.defineProperty(syntheticFile, 'size', { value: totalBatchSize });
      setSelectedFile(syntheticFile);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleBatchFileSelect(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBatchFileSelect(e.dataTransfer.files);
    }
  };

  const handleStartTransfer = async () => {
    if (!selectedFile) return;

    if (isZipEnabled && rawFiles.length > 0) {
      setIsZipping(true);
      setZipProgress(0);
      setZipStatusText('Preparing lossless zip archive...');

      try {
        const activeFiles = directoryNodes 
          ? filterSelectedFiles(directoryNodes, rawFiles)
          : rawFiles;

        const zippedFile = await archiveFilesToZip(
          activeFiles,
          (percent, text) => {
            setZipProgress(percent);
            setZipStatusText(text);
          },
          selectedFile.name
        );

        setSelectedFile(zippedFile);
        setIsZipping(false);

        sfx.playSuccess();
        startSender();
      } catch (err) {
        console.error('Zip archiving failure:', err);
        setIsZipping(false);
        alert('Zip archiving failed. Falling back to direct streaming.');
        sfx.playSuccess();
        startSender();
      }
    } else {
      // 0s Delay Instant Stream Mode
      sfx.playSuccess();
      startSender();
    }
  };

  const copyShareUrl = () => {
    const targetUrl = shareUrl || (roomId ? `${window.location.origin}/receive/${roomId}` : '');
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    sfx.playCopy();
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
          Zero cloud upload delay. Single files, multiple loose files, or entire folders stream directly between devices.
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
                multiple
                className="hidden"
                id="file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleBatchFileSelect(e.target.files);
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
                    {selectedFile ? selectedFile.name : 'Drag & Drop File(s) or Folder to Stream'}
                  </h3>
                  <p className="text-xs font-mono text-[var(--text-secondary)] mt-1">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Instant Stream`
                      : 'Drop single files, multiple loose files, or whole folders'}
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <label
                    htmlFor="file-input"
                    className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 cursor-pointer shadow-lg"
                  >
                    Select File(s)
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
                    const updatedFile = new File([], selectedFile.name, { type: selectedFile.type || 'application/zip' });
                    Object.defineProperty(updatedFile, 'size', { value: activeSize, configurable: true });
                    setSelectedFile(updatedFile);
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
              <label htmlFor="passphrase-input" className="block text-xs font-mono text-[var(--text-primary)]">
                Optional Password Lock
              </label>
              <input
                id="passphrase-input"
                name="passphrase"
                type="password"
                autoComplete="new-password"
                placeholder="Set optional password for recipient"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Optional Zip Archive Slider Toggle (Only visible for multi-file batch / folder uploads) */}
            {(rawFiles.length > 1 || directoryNodes !== null) && (
              <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl p-3.5 space-y-1.5 font-mono text-xs animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)] font-bold flex items-center gap-1.5">
                    <FileZip className="w-4 h-4 text-amber-400" />
                    <span>Optional Zip Archive (.zip)</span>
                  </span>
                  
                  {/* Interactive Slider Switch */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isZipEnabled) {
                        setShowZipModal(true);
                      } else {
                        setIsZipEnabled(false);
                      }
                    }}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                      isZipEnabled ? 'bg-[var(--accent)] justify-end' : 'bg-[var(--border-color)] justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md transition-all" />
                  </button>
                </div>

                <p className="text-[10px] text-[var(--text-secondary)]">
                  {isZipEnabled
                    ? '⚠️ Zipping enabled (May add CPU compression delay).'
                    : '⚡ Default (0s Delay): Files stream directly with zero zipping wait.'}
                </p>
              </div>
            )}

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

            {/* Zipping Progress Bar */}
            {isZipping && (
              <div className="space-y-1.5 font-mono text-xs animate-fade-in">
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                  <span>{zipStatusText}</span>
                  <span className="text-[var(--accent)] font-bold">{zipProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-main)] rounded-full overflow-hidden border border-[var(--border-color)]">
                  <div
                    className="h-full bg-amber-400 transition-all duration-200"
                    style={{ width: `${zipProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Create Room Button */}
            <button
              disabled={!selectedFile || isZipping}
              onClick={handleStartTransfer}
              className="w-full py-3.5 rounded-lg bg-[var(--accent)] text-[var(--bg-main)] font-mono text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed glow-amber flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lightning className="w-5 h-5" weight="fill" />
              {isZipping ? `Compressing ZIP (${zipProgress}%)...` : 'Generate Instant Sharing Link'}
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
                  <label htmlFor="share-link-url-input" className="sr-only">
                    Share Link
                  </label>
                  <input
                    id="share-link-url-input"
                    name="shareLinkUrl"
                    type="text"
                    readOnly
                    value={shareUrl || (roomId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/receive/${roomId}` : '')}
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
                  url={shareUrl || (roomId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/receive/${roomId}` : '')}
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

      {/* Instant Closable Time Delay Warning Popup Modal on Batch / Folder Upload */}
      {showZipModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl font-mono animate-fade-in relative">
            
            {/* Top Close Button (x) */}
            <button
              onClick={() => setShowZipModal(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-main)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3 pt-1">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Warning className="w-6 h-6" weight="bold" />
              </div>
              <div className="space-y-1 pr-6">
                <h3 className="text-base font-bold text-[var(--text-primary)] font-display">
                  Batch Upload Detected
                </h3>
                <span className="text-[10px] text-[var(--accent)] font-semibold uppercase tracking-wider block">
                  0s Instant Stream Active By Default
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-color)] pt-4">
              <p>
                By default, PeerVault streams files individually with <strong className="text-[var(--text-primary)] font-bold">0.0s delay</strong> (No zipping wait time).
              </p>
              <p>
                If you prefer a single zipped archive, you can enable <strong className="text-amber-400 font-bold">Optional Zip Archive (.zip)</strong> in settings. <span className="text-[11px] text-[var(--text-secondary)] block pt-1">(Note: Zipping large files requires extra CPU processing time on your computer before streaming can begin).</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setIsZipEnabled(true);
                  setShowZipModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--accent)] text-[var(--accent)] text-xs font-bold hover:bg-[var(--accent)] hover:text-[var(--bg-main)] transition-all cursor-pointer text-center"
              >
                Enable Zip (.zip)
              </button>
              <button
                onClick={() => {
                  setIsZipEnabled(false);
                  setShowZipModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-lg glow-amber text-center"
              >
                Got It — Keep 0s Instant Stream
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
