'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SpeakerHigh,
  SpeakerSimpleSlash,
  CornersOut,
  ArrowsIn,
  Clock,
  Gear,
} from '@phosphor-icons/react';

export interface MediaPlayerProps {
  src: string;
  fileName: string;
  fileSize?: number;
  type?: 'video' | 'audio';
}

export function MediaPlayer({ src, fileName, fileSize, type = 'video' }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const onTimeUpdate = () => setCurrentTime(media.currentTime);
    const onLoadedMetadata = () => setDuration(media.duration);
    const onEnded = () => setIsPlaying(false);

    media.addEventListener('timeupdate', onTimeUpdate);
    media.addEventListener('loadedmetadata', onLoadedMetadata);
    media.addEventListener('ended', onEnded);

    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      media.removeEventListener('timeupdate', onTimeUpdate);
      media.removeEventListener('loadedmetadata', onLoadedMetadata);
      media.removeEventListener('ended', onEnded);
    };
  }, [src]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyF' && type === 'video') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'ArrowRight' && mediaRef.current) {
        mediaRef.current.currentTime = Math.min(mediaRef.current.duration, mediaRef.current.currentTime + 5);
      } else if (e.code === 'ArrowLeft' && mediaRef.current) {
        mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    const nextMuted = !isMuted;
    mediaRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!mediaRef.current) return;
    setVolume(newVolume);
    mediaRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (mediaRef.current) mediaRef.current.currentTime = time;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] overflow-hidden shadow-2xl group font-mono"
    >
      {/* Media Element */}
      <div className="relative bg-black flex items-center justify-center min-h-[260px] max-h-[500px]">
        {type === 'video' ? (
          <video
            // @ts-ignore
            ref={mediaRef}
            src={src}
            onClick={togglePlay}
            className="w-full h-full max-h-[500px] object-contain cursor-pointer"
          />
        ) : (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--accent)] flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>
            <audio
              // @ts-ignore
              ref={mediaRef}
              src={src}
            />
            <p className="text-sm font-bold text-[var(--text-primary)]">{fileName}</p>
          </div>
        )}

        {/* Big Play Overlay Button on Hover */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-[var(--accent)] text-[var(--bg-main)] flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer glow-amber"
          >
            <Play className="w-8 h-8 ml-1" weight="fill" />
          </button>
        )}
      </div>

      {/* Control Bar Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 space-y-3 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Range Input */}
        <div className="space-y-1">
          <label htmlFor="media-scrubber-input" className="sr-only">
            Seek Video Time
          </label>
          <input
            id="media-scrubber-input"
            name="mediaScrubber"
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[var(--accent)] bg-gray-700 h-1.5 rounded-lg cursor-pointer appearance-none"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-4 text-xs text-[var(--text-primary)]">
          
          {/* Left Controls: Play, Volume */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" weight="fill" /> : <Play className="w-4 h-4 ml-0.5" weight="fill" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                {isMuted || volume === 0 ? <SpeakerSimpleSlash className="w-4 h-4 text-red-400" /> : <SpeakerHigh className="w-4 h-4" />}
              </button>
              <label htmlFor="media-volume-input" className="sr-only">
                Volume Control
              </label>
              <input
                id="media-volume-input"
                name="mediaVolume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 accent-[var(--accent)] h-1 bg-gray-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Right Controls: Speed Selector, Fullscreen */}
          <div className="flex items-center gap-3">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface)] px-2 py-1 rounded-lg border border-[var(--border-color)] text-[10px]">
              {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === s ? 'bg-[var(--accent)] text-[var(--bg-main)] font-bold' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {type === 'video' && (
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors cursor-pointer"
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? <ArrowsIn className="w-4 h-4" /> : <CornersOut className="w-4 h-4" />}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
