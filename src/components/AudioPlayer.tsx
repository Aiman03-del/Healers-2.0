import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX, 
  Maximize2, Minimize2, Heart, Plus, ListMusic, Music, X, ChevronDown, Sparkles,
  BookOpen, Music4, ArrowLeft
} from 'lucide-react';
import { useHealersStore } from '../store';
import { toast } from 'sonner';

// LRC format parses helper to extract timestamps on-the-fly dynamically
function parseLrcLyrics(lyricsStr: string): { start: number; end: number; text: string }[] {
  if (!lyricsStr) return [];
  const lines = lyricsStr.split('\n');
  const result: { start: number; end: number; text: string }[] = [];
  const timestampRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse all timestamps in this line
    let match;
    const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
    
    // Reset regex index
    timestampRegex.lastIndex = 0;
    while ((match = timestampRegex.exec(line)) !== null) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3], 10) / (match[3].length === 2 ? 100 : 1000) : 0;
      const start = mins * 60 + secs + ms;
      result.push({ start, end: 9999, text });
    }
  }

  // Sort and calculate end times
  result.sort((a, b) => a.start - b.start);
  for (let i = 0; i < result.length; i++) {
    if (i < result.length - 1) {
      result[i].end = result[i + 1].start;
    } else {
      result[i].end = result[i].start + 10; // last line stays active for 10s
    }
  }
  return result;
}

