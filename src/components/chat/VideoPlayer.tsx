import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, FastForward } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  previewMode?: boolean;
}

type VendorDocument = Document & {
  webkitFullscreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type VendorContainer = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

type VendorVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

// ─────────────────────────────────────────────────────────────
// Utility: format seconds → "mm:ss"
// ─────────────────────────────────────────────────────────────
const fmt = (t: number) => {
  if (!t || isNaN(t)) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function VideoPlayer({ src, className = '', style = {}, previewMode = false }: VideoPlayerProps) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const containerRef    = useRef<HTMLDivElement>(null);
  const progressBarRef  = useRef<HTMLDivElement>(null);
  const fillRef         = useRef<HTMLDivElement>(null);
  const thumbRef        = useRef<HTMLDivElement>(null);
  const timeDisplayRef  = useRef<HTMLSpanElement>(null);
  const rafRef          = useRef<number>(0);

  // ──── State (only what truly needs re‐render) ────
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isMuted, setIsMuted]             = useState(false);
  const [showControls, setShowControls]   = useState(true);
  const [playbackRate, setPlaybackRate]   = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isHoldSpeed, setIsHoldSpeed]     = useState(false);   // long-press 2× indicator
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);

  // Refs for values that don't need re‐render
  const hideTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRateRef        = useRef(1);       // rate before hold‐to‐speed
  const holdTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef        = useRef(false);
  const tapTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef      = useRef(0);
  const isSeeking           = useRef(false);

  // ─────────────────────────────────────────────────────────
  // 1. PROGRESS BAR — direct DOM manipulation (zero re‐render)
  // ─────────────────────────────────────────────────────────
  const tickProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) { rafRef.current = requestAnimationFrame(tickProgress); return; }

    const pct = (v.currentTime / v.duration) * 100;
    if (fillRef.current)  fillRef.current.style.width  = `${pct}%`;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${fmt(v.currentTime)} / ${fmt(v.duration)}`;
    }
    rafRef.current = requestAnimationFrame(tickProgress);
  }, []);

  // ─────────────────────────────────────────────────────────
  // 2. VIDEO EVENT LISTENERS
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay  = () => { setIsPlaying(true);  rafRef.current = requestAnimationFrame(tickProgress); };
    const onPause = () => { setIsPlaying(false); cancelAnimationFrame(rafRef.current); };
    const onEnded = () => { setIsPlaying(false); cancelAnimationFrame(rafRef.current); };

    // Fullscreen change (all browser prefixes)
    const onFSChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as VendorDocument).webkitFullscreenElement ||
        (document as VendorDocument).msFullscreenElement
      );
      setIsFullscreen(isFull);
      if (!isFull && previewMode && v) {
        v.muted = true; setIsMuted(true); v.play();
      }
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);

    // Preview mode auto‐play
    if (previewMode) {
      v.muted = true; setIsMuted(true); v.loop = true;
      v.play().catch(() => {});
    }

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      cancelAnimationFrame(rafRef.current);
    };
  }, [previewMode, tickProgress]);

  // ─────────────────────────────────────────────────────────
  // 3. CONTROLS AUTO‐HIDE
  // ─────────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  }, []);

  // ─────────────────────────────────────────────────────────
  // 4. PLAYBACK CONTROLS
  // ─────────────────────────────────────────────────────────
  const togglePlay = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
    scheduleHide();
  }, [scheduleHide]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  // ─────────────────────────────────────────────────────────
  // 5. FULLSCREEN — cross‐platform
  // ─────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    const c = containerRef.current;
    const v = videoRef.current;
    if (!c || !v) return;

    const vendorDocument = document as VendorDocument;
    const vendorContainer = c as VendorContainer;
    const vendorVideo = v as VendorVideo;
    const fsEl = document.fullscreenElement || vendorDocument.webkitFullscreenElement;

    if (!fsEl) {
      // Enter fullscreen
      const req = c.requestFullscreen?.bind(c)
               || vendorContainer.webkitRequestFullscreen?.bind(c)
               || vendorContainer.msRequestFullscreen?.bind(c);
      if (req) {
        req().catch(() => {
          // iOS Safari fallback: fullscreen on <video> directly
          vendorVideo.webkitEnterFullscreen?.();
        });
      } else if (vendorVideo.webkitEnterFullscreen) {
        vendorVideo.webkitEnterFullscreen();
      }
    } else {
      // Exit fullscreen
      const exit = document.exitFullscreen?.bind(document)
                || vendorDocument.webkitExitFullscreen?.bind(document)
                || vendorDocument.msExitFullscreen?.bind(document);
      if (exit) exit();
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // 6. SPEED MENU
  // ─────────────────────────────────────────────────────────
  const changeSpeed = useCallback((rate: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    savedRateRef.current = rate;
    setShowSpeedMenu(false);
  }, []);

  // ─────────────────────────────────────────────────────────
  // 7. PROGRESS BAR SEEK (pointer events — works touch + mouse)
  // ─────────────────────────────────────────────────────────
  const seekTo = useCallback((clientX: number) => {
    const bar = progressBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
    if (fillRef.current) fillRef.current.style.width = `${pct * 100}%`;
  }, []);

  const onProgressPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isSeeking.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  }, [seekTo]);

  const onProgressPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isSeeking.current) return;
    e.stopPropagation();
    seekTo(e.clientX);
  }, [seekTo]);

  const onProgressPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isSeeking.current) return;
    e.stopPropagation();
    isSeeking.current = false;
  }, []);

  // ─────────────────────────────────────────────────────────
  // 8. LONG‐PRESS TO 2× SPEED (like YouTube)
  //    Works with both mouse (mousedown/up) and touch (touchstart/end)
  // ─────────────────────────────────────────────────────────
  const startHoldSpeed = useCallback(() => {
    if (isHoldingRef.current) return;
    holdTimerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      isHoldingRef.current = true;
      savedRateRef.current = v.playbackRate;
      v.playbackRate = 2;
      setIsHoldSpeed(true);
    }, 400); // 400ms hold threshold
  }, []);

  const endHoldSpeed = useCallback(() => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (isHoldingRef.current) {
      const v = videoRef.current;
      if (v) v.playbackRate = savedRateRef.current;
      setPlaybackRate(savedRateRef.current);
      isHoldingRef.current = false;
      setIsHoldSpeed(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // 9. DOUBLE‐TAP TO SEEK ±10s (YouTube style)
  // ─────────────────────────────────────────────────────────
  const handleVideoAreaTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Don't handle in preview mode
    if (previewMode && !isFullscreen) return;

    const now = Date.now();
    const delta = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (delta < 300) {
      // Double‐tap detected
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      const v = videoRef.current;
      const c = containerRef.current;
      if (!v || !c) return;

      // Determine tap side
      const rect = c.getBoundingClientRect();
      const clientX = 'touches' in e ? (e as React.TouchEvent).changedTouches[0].clientX : (e as React.MouseEvent).clientX;
      const half = rect.left + rect.width / 2;

      if (clientX < half) {
        v.currentTime = Math.max(0, v.currentTime - 10);
        setDoubleTapSide('left');
      } else {
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
        setDoubleTapSide('right');
      }
      setTimeout(() => setDoubleTapSide(null), 600);
    } else {
      // Single tap — delay to differentiate from double
      tapTimerRef.current = setTimeout(() => {
        togglePlay();
        tapTimerRef.current = null;
      }, 300);
    }

    scheduleHide();
  }, [previewMode, isFullscreen, togglePlay, scheduleHide]);

  // ─────────────────────────────────────────────────────────
  // 10. KEYBOARD SHORTCUTS (when player focused)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (previewMode && !isFullscreen) return;

    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (v.paused) void v.play();
          else v.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = Math.min(v.duration, v.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case 'm':
          v.muted = !v.muted;
          setIsMuted(v.muted);
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
      scheduleHide();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewMode, isFullscreen, toggleFullscreen, scheduleHide]);

  // Cleanup timers
  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (tapTimerRef.current)  clearTimeout(tapTimerRef.current);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const isControlMode = !previewMode || isFullscreen;

  return (
    <div
      ref={containerRef}
      className={`custom-video-container ${className} ${showControls || !isPlaying ? 'show-controls' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={isFullscreen ? { borderRadius: 0, width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' } : style}
      onMouseMove={isControlMode ? scheduleHide : undefined}
      onMouseLeave={() => { if (isPlaying) { setShowControls(false); setShowSpeedMenu(false); } }}
      // Long‐press 2× speed (mouse)
      onMouseDown={isControlMode ? startHoldSpeed : undefined}
      onMouseUp={endHoldSpeed}
      // Touch events for long‐press
      onTouchStart={isControlMode ? startHoldSpeed : undefined}
      onTouchEnd={endHoldSpeed}
      onTouchCancel={endHoldSpeed}
      // Tap / double‐tap handler
      onClick={isControlMode ? handleVideoAreaTap : undefined}
    >
      <video
        ref={videoRef}
        src={src}
        className={`custom-video-element ${previewMode && !isFullscreen ? 'preview-mode-video' : ''}`}
        preload="metadata"
        playsInline
        muted={previewMode && !isFullscreen ? true : isMuted}
        loop={previewMode && !isFullscreen}
        onClick={previewMode && !isFullscreen ? (e) => { e.stopPropagation(); toggleFullscreen(e); } : (e) => e.stopPropagation()}
      />

      {/* Center play icon */}
      {!isPlaying && isControlMode && (
        <div className="custom-video-center-play">
          <Play size={36} fill="white" />
        </div>
      )}

      {/* Hold‐to‐speed indicator (2×) */}
      {isHoldSpeed && (
        <div className="video-hold-speed-indicator">
          <FastForward size={18} />
          <span>2×</span>
        </div>
      )}

      {/* Double‐tap ±10s ripple */}
      {doubleTapSide && (
        <div className={`video-doubletap-ripple ${doubleTapSide}`}>
          <span>{doubleTapSide === 'left' ? '-10s' : '+10s'}</span>
        </div>
      )}

      {/* Controls Overlay */}
      {isControlMode && (
        <div className="custom-video-controls" onClick={e => e.stopPropagation()}>
          {/* Progress bar — uses pointer events for touch + mouse seek */}
          <div
            className="custom-video-progress-container"
            ref={progressBarRef}
            onPointerDown={onProgressPointerDown}
            onPointerMove={onProgressPointerMove}
            onPointerUp={onProgressPointerUp}
            style={{ touchAction: 'none' }}
          >
            <div className="custom-video-progress-bg">
              <div className="custom-video-progress-fill" ref={fillRef} style={{ width: '0%' }}>
                <div className="custom-video-progress-thumb" ref={thumbRef} />
              </div>
            </div>
          </div>

          {/* Lower controls bar */}
          <div className="custom-video-controls-bar">
            <div className="custom-video-controls-left">
              <button className="custom-video-btn" onClick={(e) => { e.stopPropagation(); togglePlay(e); }}>
                {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
              </button>
              <span className="custom-video-time" ref={timeDisplayRef}>00:00 / 00:00</span>
              <button className="custom-video-btn" onClick={toggleMute}>
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>

            <div className="custom-video-controls-right">
              <div style={{ position: 'relative' }}>
                <button
                  className={`custom-video-btn custom-video-speed-btn ${playbackRate !== 1 ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="custom-video-speed-menu">
                    {[0.5, 1, 1.5, 2, 3, 5].map(rate => (
                      <button
                        key={rate}
                        className={`custom-video-speed-option ${rate === playbackRate ? 'active' : ''}`}
                        onClick={(e) => changeSpeed(rate, e)}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="custom-video-btn" onClick={(e) => toggleFullscreen(e)}>
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
