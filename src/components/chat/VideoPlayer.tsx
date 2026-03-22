import React, { useRef, useState, useEffect, MouseEvent } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  previewMode?: boolean;
}

export function VideoPlayer({ src, className = '', style = {}, previewMode = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Formatting time (e.g., 01:23)
  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Use requestAnimationFrame for fluid progress bar updates
    let animationFrameId: number;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        setCurrentTime(video.currentTime);
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    const handlePause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animationFrameId);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animationFrameId);
    };

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      
      // If we exit fullscreen and were in preview mode, pause or mute it back according to spec 
      // (User wants it to auto-loop muted in preview mode)
      if (!isFull && previewMode && video) {
        video.muted = true;
        setIsMuted(true);
        video.play();
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Initial setup for preview mode
    if (previewMode && video) {
      video.muted = true;
      setIsMuted(true);
      video.loop = true;
      video.play().catch(e => console.log('Autoplay prevented:', e));
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, [previewMode]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleProgressClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const progressContainer = progressRef.current;
    const video = videoRef.current;
    if (!progressContainer || !video || !video.duration) return;

    const rect = progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * video.duration;
    setProgress(pos * 100);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          // Fallback if container fullscreen fails (e.g. mobile Safari)
          if ((video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen();
          }
        });
      } else if ((video as any).webkitEnterFullscreen) {
        // Mobile Safari / iOS fallback
        (video as any).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const changeSpeed = (rate: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    // Hide controls after 2.5s of inactivity if playing
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 2500);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowControls(false);
      setShowSpeedMenu(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`custom-video-container ${className} ${showControls || !isPlaying ? 'show-controls' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={isFullscreen ? { borderRadius: 0, width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' } : style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className={`custom-video-element ${previewMode && !isFullscreen ? 'preview-mode-video' : ''}`}
        preload="metadata"
        playsInline
        muted={previewMode && !isFullscreen ? true : isMuted}
        loop={previewMode && !isFullscreen}
        onClick={(e) => {
          e.stopPropagation();
          previewMode && !isFullscreen ? toggleFullscreen(e) : togglePlay();
        }}
      />
      
      {/* Big center play icon when paused and NOT in preview mode */}
      {!isPlaying && (!previewMode || isFullscreen) && (
        <div className="custom-video-center-play">
          <Play size={36} fill="white" />
        </div>
      )}



      {/* Controls overlay (Hide entirely in preview mode unless fullscreen) */}
      {(!previewMode || isFullscreen) && (
        <div className="custom-video-controls" onClick={e => e.stopPropagation()}>
        {/* Progress bar */}
        <div 
          className="custom-video-progress-container" 
          ref={progressRef}
          onClick={handleProgressClick}
        >
          <div className="custom-video-progress-bg">
            <div 
              className="custom-video-progress-fill" 
              style={{ width: `${progress}%` }}
            >
              <div className="custom-video-progress-thumb" />
            </div>
          </div>
        </div>

        {/* Lower controls bar */}
        <div className="custom-video-controls-bar">
          <div className="custom-video-controls-left">
            <button className="custom-video-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
            </button>
            
            <div className="custom-video-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            
            <button className="custom-video-btn" onClick={toggleMute}>
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          <div className="custom-video-controls-right">
            <div style={{ position: 'relative' }}>
              <button 
                className={`custom-video-btn custom-video-speed-btn ${playbackRate !== 1 ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSpeedMenu(!showSpeedMenu);
                }}
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
            <button className="custom-video-btn" onClick={toggleFullscreen}>
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
