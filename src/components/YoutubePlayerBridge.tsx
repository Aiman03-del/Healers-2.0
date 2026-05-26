import React, { useEffect, useRef } from 'react';
import { useHealersStore } from '../store';

// Helper to extract 11-char YouTube Video ID
export function getYoutubeId(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export const YoutubePlayerBridge: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    youtubeSeekSignal,
    nextTrack
  } = useHealersStore();

  const playerRef = useRef<any>(null);
  const iframeContainerId = "hidden-background-youtube-player";
  const progressIntervalRef = useRef<any>(null);

  // Load YouTube Player API once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Set up global callback
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      initPlayer();
    };

    // If already loaded in window
    if (window.YT && window.YT.Player) {
      initPlayer();
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying YT background player:", e);
        }
      }
    };
  }, []);

  const initPlayer = () => {
    if (playerRef.current) return;
    try {
      playerRef.current = new window.YT.Player(iframeContainerId, {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3
        },
        events: {
          onReady: (event: any) => {
            // Set initial volume
            event.target.setVolume(volume * 100);
            syncCurrentVideoState();
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              nextTrack();
            }
          },
          onError: (e: any) => {
            console.error("YouTube background player playback error:", e.data);
            // On severe error, auto advance to next song in list
            setTimeout(() => {
              nextTrack();
            }, 1000);
          }
        }
      });
    } catch (err) {
      console.error("Failed to construct YouTube Iframe Player:", err);
    }
  };

  // Synchronize playing & stopping state of the video
  const syncCurrentVideoState = () => {
    const player = playerRef.current;
    if (!player || typeof player.getPlayerState !== 'function') return;

    const videoId = getYoutubeId(currentSong?.youtube_url);

    if (!videoId) {
      // If active song is NOT a Youtube song, make sure YouTube player is paused and silent
      try {
        if (player.getPlayerState() === 1) { // 1 = YT.PlayerState.PLAYING
          player.pauseVideo();
        }
      } catch (err) {}
      return;
    }

    // Check if the correct video is loaded
    const currentVideoUrl = player.getVideoUrl ? player.getVideoUrl() : '';
    const isMatching = currentVideoUrl && currentVideoUrl.includes(videoId);

    if (!isMatching) {
      // Load the new video ID
      if (isPlaying) {
        player.loadVideoById({ videoId });
      } else {
        player.cueVideoById({ videoId });
      }
      player.setVolume(volume * 100);
    } else {
      // Video already matches, sync playback states
      const state = player.getPlayerState();
      if (isPlaying && state !== 1) { // not playing
        player.playVideo();
      } else if (!isPlaying && state === 1) { // playing
        player.pauseVideo();
      }
    }
  };

  // Monitor store state changes
  useEffect(() => {
    syncCurrentVideoState();
  }, [currentSong?.id, isPlaying]);

  // Monitor Volume changes
  useEffect(() => {
    const player = playerRef.current;
    if (player && typeof player.setVolume === 'function') {
      player.setVolume(volume * 100);
    }
  }, [volume]);

  // Monitor Seek Signal changes
  useEffect(() => {
    if (youtubeSeekSignal !== null && youtubeSeekSignal !== undefined) {
      const player = playerRef.current;
      if (player && typeof player.seekTo === 'function') {
        player.seekTo(youtubeSeekSignal, true);
        // Reset find signal in store
        useHealersStore.setState({ youtubeSeekSignal: null });
      }
    }
  }, [youtubeSeekSignal]);

  // Handle high fidelity polling interval to sync elapsed played seconds to standard UI sliders
  useEffect(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const videoId = getYoutubeId(currentSong?.youtube_url);
    if (!videoId) return;

    progressIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === 'function' && typeof player.getPlayerState === 'function') {
        const state = player.getPlayerState();
        if (state === 1) { // PLAYING
          const currentTime = player.getCurrentTime();
          const duration = player.getDuration();
          
          useHealersStore.setState({ 
            playedSeconds: currentTime,
            totalSeconds: duration || currentSong?.duration_seconds || 320
          });
        }
      }
    }, 450);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentSong?.id]);

  return (
    <div 
      style={{ position: 'fixed', width: '1px', height: '1px', bottom: '-10px', left: '-10px', overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} 
      id="youtube-player-host-wrapper"
    >
      <div id={iframeContainerId}></div>
    </div>
  );
};
