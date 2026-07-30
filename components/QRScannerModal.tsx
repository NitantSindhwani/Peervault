'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, X, Image as ImageIcon, Camera, Flashlight, ShieldCheck, Lightning, Warning } from '@phosphor-icons/react';
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

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

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

      // Check if it's a PeerVault URL or Hash
      try {
        if (codeText.includes('/receive/') || codeText.includes('#offer=')) {
          // Parse destination path or full URL
          const urlObj = new URL(codeText, window.location.origin);
          const destination = urlObj.pathname + urlObj.hash;
          setTimeout(() => {
            onClose();
            router.push(destination);
          }, 400);
        } else if (codeText.startsWith('http://') || codeText.startsWith('https://')) {
          window.location.href = codeText;
        } else {
          // Raw string or hash fallback
          setTimeout(() => {
            onClose();
            router.push(`/receive/room#${codeText}`);
          }, 400);
        }
      } catch {
        setTimeout(() => {
          onClose();
          router.push(`/receive/room#${codeText}`);
        }, 400);
      }
    },
    [onClose, onScanSuccess, router, stopCamera]
  );

  // Scan Video Frames Loop
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleDecodedCode(code.data);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDecodedCode]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage(null);
    setHasCameraPermission(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('SecureContextRequired');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraPermission(true);
      setIsScanning(true);

      // Check flashlight availability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && 'getCapabilities' in videoTrack) {
        const capabilities = (videoTrack as any).getCapabilities();
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      console.warn('[QRScanner] Camera access error:', err);
      setHasCameraPermission(false);
      
      if (err.message === 'SecureContextRequired' || err.name === 'TypeError') {
        setErrorMessage(
          'Camera access requires a secure connection (HTTPS or localhost). Browsers block camera access on local network IPs (HTTP). Please use "Upload QR Image" instead.'
        );
      } else if (err.name === 'NotAllowedError') {
        setErrorMessage('Camera permission denied. Enable camera access in browser settings or upload a QR image below.');
      } else {
        setErrorMessage('Unable to access rear camera on this device. Try uploading a QR image instead.');
      }
    }
  }, [scanFrame, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedResult(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

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
            inversionAttempts: 'dontInvert',
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 sm:p-6 animate-fade-in font-mono">
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-2xl flex flex-col glow-amber">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <QrCode className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-display">
                Scan PeerVault QR
              </h2>
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                Instant Mobile Receiver Pairing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-[var(--accent)] text-[var(--bg-main)] border-[var(--accent)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Toggle Torch Light"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              aria-label="Close Scanner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder Viewport Area */}
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

          {/* Camera Permission / Error Fallback Overlay */}
          {hasCameraPermission === false && (
            <div className="absolute inset-0 p-6 bg-[var(--bg-main)]/95 flex flex-col items-center justify-center text-center space-y-4 font-mono">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <Warning className="w-7 h-7" weight="bold" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[var(--text-primary)] font-display">Camera Access Unavailable</h3>
                <p className="text-xs text-red-400 leading-relaxed max-w-xs">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Scanned Success Confirmation Overlay */}
          {scannedResult && (
            <div className="absolute inset-0 bg-[var(--bg-main)]/95 flex flex-col items-center justify-center text-center p-6 space-y-3 font-mono animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-[var(--success)]/10 border border-[var(--success)]/30 flex items-center justify-center text-[var(--success)]">
                <ShieldCheck className="w-8 h-8" weight="bold" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] font-display">PeerVault Code Detected!</h3>
              <p className="text-xs text-[var(--success)] font-bold">Initiating direct WebRTC P2P stream...</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--bg-main)] border-t border-[var(--border-color)] space-y-3">
          <p className="text-[11px] text-center text-[var(--text-secondary)]">
            Align PeerVault QR code inside frame for instant zero-reload transfer.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              <ImageIcon className="w-4 h-4 text-[var(--accent)]" weight="bold" />
              <span>Upload QR Image</span>
            </button>

            {hasCameraPermission === false && (
              <button
                onClick={startCamera}
                className="py-3 px-4 rounded-xl bg-[var(--accent)] text-[var(--bg-main)] font-bold text-xs transition-opacity hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                <Camera className="w-4 h-4" weight="bold" />
                <span>Retry</span>
              </button>
            )}
          </div>
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