export const AudioPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    playedSeconds,
    totalSeconds,
    playbackQueue,
    isShuffle,
    isRepeat,
    showFullscreenPlayer,
    likedSongs,
    playlists,
    currentUser,
    playbackSyncRoomId,
    isPlaybackSyncEnabled,
    
    // Actions
    togglePlayPause,
    setVolume,
    seek,
    nextTrack,
    prevTrack,
    setShuffle,
    setRepeat,
    setShowFullscreenPlayer,
    toggleLikeSong,
    addSongToPlaylist,
    clearQueue,
    initAudioListeners,
    createPlaylist,
    setPlaybackSyncRoomId,
    setPlaybackSyncEnabled
  } = useHealersStore();

  const [localSeekValue, setLocalSeekValue] = useState<number | null>(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [savedVolume, setSavedVolume] = useState(volume);
  const [fullscreenShowQueue, setFullscreenShowQueue] = useState(false);
  const [activeTab, setActiveTab] = useState<'now-playing' | 'lyrics'>('now-playing');

  const [showPlayerPlaylistMenu, setShowPlayerPlaylistMenu] = useState(false);
  const [showPlayerPlaylistInline, setShowPlayerPlaylistInline] = useState(false);
  const [playerPlaylistName, setPlayerPlaylistName] = useState('');

  const [showFullscreenPlaylistMenu, setShowFullscreenPlaylistMenu] = useState(false);
  const [showFullscreenPlaylistInline, setShowFullscreenPlaylistInline] = useState(false);
  const [fullscreenPlaylistName, setFullscreenPlaylistName] = useState('');
  const queueRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Single initialization on load
    initAudioListeners();
  }, [initAudioListeners]);

  // Reset tab when modal closes
  useEffect(() => {
    if (!showFullscreenPlayer) {
      setActiveTab('now-playing');
    }
  }, [showFullscreenPlayer]);

  // Handle outside clicks to close Queue menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (queueRef.current && !queueRef.current.contains(event.target as Node)) {
        setShowQueueModal(false);
      }
    }
    if (showQueueModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQueueModal]);

  // Synchronized lyrics source: explicit compiled list or dynamic parsed LRC block
  const resolvedLyricsSynced = React.useMemo(() => {
    if (currentSong?.lyrics_synced && currentSong.lyrics_synced.length > 0) {
      return currentSong.lyrics_synced;
    }
    if (currentSong?.lyrics) {
      return parseLrcLyrics(currentSong.lyrics);
    }
    return [];
  }, [currentSong]);

  // Active synced lyric tracking index tracker (derived state, safe)
  const activeLyricIndex = resolvedLyricsSynced.length > 0
    ? resolvedLyricsSynced.findIndex(
        (line) => playedSeconds >= line.start && playedSeconds <= line.end
      )
    : -1;

  // Auto-scroll the live active lyric smoothly inside container
  useEffect(() => {
    if (activeTab === 'lyrics' && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeLyricIndex, activeTab]);

  if (!currentSong) return null; // No song active, hide player cleanly

  const isLiked = likedSongs.some(l => l.song_id === currentSong.id && l.user_id === currentUser?.id);

  // Time format MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetVal = parseFloat(e.target.value);
    setLocalSeekValue(targetVal);
  };

  const handleSeekEnd = () => {
    if (localSeekValue !== null) {
      seek(localSeekValue);
      setLocalSeekValue(null);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(savedVolume);
      setIsMuted(false);
    } else {
      setSavedVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Get active artist details
  const artists = useHealersStore.getState().artists;
  const artistName = artists.find(a => a.id === currentSong.artist_id)?.name || 'Healing Artist';

  const progress = totalSeconds > 0 ? (playedSeconds / totalSeconds) * 100 : 0;
  const displayPlayedSeconds = localSeekValue !== null ? localSeekValue : playedSeconds;

  return (
    <>
      {/* 1. PERSISTENT BOTTOM BAR PLAYER */}
      <div 
        id="persistent-bottom-bar-audio-player"
        onClick={() => setShowFullscreenPlayer(true)}
        className="fixed bottom-14 md:bottom-0 left-0 right-0 h-20 md:h-22 bg-brand-surface/95 backdrop-blur-xl border-t border-gray-900/80 px-4 md:px-8 py-2 md:py-3.5 flex items-center justify-between z-40 select-none shadow-2xl animate-in slide-in-from-bottom active:bg-brand-surface/98 cursor-pointer group"
      >
        {/* Dynamic active progress bar line on top for a sleek modern overview */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gray-950/40">
          <div 
            className="h-full bg-brand-primary transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Left Side: Song info & cover */}
        <div className="flex items-center gap-3 w-full md:w-1/3 min-w-0">
          <div className="relative shrink-0">
            <img 
              src={currentSong.cover_image} 
              alt={currentSong.title} 
              referrerPolicy="no-referrer"
              className="w-11 h-11 md:w-13 md:h-13 rounded-full object-cover shadow-lg border border-gray-800/80" 
            />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          
          <div className="min-w-0 flex-1">
            <h4 className="text-xs md:text-sm font-bold text-gray-100 truncate group-hover:text-brand-primary transition-colors">
              {currentSong.title}
            </h4>
            <p className="text-[10px] md:text-xs text-brand-secondary md:text-gray-400 truncate mt-0.5">{artistName}</p>
          </div>

          <button 
            id="bottom-player-like-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleLikeSong(currentSong.id);
            }}
            className={`cursor-pointer hidden md:flex hover:scale-110 active:scale-95 transition-all ml-2 text-gray-400 ${isLiked ? 'text-brand-accent' : 'hover:text-white'}`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          <div className="relative shrink-0 hidden md:block">
            <button 
               id="bottom-player-add-to-pl-btn"
               onClick={(e) => {
                 e.stopPropagation();
                 setShowPlayerPlaylistMenu(!showPlayerPlaylistMenu);
               }}
               className={`cursor-pointer hover:scale-110 active:scale-95 transition-all text-gray-400 hover:text-white p-1 ml-1.5 rounded-full hover:bg-gray-800 ${showPlayerPlaylistMenu ? 'text-brand-secondary' : ''}`}
               title="Add current track to playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
            {showPlayerPlaylistMenu && (
              <div className="absolute bottom-11 left-0 w-52 bg-brand-surface border border-gray-850 rounded-xl shadow-2xl p-1 z-50 text-xs text-gray-200">
                <div className="px-3 py-1.5 text-[9px] uppercase tracking-wider text-gray-500 font-bold border-b border-gray-850">
                  Quick Save to Playlist
                </div>
                <div className="max-h-36 overflow-y-auto py-1">
                  {playlists.map(pl => (
                    <button 
                      key={pl.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        addSongToPlaylist(pl.id, currentSong.id);
                        toast.success(`Track added to "${pl.title}"`);
                        setShowPlayerPlaylistMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-brand-card rounded-lg truncate flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="w-1.5 h-1.5 bg-brand-primary rounded-full"></span>
                      {pl.title}
                    </button>
                  ))}
                  {playlists.length === 0 && (
                    <p className="text-[10px] text-gray-550 px-3 py-1.5 italic">No playlists constructed yet.</p>
                  )}
                </div>
                <div className="border-t border-gray-855 p-1">
                  {!showPlayerPlaylistInline ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowPlayerPlaylistInline(true); }}
                      className="w-full text-left px-2 py-1.5 hover:bg-brand-card rounded text-[10px] text-brand-secondary flex items-center gap-1.5 cursor-pointer font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Playlist
                    </button>
                  ) : (
                    <div className="space-y-1.5 p-1.5" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text"
                        placeholder="Playlist name..."
                        value={playerPlaylistName}
                        onChange={(e) => setPlayerPlaylistName(e.target.value)}
                        className="w-full bg-brand-bg px-2 py-1 rounded text-[10px] text-white border border-gray-800 placeholder-gray-600 focus:outline-none focus:border-brand-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && playerPlaylistName.trim()) {
                            e.stopPropagation();
                            const plId = createPlaylist(playerPlaylistName.trim(), 'Personal curation', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400', true, false);
                            addSongToPlaylist(plId, currentSong.id);
                            toast.success(`Created "${playerPlaylistName}" & saved!`);
                            setPlayerPlaylistName('');
                            setShowPlayerPlaylistInline(false);
                            setShowPlayerPlaylistMenu(false);
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!playerPlaylistName.trim()) return;
                            const plId = createPlaylist(playerPlaylistName.trim(), 'Personal curation', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400', true, false);
                            addSongToPlaylist(plId, currentSong.id);
                            toast.success(`Created "${playerPlaylistName}" & saved!`);
                            setPlayerPlaylistName('');
                            setShowPlayerPlaylistInline(false);
                            setShowPlayerPlaylistMenu(false);
                          }}
                          className="flex-1 bg-brand-primary hover:bg-brand-primary/80 px-1 py-0.5 rounded text-[9px] text-white font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowPlayerPlaylistInline(false); }}
                          className="px-1 py-0.5 rounded text-[9px] bg-gray-850 text-gray-400 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Playback Controls & Progress Slider (Desktop Only) */}
        <div className="hidden md:flex flex-col items-center w-5/12 max-w-lg">
          {/* Top part: buttons */}
          <div className="flex items-center gap-6 mb-2">
            <button 
              id="bottom-player-shuffle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShuffle(!isShuffle);
              }} 
              className={`p-1 transition-colors relative cursor-pointer ${isShuffle ? 'text-brand-secondary' : 'text-gray-400 hover:text-white'}`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
              {isShuffle && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-secondary rounded-full"></span>}
            </button>

            <button 
              id="bottom-player-prev-btn"
              onClick={(e) => {
                e.stopPropagation();
                prevTrack();
              }} 
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Previous Song"
            >
              <SkipBack className="w-4.5 h-4.5 fill-current" />
            </button>

            <button 
              id="bottom-player-play-pause-btn"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }} 
              className="p-2.5 bg-brand-primary text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-primary/20 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button 
              id="bottom-player-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                nextTrack();
              }} 
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Next Song"
            >
              <SkipForward className="w-4.5 h-4.5 fill-current" />
            </button>

            <button 
              id="bottom-player-repeat-btn"
              onClick={(e) => {
                e.stopPropagation();
                const Cycle: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
                const NextIdx = (Cycle.indexOf(isRepeat) + 1) % Cycle.length;
                setRepeat(Cycle[NextIdx]);
              }} 
              className={`p-1 transition-colors relative cursor-pointer ${isRepeat !== 'none' ? 'text-brand-primary' : 'text-gray-400 hover:text-white'}`}
              title={`Repeat: ${isRepeat}`}
            >
              <Repeat className="w-4 h-4" />
              {isRepeat !== 'none' && (
                <span className="absolute -top-0.5 -right-0.5 bg-brand-primary text-[8px] font-bold w-3 h-3 rounded-full flex items-center justify-center text-white scale-80">
                  {isRepeat === 'one' ? '1' : 'A'}
                </span>
              )}
            </button>
          </div>

          {/* Bottom part: seek bar */}
          <div className="flex items-center gap-3 w-full text-[10px] md:text-xs text-gray-400 font-mono">
            <span>{formatTime(displayPlayedSeconds)}</span>
            <div className="relative flex-1 group">
              <input 
                id="bottom-player-prog-input"
                type="range"
                min="0"
                max={totalSeconds || 100}
                value={displayPlayedSeconds}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-primary h-1 bg-gradient-to-r"
                style={{
                  background: `linear-gradient(to right, #7C3AED 0%, #7C3AED ${progress}%, #1E1E2F ${progress}%, #1E1E2F 100%)`
                }}
              />
            </div>
            <span>{formatTime(totalSeconds)}</span>
          </div>
        </div>

        {/* Right Side: Utilities & Quick Controls */}
        <div className="flex items-center justify-end gap-2 md:gap-3.5 shrink-0">
          
          {/* Mobile-only Play/Pause and Next button */}
          <div className="flex items-center gap-2.5 md:hidden">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="p-2 bg-brand-primary text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-primary/25 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                nextTrack();
              }}
              className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Next Song"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Desktop Queue drawer */}
          <div className="hidden md:block relative" ref={queueRef}>
            <button 
              id="bottom-player-queue-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowQueueModal(!showQueueModal);
              }}
              className={`p-2 rounded-full hover:bg-gray-800/40 hover:text-white transition-all cursor-pointer ${showQueueModal ? 'text-brand-secondary bg-gray-800/50' : ''}`}
              title="Up Next Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {showQueueModal && (
              <div 
                id="bottom-player-queue-popover"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-14 w-80 bg-brand-surface border border-gray-800/90 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 flex flex-col max-h-96"
              >
                <div className="flex items-center justify-between pb-3.5 border-b border-gray-800 mb-2">
                  <h5 className="font-bold text-sm text-gray-200">Playback Queue ({playbackQueue.length} Tracks)</h5>
                  <button 
                    onClick={clearQueue}
                    className="text-[10px] text-gray-500 hover:text-brand-accent font-semibold tracking-wider font-mono uppercase cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                
                <div className="overflow-y-auto space-y-1 pr-1">
                  {playbackQueue.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-500">Queue is empty</div>
                  ) : (
                    playbackQueue.map((s, idx) => {
                      const isActive = s.id === currentSong.id;
                      const sArtist = artists.find(a => a.id === s.artist_id)?.name || 'Artist';
                      return (
                        <div 
                          key={`${s.id}-${idx}`}
                          onClick={() => useHealersStore.getState().playTrack(s)}
                          className={`flex items-center gap-2.5 p-1.5 rounded-md text-left cursor-pointer transition-colors ${
                            isActive ? 'bg-brand-primary/10 border-l-2 border-brand-primary' : 'hover:bg-brand-card/40'
                          }`}
                        >
                          <img src={s.cover_image} alt={s.title} className="w-8 h-8 rounded object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold truncate ${isActive ? 'text-brand-primary' : 'text-gray-200'}`}>
                              {s.title}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">{sArtist}</p>
                          </div>
                          {isActive && <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse"></span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Volume control */}
          <div className="hidden md:flex items-center gap-2 group/volume relative">
            <button 
              id="bottom-player-volume-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }} 
              className="p-1.5 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input 
              id="bottom-player-volume-input"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const Val = parseFloat(e.target.value);
                setVolume(Val);
                if (Val > 0) setIsMuted(false);
              }}
              className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
            />
          </div>

          {/* Always Visible Fullscreen toggle */}
          <button 
            id="bottom-player-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullscreenPlayer(true);
            }}
            className="p-2 rounded-full hover:bg-gray-800/60 hover:text-white transition-all text-gray-400 cursor-pointer"
            title="Fullscreen Player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. FULLSCREEN IMMERSIVE MEDIA PLAYER & LYRICS PANEL */}
      {showFullscreenPlayer && (
        <div 
          id="fullscreen-audio-player-modal"
          className="fixed inset-0 bg-brand-bg z-50 overflow-y-auto overflow-x-hidden block select-none h-screen transition-all duration-500 animate-in fade-in zoom-in-95"
        >
          {/* Blurred Background Art */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
            <div className="absolute inset-0 opacity-20 filter blur-3xl scale-125">
              <img 
                src={currentSong.cover_image} 
                alt={currentSong.title} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-brand-bg"></div>
            </div>
          </div>

          {/* Core Layout Container */}
          <div className="relative z-10 w-full min-h-screen px-4 md:px-12 py-6 flex flex-col justify-between max-w-7xl mx-auto text-gray-100">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between border-b border-gray-900/60 pb-4">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2 mr-1">
                  <Sparkles className="w-4 h-4 text-brand-primary animate-pulse" />
                  <span className="font-display font-medium text-[10px] sm:text-xs tracking-widest text-gray-400 uppercase">Now Healing</span>
                </div>
                
                {/* Tabs switcher next to now playing */}
                <div className="flex items-center gap-1 bg-brand-surface/60 border border-gray-800/80 p-0.5 rounded-lg select-none">
                  <button
                    onClick={() => setActiveTab('now-playing')}
                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'now-playing' 
                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Player
                  </button>
                  <button
                    onClick={() => setActiveTab('lyrics')}
                    className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 ${
                      activeTab === 'lyrics' 
                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Lyrics</span>
                  </button>
                </div>
              </div>
              <button 
                id="fullscreen-close-btn"
                onClick={() => {
                  setShowFullscreenPlayer(false);
                  setFullscreenShowQueue(false);
                  setActiveTab('now-playing');
                }}
                className="p-2.5 rounded-full bg-brand-surface border border-gray-800/80 hover:border-gray-700 hover:text-white transition-all shadow-xl hover:rotate-90 duration-300 cursor-pointer"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-header real-time sync control bar (Highly responsive, beautiful on all screen sizes) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 bg-brand-surface/40 border border-gray-900/60 px-4 py-3 rounded-2xl select-none text-xs backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlaybackSyncEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaybackSyncEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="font-display font-medium text-gray-300">
                  {isPlaybackSyncEnabled ? 'Playback synchronization active' : 'Playback synchronization suspended'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-gray-500 text-[10px] uppercase font-mono tracking-wider">Sync Room:</span>
                <span className="text-brand-secondary font-mono bg-brand-secondary/10 px-2 py-0.5 rounded-lg border border-brand-secondary/20">{playbackSyncRoomId}</span>
                <button 
                  onClick={() => {
                    const newRoom = prompt('Enter a shared Room ID to sync playback with friends:', playbackSyncRoomId);
                    if (newRoom && newRoom.trim()) {
                      setPlaybackSyncRoomId(newRoom.trim());
                      toast.success(`Connected to room: "${newRoom.trim()}"`);
                    }
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold text-white bg-brand-primary hover:bg-brand-primary/90 transition-all rounded-md shadow-md cursor-pointer"
                >
                  Join Room
                </button>
                <button 
                  onClick={() => {
                    setPlaybackSyncEnabled(!isPlaybackSyncEnabled);
                    toast.success(isPlaybackSyncEnabled ? 'Real-time synchronization paused' : 'Real-time synchronization resumed');
                  }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer ${
                    isPlaybackSyncEnabled 
                      ? 'border-red-900/40 text-red-400 bg-red-950/20 hover:bg-red-950/30' 
                      : 'border-emerald-950/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/30'
                  }`}
                >
                  {isPlaybackSyncEnabled ? 'Disable Sync' : 'Enable Sync'}
                </button>
              </div>
            </div>

            {/* Main Interactive Container: Toggles between active views */}
            {activeTab === 'lyrics' ? (
              /* Premium Synced Lyrics Visualizer */
              <div className="flex flex-col items-center justify-center my-auto py-4 lg:py-6 animate-in fade-in duration-500 w-full overflow-hidden">
                <div className="flex-1 w-full flex flex-col items-center justify-center p-2 sm:p-4">
                  <div 
                    ref={lyricsContainerRef}
                    className="w-full max-w-xl h-[45vh] sm:h-[55vh] overflow-y-auto px-4 py-8 space-y-6 scroll-smooth select-none text-center"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {resolvedLyricsSynced && resolvedLyricsSynced.length > 0 ? (
                      resolvedLyricsSynced.map((line, idx) => {
                        const isActive = idx === activeLyricIndex;
                        const isPast = idx < activeLyricIndex;
                        return (
                          <p
                            key={idx}
                            data-active={isActive ? "true" : "false"}
                            onClick={() => seek(line.start)}
                            className={`text-sm sm:text-base md:text-lg font-display font-medium px-4 py-1.5 rounded-xl transition-all duration-300 transform cursor-pointer origin-center hover:scale-105 active:scale-95 hover:text-white ${
                              isActive 
                                ? 'text-brand-primary text-lg sm:text-xl md:text-2xl font-bold opacity-100 scale-105 filter drop-shadow-[0_0_12px_rgba(124,58,237,0.3)] animate-pulse' 
                                : isPast 
                                  ? 'text-gray-400 font-medium opacity-75'
                                  : 'text-gray-600 font-medium opacity-40'
                            }`}
                          >
                            {line.text}
                          </p>
                        );
                      })
                    ) : currentSong.lyrics ? (
                      currentSong.lyrics.split('\n').map((line, idx) => (
                        <p 
                          key={idx} 
                          className="text-xs sm:text-sm md:text-base text-gray-300 font-display font-medium px-4 opacity-80 leading-relaxed"
                        >
                          {line.trim() || <span className="block h-3"></span>}
                        </p>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-gray-500 py-12">
                        <Music4 className="w-8 h-8 text-gray-700 animate-pulse" />
                        <span className="text-xs font-mono uppercase tracking-wider">No lyrics available for this track</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Regular Player artwork & Queue Grid Layout */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-14 my-auto items-center py-4 lg:py-6 w-full">
                {/* Left Column: Visual Artwork & Info */}
                <div className={`flex flex-col items-center justify-center text-center ${fullscreenShowQueue ? 'hidden lg:flex' : 'flex'} min-w-0 w-full`}>
                  <div className="relative group shadow-2xl shadow-black/80 ring-8 ring-brand-card/10 rounded-full w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 mb-4 md:mb-6 flex-shrink-0 animate-in zoom-in-95 duration-700 overflow-hidden">
                    {/* Outer vinyl grooves */}
                    <div className="absolute inset-0 rounded-full border border-white/5 bg-black/40 pointer-events-none z-10"></div>
                    
                    {/* Vinyl Image - Static as requested */}
                    <img 
                      src={currentSong.cover_image} 
                      alt={currentSong.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-full shadow-2xl" 
                    />

                    {/* Shimmer light reflection effect on playing vinyl */}
                    {isPlaying && (
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent pointer-events-none animate-pulse z-10"></div>
                    )}

                    {/* CD vinyl physical spindle hole in the exact center */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-bg border-4 border-brand-surface/90 shadow-2xl flex items-center justify-center">
                        <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-black border border-gray-800/80"></div>
                      </div>
                    </div>
                  </div>

                  <div className="max-w-md w-full px-2 min-w-0">
                    <h2 className="text-lg md:text-2xl font-display font-medium tracking-tight text-white truncate px-1">
                      {currentSong.title}
                    </h2>
                    <p className="text-xs md:text-sm text-brand-secondary font-medium mt-1 truncate">
                      {artistName}
                    </p>

                    {/* Songwriting attributes (Lyricist/Composer) */}
                    {(currentSong.lyricist || currentSong.composer) && (
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-2 space-y-0.5 max-w-sm mx-auto font-sans bg-brand-card/30 p-2 rounded-xl border border-gray-900/40 leading-relaxed text-left">
                        {currentSong.lyricist && (
                          <div className="flex justify-between gap-2 px-1">
                            <span className="text-gray-500 font-medium font-sans">Lyricist / Writer:</span>
                            <span className="text-gray-300 font-bold text-right">{currentSong.lyricist}</span>
                          </div>
                        )}
                        {currentSong.composer && (
                          <div className="flex justify-between gap-2 px-1">
                            <span className="text-gray-500 font-medium font-sans">Composer / Tune:</span>
                            <span className="text-gray-300 font-bold text-right">{currentSong.composer}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Calming AI description outline as requested */}
                    {currentSong.description && (
                      <p className="text-[11px] text-gray-400 italic mt-3 line-clamp-2 max-w-sm mx-auto leading-relaxed border-t border-gray-900/30 pt-2 px-2">
                        "{currentSong.description}"
                      </p>
                    )}
                    
                    <div className="flex items-center justify-center gap-1.5 mt-3.5 text-[10px] text-gray-400 font-mono tracking-wide uppercase bg-brand-surface/40 px-3 py-1 rounded-full border border-gray-900 w-fit mx-auto">
                      <span>{currentSong.genre}</span>
                      <span className="text-gray-700 font-extrabold">•</span>
                      <span>{currentSong.language}</span>
                    </div>
                  </div>
                </div>

              {/* Right Column: Playback Queue */}
              <div className={`flex flex-col h-72 sm:h-96 lg:h-112 bg-brand-surface/40 backdrop-blur-md border border-gray-900 rounded-2xl p-4 md:p-6 shadow-2xl relative overflow-hidden animate-in slide-in-from-right duration-500 ${!fullscreenShowQueue ? 'hidden lg:flex' : 'flex'}`}>
                <div className="flex items-center justify-between border-b border-gray-900 mb-4 pb-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setFullscreenShowQueue(false)}
                      className="lg:hidden p-1.5 -ml-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white mr-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <ListMusic className="w-4 h-4 text-brand-primary" />
                    <span className="font-display font-semibold text-xs uppercase tracking-wider text-gray-200">
                      Up Next ({playbackQueue.length})
                    </span>
                  </div>
                  {playbackQueue.length > 0 && (
                    <button 
                      onClick={clearQueue}
                      className="text-[10px] text-gray-500 hover:text-brand-accent font-semibold tracking-wider font-mono uppercase cursor-pointer"
                    >
                      Clear Queue
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1 pr-1.5 scroll-smooth">
                  <div className="space-y-1.5">
                    {playbackQueue.length === 0 ? (
                      <div className="py-24 flex flex-col items-center justify-center gap-2 text-center text-xs text-gray-500 font-sans">
                        <Music className="w-8 h-8 text-gray-700 animate-pulse" />
                        <span>Queue is empty</span>
                      </div>
                    ) : (
                      playbackQueue.map((s, idx) => {
                        const isActive = s.id === currentSong.id;
                        const sArtist = artists.find(a => a.id === s.artist_id)?.name || 'Artist';
                        return (
                          <div 
                            key={`${s.id}-${idx}`}
                            onClick={() => useHealersStore.getState().playTrack(s)}
                            className={`flex items-center gap-3.5 p-2 rounded-xl text-left cursor-pointer transition-colors ${
                              isActive ? 'bg-brand-primary/10 border-l-2 border-brand-primary' : 'hover:bg-brand-card/30'
                            }`}
                          >
                            <img src={s.cover_image} alt={s.title} className="w-10 h-10 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-semibold truncate ${isActive ? 'text-brand-primary' : 'text-gray-205'}`}>
                                {s.title}
                              </p>
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">{sArtist}</p>
                            </div>
                            {isActive ? (
                              <span className="text-brand-primary font-mono text-[10px] font-bold tracking-wider animate-pulse">
                                Now Playing
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-600 font-mono">#{idx + 1}</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* Bottom: Playback timeline and triggers */}
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-3 md:gap-4 py-2 md:py-4 animate-in slide-in-from-bottom duration-500">
              {/* Seek bar */}
              <div className="flex items-center gap-3 text-xs font-mono text-gray-450 px-2 select-none">
                <span className="w-10 text-right text-gray-400">{formatTime(displayPlayedSeconds)}</span>
                <div className="flex-1 relative py-2">
                  <input 
                    id="fullscreen-seek-input"
                    type="range"
                    min="0"
                    max={totalSeconds || 100}
                    value={displayPlayedSeconds}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekEnd}
                    onTouchEnd={handleSeekEnd}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                    style={{
                      background: `linear-gradient(to right, #7C3AED 0%, #7C3AED ${progress}%, #1E1E2F ${progress}%, #1E1E2F 100%)`
                    }}
                  />
                </div>
                <span className="w-10 text-left text-gray-400">{formatTime(totalSeconds)}</span>
              </div>

              {/* Large controllers */}
              <div className="flex items-center justify-between px-2 sm:px-10">
                <button 
                  id="fullscreen-shuffle-btn"
                  onClick={() => setShuffle(!isShuffle)} 
                  className={`p-2 rounded-full transition-colors cursor-pointer ${isShuffle ? 'text-brand-secondary bg-brand-secondary/10' : 'text-gray-450 hover:text-white'}`}
                >
                  <Shuffle className="w-4.5 h-4.5 md:w-5 md:h-5" />
                </button>

                <div className="flex items-center gap-4 sm:gap-7">
                  <button 
                    id="fullscreen-prev-btn"
                    onClick={prevTrack} 
                    className="p-2 text-gray-450 hover:text-white transition-all hover:scale-110 active:scale-90 cursor-pointer"
                  >
                    <SkipBack className="w-5.5 h-5.5 md:w-7 md:h-7 fill-current" />
                  </button>

                  <button 
                    id="fullscreen-play-pause-btn"
                    onClick={togglePlayPause} 
                    className="p-3.5 md:p-5 bg-brand-primary text-white rounded-full hover:scale-105 active:scale-90 transition-all shadow-xl shadow-brand-primary/30 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5.5 h-5.5 md:w-7 md:h-7" /> : <Play className="w-5.5 h-5.5 md:w-7 md:h-7 fill-current" />}
                  </button>

                  <button 
                    id="fullscreen-next-btn"
                    onClick={nextTrack} 
                    className="p-2 text-gray-450 hover:text-white transition-all hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    <SkipForward className="w-5.5 h-5.5 md:w-7 md:h-7 fill-current" />
                  </button>
                </div>

                <button 
                  id="fullscreen-repeat-btn"
                  onClick={() => {
                    const Cycle: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
                    const NextIdx = (Cycle.indexOf(isRepeat) + 1) % Cycle.length;
                    setRepeat(Cycle[NextIdx]);
                  }} 
                  className={`p-2 rounded-full transition-colors cursor-pointer ${isRepeat !== 'none' ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-450 hover:text-white'}`}
                >
                  <Repeat className="w-4.5 h-4.5 md:w-5 md:h-5" />
                </button>
              </div>

              {/* Helper actions & Volume slider */}
              <div className="flex items-center justify-between text-xs text-gray-400 px-4 md:px-8 pt-1.5 leading-none select-none">
                {/* Volume bar (Desktop only) */}
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="font-mono text-gray-500">Vol:</span>
                  <input 
                    id="fullscreen-volume-input"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 md:w-24 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
                  />
                </div>

                {/* Left placeholder to center items nicely on Mobile */}
                <div className="md:hidden"></div>
                
                {/* Secondary controllers */}
                <div className="flex items-center gap-3">
                  {/* Toggle queue view */}
                  <button 
                    onClick={() => setFullscreenShowQueue(!fullscreenShowQueue)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer border ${
                      fullscreenShowQueue 
                        ? 'text-brand-primary bg-brand-primary/10 border-brand-primary/30' 
                        : 'text-gray-300 bg-brand-surface border-gray-800/80 hover:bg-brand-card/40'
                    }`}
                    title={fullscreenShowQueue ? "Show Artwork" : "View Queue"}
                  >
                    <ListMusic className="w-5 h-5" />
                  </button>

                   <button 
                    id="fullscreen-toggle-like-btn"
                    onClick={() => toggleLikeSong(currentSong.id)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors cursor-pointer border ${
                      isLiked 
                        ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20' 
                        : 'text-gray-300 bg-brand-surface border-gray-805 hover:bg-brand-card/40'
                    }`}
                    title={isLiked ? 'Liked' : 'Like'}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                  </button>

                  <div className="relative">
                    <button 
                      onClick={() => setShowFullscreenPlaylistMenu(!showFullscreenPlaylistMenu)}
                      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer border ${
                        showFullscreenPlaylistMenu 
                          ? 'text-brand-secondary bg-brand-secondary/10 border-brand-secondary/35' 
                          : 'text-gray-300 bg-brand-surface border-gray-805 hover:bg-brand-card/40'
                      }`}
                      title="Add to Playlist"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    {showFullscreenPlaylistMenu && (
                      <div className="absolute bottom-12 right-0 w-52 bg-brand-surface border border-gray-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs text-gray-200 text-left animate-in slide-in-from-bottom-2 duration-200">
                        <div className="px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-gray-400 font-bold border-b border-gray-850">
                          Add track to playlist
                        </div>
                        <div className="max-h-40 overflow-y-auto py-1">
                          {playlists.map(pl => (
                            <button 
                              key={pl.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                addSongToPlaylist(pl.id, currentSong.id);
                                toast.success(`Track added to "${pl.title}"`);
                                setShowFullscreenPlaylistMenu(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-brand-card rounded-lg truncate flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="w-1.5 h-1.5 bg-brand-primary rounded-full"></span>
                              {pl.title}
                            </button>
                          ))}
                          {playlists.length === 0 && (
                            <p className="text-[10px] text-gray-550 px-3 py-1.5 italic">No playlists constructed yet.</p>
                          )}
                        </div>
                        <div className="border-t border-gray-850 p-1">
                          {!showFullscreenPlaylistInline ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowFullscreenPlaylistInline(true); }}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-brand-card rounded-lg text-[10px] text-brand-secondary flex items-center gap-1.5 cursor-pointer font-bold"
                            >
                              <Plus className="w-4 h-4" /> Create Playlist
                            </button>
                          ) : (
                            <div className="space-y-1.5 p-1.5" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="text"
                                placeholder="Playlist name..."
                                value={fullscreenPlaylistName}
                                onChange={(e) => setFullscreenPlaylistName(e.target.value)}
                                className="w-full bg-brand-bg px-2 py-1 rounded text-[10px] text-white border border-gray-800 placeholder-gray-600 focus:outline-none focus:border-brand-primary"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && fullscreenPlaylistName.trim()) {
                                    e.stopPropagation();
                                    const plId = createPlaylist(fullscreenPlaylistName.trim(), 'Personal curation', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400', true, false);
                                    addSongToPlaylist(plId, currentSong.id);
                                    toast.success(`Created "${fullscreenPlaylistName}" & saved!`);
                                    setFullscreenPlaylistName('');
                                    setShowFullscreenPlaylistInline(false);
                                    setShowFullscreenPlaylistMenu(false);
                                  }
                                }}
                              />
                              <div className="flex gap-1.5">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!fullscreenPlaylistName.trim()) return;
                                    const plId = createPlaylist(fullscreenPlaylistName.trim(), 'Personal curation', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400', true, false);
                                    addSongToPlaylist(plId, currentSong.id);
                                    toast.success(`Created "${fullscreenPlaylistName}" & saved!`);
                                    setFullscreenPlaylistName('');
                                    setShowFullscreenPlaylistInline(false);
                                    setShowFullscreenPlaylistMenu(false);
                                  }}
                                  className="flex-1 bg-brand-primary hover:bg-brand-primary/80 px-2 py-1 rounded text-[9px] text-white font-bold cursor-pointer"
                                >
                                  Save list
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setShowFullscreenPlaylistInline(false); }}
                                  className="px-2 py-1 rounded text-[9px] bg-gray-850 text-gray-400 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
