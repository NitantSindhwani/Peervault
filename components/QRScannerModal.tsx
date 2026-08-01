'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  X,
  Image as ImageIcon,
  Camera,
  Flashlight,
  ShieldCheck,
  Warning,
  ArrowsClockwise,
  Key,
  Lightning,
  Sparkle,
  Check,
} from '@phosphor-icons/react';
import jsQR from 'jsqr';
import { soundEngine } from '@/lib/audio/sound-engine';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (scannedUrl: string) => void;
}

export function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Tab mode: 'camera' | 'manual'
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualRoomInput, setManualRoomInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableVideoDevices, setAvailableVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);

  // Detect native BarcodeDetector API support
  const barcodeDetectorRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        // @ts-ignore
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  const changeZoom = async (level: number) => {
    setZoomLevel(level);
    soundEngine.playHoverClick();
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const capabilities = (track as any).getCapabilities?.() || {};
        if (capabilities.zoom) {
          const min = capabilities.zoom.min || 1;
          const max = capabilities.zoom.max || 5;
          const target = Math.min(max, Math.max(min, level));
          await (track as any).applyConstraints({
            advanced: [{ zoom: target }],
          });
        }
      } catch (e) {
        console.warn('[QRScanner] Native zoom constraint error:', e);
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setTorchOn(false);
  }, []);

  const handleDecodedCode = useCallback(
    (codeText: string) => {
      stopCamera();
      soundEngine.playCompletionChime();
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([35, 50, 35]);
        } catch {}
      }
      setScannedResult(codeText);

      if (onScanSuccess) {
        onScanSuccess(codeText);
      }

      // Parse and navigate to PeerVault room or URL
      try {
        let cleanText = codeText.trim();
        if (cleanText.includes('/receive/') || cleanText.includes('#offer=')) {
          const urlObj = new URL(cleanText, window.location.origin);
          const destination = urlObj.pathname + urlObj.hash;
          setTimeout(() => {
            onClose();
            router.push(destination);
          }, 400);
        } else if (cleanText.startsWith('http://') || cleanText.startsWith('https://')) {
          window.location.href = cleanText;
        } else {
          // Direct room ID (e.g. pv_abcdef12)
          const cleanRoomId = cleanText.replace(/[^a-zA-Z0-9_-]/g, '');
          setTimeout(() => {
            onClose();
            router.push(`/receive/${cleanRoomId}`);
          }, 400);
        }
      } catch {
        const cleanRoomId = codeText.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        setTimeout(() => {
          onClose();
          router.push(`/receive/${cleanRoomId}`);
        }, 400);
      }
    },
    [onClose, onScanSuccess, router, stopCamera]
  );

  // High-Performance Hybrid Decoding Loop (Native BarcodeDetector -> Downscaled jsQR attemptBoth)
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Fast-path: Native GPU BarcodeDetector API if supported by OS/Browser
    if (barcodeDetectorRef.current) {
      barcodeDetectorRef.current
        .detect(video)
        .then((barcodes: any[]) => {
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleDecodedCode(barcodes[0].rawValue);
            return;
          }
        })
        .catch(() => {});
    }

    // Downscale heavy 4K/1080p video stream to max 640px for ultra-fast jsQR execution
    const maxDim = 640;
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;

    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // attemptBoth enables decoding of inverted dark-mode QR codes as well as standard light QR codes
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        handleDecodedCode(code.data);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDecodedCode]);

  // Start Camera Stream with Robust Constraint Fallbacks & Multi-Lens Selection
  const startCamera = useCallback(async (targetFacingMode = facingMode, targetDeviceId = selectedDeviceId) => {
    stopCamera();
    setErrorMessage(null);
    setIsRequestingCamera(true);

    // 1. Secure Context check
    const isSecure = typeof window !== 'undefined' && (
      window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'https:'
    );

    if (!isSecure || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsRequestingCamera(false);
      setHasCameraPermission(false);
      setErrorMessage(
        'Camera access requires a secure connection (HTTPS or localhost). Browsers disable live camera access on plain HTTP local IP connections. Please upload a QR image below or use HTTPS / localhost.'
      );
      return;
    }

    // Enumerate camera devices for multi-lens support
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableVideoDevices(videoDevices);
    } catch {}

    // Constraint Fallbacks
    const constraintCandidates: MediaStreamConstraints[] = [];

    if (targetDeviceId) {
      constraintCandidates.push({
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    }

    constraintCandidates.push(
      {
        video: {
          facingMode: { ideal: targetFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      {
        video: {
          facingMode: { ideal: targetFacingMode },
        },
      },
      {
        video: {
          facingMode: targetFacingMode,
        },
      },
      {
        video: true,
      }
    );

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    for (const constraints of constraintCandidates) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err: any) {
        lastErr = err;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    setIsRequestingCamera(false);

    if (!stream) {
      console.warn('[QRScanner] All camera constraints failed:', lastErr);
      setHasCameraPermission(false);

      if (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Tap "Allow Camera Access" or check browser settings.');
      } else if (lastErr?.name === 'NotFoundError' || lastErr?.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device found on this system. You can upload a QR image file below.');
      } else if (lastErr?.name === 'NotReadableError' || lastErr?.name === 'TrackStartError') {
        setErrorMessage('Camera is currently in use by another tab or app. Please close other camera apps and retry.');
      } else {
        setErrorMessage('Unable to activate camera. Tap "Allow Camera Access" or enter room code manually.');
      }
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        console.warn('[QRScanner] Video play error:', playErr);
      }
    }

    setHasCameraPermission(true);
    setIsScanning(true);

    // Check flashlight capability
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && 'getCapabilities' in videoTrack) {
      try {
        const capabilities = (videoTrack as any).getCapabilities();
        if (capabilities.torch) {
          setHasTorch(true);
        }
      } catch {}
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [facingMode, selectedDeviceId, scanFrame, stopCamera]);

  // Flip Camera (Front <-> Back)
  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedDeviceId(null);
    startCamera(nextFacing, null);
  };

  // Attempt auto-start on mount & register Escape key press listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        stopCamera();
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      if (activeTab === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
      setScannedResult(null);
      setManualRoomInput('');
      setManualError(null);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopCamera();
    };
  }, [isOpen, activeTab, startCamera, stopCamera, onClose]);

  // Toggle Torch Light
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('[QRScanner] Torch toggle failed:', e);
      }
    }
  };

  // Process File Upload Fallback
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data) {
            handleDecodedCode(code.data);
          } else {
            setErrorMessage('Could not detect a valid QR code in the uploaded image. Try another photo.');
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Manual Room Code Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const raw = manualRoomInput.trim();
    if (!raw) {
      setManualError('Please enter a valid PeerVault room code or URL.');
      return;
    }

    soundEngine.playCompletionChime();
    handleDecodedCode(raw);
  };

  if (!isOpen) return null;

  return (
    /* Backdrop Overlay - Clicking outside modal closes it */
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-fade-in font-mono cursor-pointer"
    >
      {/* Modal Dialog Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-2xl flex flex-col glow-amber cursor-default my-auto"
      >
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <QrCode className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-display">
                Pair PeerVault Stream
              </h2>
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                Instant Direct Transfer Receiver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Flip Camera Button */}
            {activeTab === 'camera' && availableVideoDevices.length > 1 && (
              <button
                onClick={toggleCameraFacing}
                className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Flip Camera (Front/Back)"
              >
                <ArrowsClockwise className="w-4 h-4" />
              </button>
            )}

            {/* Torch Toggle */}
            {activeTab === 'camera' && hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Toggle Flashlight"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all flex items-center justify-center cursor-pointer shadow-sm shrink-0"
              aria-label="Close Scanner"
              title="Close Modal (Esc)"
            >
              <X className="w-4 h-4" weight="bold" />
            </button>
          </div>
        </div>

        {/* Tab Selector: Camera Scanner vs Manual Room Code */}
        <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-main)] text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('camera');
              startCamera();
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Camera Scanner</span>
          </button>

          <button
            onClick={() => {
              stopCamera();
              setActiveTab('manual');
            }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Enter Room Code</span>
          </button>
        </div>

        {/* Camera Scanner Viewport */}
        {activeTab === 'camera' ? (
          <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
            {/* Hidden Canvas for Decoding */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Stream Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ transform: `scale(${zoomLevel})` }}
              className={`w-full h-full object-cover transition-all duration-300 ${
                isScanning ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Target Reticle Overlay */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12">
                <div className="relative w-full aspect-square max-w-[240px] border-2 border-white/20 rounded-2xl overflow-hidden shadow-2xl">
                  {/* 4 Corner Markers */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[var(--accent)] rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[var(--accent)] rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[var(--accent)] rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[var(--accent)] rounded-br-lg" />

                  {/* Animated Pulsing Laser Line */}
                  <div className="w-full h-1 bg-[var(--accent)] shadow-[0_0_15px_var(--accent)] animate-[pulseScan_2s_infinite_linear]" />
                </div>
              </div>
            )}

            {/* 1x, 2x, 3x Zoom Controls Overlay */}
            {isScanning && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 shadow-xl">
                {[1, 2, 3].map((level) => (
                  <button
                    key={level}
                    onClick={() => changeZoom(level)}
                    className={`w-9 h-9 rounded-full font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      zoomLevel === level
                        ? 'bg-[var(--accent)] text-[var(--bg-main)] shadow-lg scale-105'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {level}x
                  </button>
                ))}
              </div>
            )}

            {/* Camera Permission Required Overlay */}
            {!isScanning && hasCameraPermission !== true && (
              <div className="absolute inset-0 p-6 bg-[var(--bg-main)]/95 flex flex-col items-center justify-center text-center space-y-4 font-mono z-30">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] animate-pulse">
                  <Camera className="w-8 h-8" weight="bold" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-[var(--text-primary)] font-display">
                    {errorMessage ? 'Camera Access Required' : 'Camera Scanner Ready'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs">
                    {errorMessage || 'Tap below to grant camera access and scan your PeerVault QR code.'}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={() => startCamera()}
                    disabled={isRequestingCamera}
                    className="w-full py-3.5 px-6 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-mono font-bold text-xs hover:opacity-90 transition-all glow-amber flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" weight="bold" />
                    <span>{isRequestingCamera ? 'Requesting Access...' : 'Allow Camera Access & Scan'}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('manual')}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] font-mono font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Enter Room Code Manually</span>
                  </button>
                </div>
              </div>
            )}

            {/* Scanned Success Overlay */}
            {scannedResult && (
              <div className="absolute inset-0 bg-[var(--bg-main)]/95 flex flex-col items-center justify-center text-center p-6 space-y-3 font-mono animate-fade-in z-40">
                <div className="w-14 h-14 rounded-2xl bg-[var(--success)]/10 border border-[var(--success)]/30 flex items-center justify-center text-[var(--success)]">
                  <ShieldCheck className="w-8 h-8" weight="bold" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)] font-display">PeerVault Code Detected!</h3>
                <p className="text-xs text-[var(--success)] font-bold">Initiating direct WebRTC P2P stream...</p>
              </div>
            )}
          </div>
        ) : (
          /* Manual Room ID / Link Input Tab */
          <div className="p-6 space-y-5 bg-[var(--bg-surface)] min-h-[300px] flex flex-col justify-center">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-display flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--accent)]" />
                <span>Enter Room Code or Share Link</span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Paste the room code (e.g. <code className="text-[var(--accent)] font-bold">pv_a1b2c3d4</code>) or full share link sent by your peer.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <input
                  type="text"
                  autoFocus
                  value={manualRoomInput}
                  onChange={(e) => {
                    setManualRoomInput(e.target.value);
                    setManualError(null);
                  }}
                  placeholder="pv_a1b2c3d4 or https://peervault.app/receive/..."
                  className="w-full px-4 py-3.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-bold selection:bg-[var(--accent)] placeholder:text-[var(--text-secondary)]/50"
                />
                {manualError && (
                  <p className="text-[11px] text-red-400 font-bold flex items-center gap-1">
                    <Warning className="w-3.5 h-3.5" />
                    <span>{manualError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-mono text-xs font-bold hover:opacity-90 transition-opacity glow-amber flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Lightning className="w-4 h-4" weight="fill" />
                <span>Connect & Start Stream</span>
              </button>
            </form>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--bg-main)] border-t border-[var(--border-color)]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <ImageIcon className="w-4.5 h-4.5 text-[var(--accent)]" weight="bold" />
            <span>Upload QR Image File</span>
          </button>
        </div>

      </div>

      <style jsx global>{`
        @keyframes pulseScan {
          0% {
            transform: translateY(0px);
            opacity: 0.8;
          }
          50% {
            transform: translateY(220px);
            opacity: 1;
          }
          100% {
            transform: translateY(0px);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}
