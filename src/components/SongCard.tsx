import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Heart, MoreVertical, Plus, User, Disc, Share2, Download, Trash, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Song } from '../types';
import { useHealersStore } from '../store';

interface SongCardProps {
  song: Song;
  variant?: 'grid' | 'list';
  index?: number;
  onSelectArtist?: (artistId: string) => void;
  onSelectAlbum?: (albumId: string) => void;
  playlistId?: string; // Optional context for playlist item deletion
}

export const SongCard: React.FC<SongCardProps> = ({ 
  song, 
  variant = 'grid', 
  index,
  onSelectArtist,
  onSelectAlbum,
  playlistId
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [downloaded, setDownloaded] = useState(false);

  const { 
    currentSong, 
    isPlaying, 
    playTrack, 
    toggleLikeSong, 
    likedSongs, 
    currentUser, 
    playlists, 
    addSongToPlaylist,
    removeSongFromPlaylist,
    addSongToQueue,
    createPlaylist,
    songs
  } = useHealersStore();

  const [showNewPlaylistInline, setShowNewPlaylistInline] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const isCurrent = currentSong?.id === song.id;
  const isLiked = likedSongs.some(l => l.song_id === song.id && l.user_id === currentUser?.id);

  // Sync offline download status
  useEffect(() => {
    const checkStatus = () => {
      import('../lib/offline').then(module => {
        setDownloaded(module.isSongDownloaded(song.id));
      });
    };
    checkStatus();
    window.addEventListener('healers-offline-sync', checkStatus);
    return () => window.removeEventListener('healers-offline-sync', checkStatus);
  }, [song.id]);

  // Close options menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOptions(false);
        setShowNewPlaylistInline(false);
        setNewPlaylistName('');
      }
    }
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOptions]);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Play with context of all songs or current queue
    playTrack(song, songs);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLikeSong(song.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(false);
    // Custom share link copies to clipboard
    const shareUrl = `${window.location.origin}/song/${song.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Serene share link copied to clipboard!', {
        description: `"${song.title}" link ready to spread cosmic calm.`
      });
    });
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(false);
    
    const module = await import('../lib/offline');
    if (downloaded) {
      await module.undownloadSong(song.id);
    } else {
      await module.downloadSong(song);
    }
  };

  const handleAddToPlaylist = (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    addSongToPlaylist(playlistId, song.id);
    setShowOptions(false);
  };

  const handleCreateNewPlaylistInline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!newPlaylistName.trim()) {
      toast.error('Playlist name cannot be empty');
      return;
    }
    const thumbs = [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=50',
      'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=50',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=50',
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=50'
    ];
    const cover = thumbs[Math.floor(Math.random() * thumbs.length)];
    const plId = createPlaylist(newPlaylistName.trim(), 'Custom generated listening experience', cover, true, false);
    addSongToPlaylist(plId, song.id);
    toast.success(`Created playlist "${newPlaylistName}" and added "${song.title}"!`);
    setShowNewPlaylistInline(false);
    setNewPlaylistName('');
    setShowOptions(false);
  };

  const handleRemoveFromPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlistId) {
      removeSongFromPlaylist(playlistId, song.id);
    }
    setShowOptions(false);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addSongToQueue(song);
    setShowOptions(false);
  };

  // Convert duration to standard MM:SS
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.round(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const artists = useHealersStore(state => state.artists);
  const artistName = artists.find(a => a.id === song.artist_id)?.name || 'Healing Artist';

  const renderMenuContent = (isMobileLayout: boolean = false) => {
    const itemClass = isMobileLayout
      ? "w-full text-left px-4 py-3.5 hover:bg-brand-card/50 rounded-xl flex items-center gap-3 cursor-pointer text-sm font-medium text-gray-200 transition-all active:scale-[0.98]"
      : "w-full text-left px-3 py-2 hover:bg-brand-card rounded-lg flex items-center gap-2 cursor-pointer text-gray-200 transition-colors";
      
    const playlistItemClass = isMobileLayout
      ? "w-full text-left px-5 py-3 hover:bg-brand-card/50 rounded-xl truncate flex items-center gap-2.5 cursor-pointer text-sm text-gray-300 transition-all active:scale-[0.98]"
      : "w-full text-left px-3.5 py-1.5 hover:bg-brand-card rounded-lg truncate flex items-center gap-1.5 cursor-pointer text-gray-300 transition-colors";

    return (
      <>
        <button 
          onClick={handleAddToQueue}
          className={itemClass}
        >
          <Plus className="w-4 h-4 text-brand-secondary" /> Add to Queue
        </button>
        <div className={`border-t border-gray-800/80 ${isMobileLayout ? 'my-2.5 py-2' : 'my-1 py-1'}`}>
          <div className="px-3.5 py-1 text-[10px] uppercase tracking-wider text-gray-400 font-bold font-mono">Add to Playlist</div>
          {playlists.map(pl => (
            <button 
              key={pl.id}
              onClick={(e) => handleAddToPlaylist(pl.id, e)}
              className={playlistItemClass}
            >
              <span className="w-1.5 h-1.5 bg-brand-primary rounded-full"></span>
              {pl.title}
            </button>
          ))}
          
          {!showNewPlaylistInline ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowNewPlaylistInline(true); }}
              className={`text-brand-secondary flex items-center gap-1.5 mt-0.5 cursor-pointer font-medium ${isMobileLayout ? 'w-full text-left px-5 py-3 hover:bg-brand-card/30 rounded-xl text-xs' : 'w-full text-left px-3.5 py-1.5 hover:bg-brand-card rounded-lg text-xs'}`}
            >
              <Plus className="w-3.5 h-3.5" /> New Playlist
            </button>
          ) : (
            <div className={`${isMobileLayout ? 'px-5 py-2.5 space-y-2' : 'px-3 py-1.5 space-y-1.5'} animate-in slide-in-from-top-1 duration-200`} onClick={(e) => e.stopPropagation()}>
              <input 
                type="text"
                placeholder="Playlist name..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className={`w-full bg-brand-bg px-2.5 py-1.5 rounded text-white border border-gray-850 placeholder-gray-600 focus:outline-none focus:border-brand-primary ${isMobileLayout ? 'text-sm' : 'text-xs'}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNewPlaylistInline(e as any);
                  }
                }}
              />
              <div className="flex gap-1.5">
                <button 
                  onClick={handleCreateNewPlaylistInline}
                  className={`flex-1 bg-brand-primary hover:bg-brand-primary/80 py-1 rounded text-white font-semibold cursor-pointer ${isMobileLayout ? 'text-xs py-1.5' : 'text-[10px]'}`}
                >
                  Create
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowNewPlaylistInline(false); setNewPlaylistName(''); }}
                  className={`rounded bg-gray-800 hover:bg-gray-700 text-gray-400 cursor-pointer ${isMobileLayout ? 'text-xs px-3 py-1.5' : 'text-[10px] px-2 py-0.5'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {playlistId && (
          <button 
            onClick={handleRemoveFromPlaylist}
            className={`hover:bg-brand-accent/10 text-brand-accent flex items-center gap-2 border-t border-gray-850 cursor-pointer transition-colors ${itemClass}`}
          >
            <Trash className="w-4 h-4" /> Remove from Playlist
          </button>
        )}
        <button 
          onClick={() => { setShowOptions(false); onSelectArtist?.(song.artist_id); }}
          className={itemClass}
        >
          <User className="w-4 h-4 text-gray-400" /> Go to Artist
        </button>
        {song.album_id && (
          <button 
            onClick={() => { setShowOptions(false); onSelectAlbum?.(song.album_id!); }}
            className={itemClass}
          >
            <Disc className="w-4 h-4 text-gray-400" /> View Album
          </button>
        )}
        <button 
          onClick={handleShare}
          className={itemClass}
        >
          <Share2 className="w-4 h-4 text-gray-400" /> Share Song
        </button>
        <button 
          onClick={handleDownload}
          className={itemClass}
        >
          <Download className={`w-4 h-4 ${downloaded ? 'text-brand-secondary' : 'text-gray-400'}`} /> {downloaded ? 'Purge Offline Audio' : 'Save Offline Cache'}
        </button>
      </>
    );
  };

  if (variant === 'list') {
    return (
      <div 
        id={`song-row-${song.id}`}
        className={`group flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
          isCurrent 
            ? 'bg-brand-primary/15 border-l-3 border-brand-primary' 
            : 'hover:bg-brand-card/55 border-l-3 border-transparent'
        }`}
        onClick={handlePlay}
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {index !== undefined && (
            <span className="w-5 text-sm font-mono text-gray-500 text-center group-hover:hidden">
              {index + 1}
            </span>
          )}
          
          <button 
            id={`play-row-btn-${song.id}`}
            onClick={handlePlay}
            className={`w-5 justify-center items-center ${index !== undefined ? 'hidden group-hover:flex' : 'flex'} text-brand-primary`}
          >
            {isCurrent && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <img 
            src={song.cover_image} 
            alt={song.title} 
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded object-cover shadow-sm" 
          />

          <div className="min-w-0 pr-2">
            <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-brand-primary' : 'text-gray-200'}`}>
              {song.title}
              {downloaded && (
                <span className="ml-1.5 inline-flex items-center rounded bg-brand-secondary/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-secondary border border-brand-secondary/25 uppercase font-mono tracking-wider animate-pulse" title="Downloaded Offline">
                  Offline
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400 truncate hover:underline" onClick={(e) => { e.stopPropagation(); onSelectArtist?.(song.artist_id); }}>
              {artistName}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-4 text-gray-400">
          <span className="hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full bg-brand-bg/60 text-gray-300">
            {song.genre}
          </span>
          <span className="text-xs font-mono">{formatDuration(song.duration_seconds)}</span>
          
          <button 
            id={`like-row-btn-${song.id}`}
            onClick={handleLike} 
            className={`cursor-pointer hover:scale-110 active:scale-95 transition-transform ${isLiked ? 'text-brand-accent' : 'hover:text-gray-200'}`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          {/* 3 dot menu */}
          <div className="relative" ref={dropdownRef}>
            <button 
              id={`opts-row-btn-${song.id}`}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className={`p-1 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer ${showOptions ? 'bg-gray-800/60 text-white' : 'hover:bg-gray-800/40'}`}
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <>
                {/* Desktop Absolute Dropdown */}
                <div id={`opts-dropdown-desk-${song.id}`} className="hidden sm:block absolute right-0 mt-2 w-52 bg-[#12121A] border border-gray-850/90 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-1 z-[75] text-sm text-gray-200 animate-in fade-in slide-in-from-top-1 text-left">
                  {renderMenuContent(false)}
                </div>

                {/* Mobile Slide-up Bottom Sheet */}
                <div id={`opts-bottom-sheet-mob-${song.id}`} className="sm:hidden fixed inset-0 z-[999]" onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}>
                  {/* Backdrop */}
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200" />
                  
                  {/* Drawer */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-[#0E0E14] border-t border-gray-800/80 rounded-t-3xl p-5 pb-9 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 flex flex-col text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Drag Handle */}
                    <div className="w-12 h-1 bg-gray-800 rounded-full mx-auto mb-5 shrink-0" />
                    
                    {/* Song Header */}
                    <div className="flex items-center gap-4 mb-5 border-b border-gray-900 pb-4 shrink-0">
                      <img 
                        src={song.cover_image} 
                        alt={song.title} 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover shadow-md" 
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate text-white">{song.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{artistName}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="space-y-1 pr-1">
                      {renderMenuContent(true)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      id={`song-grid-${song.id}`}
      className="group relative bg-[#18181F] hover:bg-[#28282E] border border-transparent hover:border-gray-800 p-4 rounded-xl transition-all duration-300 shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col justify-between cursor-pointer"
      onClick={handlePlay}
    >
      <div className="relative aspect-square w-full rounded-md overflow-hidden mb-4 shadow-lg select-none">
        <img 
          src={song.cover_image} 
          alt={song.title} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-104" 
        />
        
        {/* Hover slide up play and like button controls */}
        <div className="absolute bottom-3 right-3 opacity-0 translate-y-3.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10 flex items-center gap-2">
          <button 
            id={`like-grid-btn-${song.id}`}
            onClick={handleLike}
            className={`p-2.5 rounded-full bg-black/75 hover:bg-black/90 border border-gray-800 text-gray-300 hover:text-brand-primary hover:scale-105 active:scale-95 transition-all ${isLiked ? 'text-brand-primary' : ''}`}
            title={isLiked ? "Unlike composition" : "Like composition"}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
          
          <button 
            id={`play-grid-btn-${song.id}`}
            onClick={(e) => { e.stopPropagation(); handlePlay(e); }}
            className="w-12 h-12 rounded-full bg-brand-primary text-white shadow-xl flex items-center justify-center transform hover:scale-106 active:scale-95 transition-all text-center"
            title="Listen now"
          >
            {isCurrent && isPlaying ? <Pause className="w-5 h-5 fill-current text-white animate-pulse" /> : <Play className="w-5 h-5 fill-current text-white ml-0.5" />}
          </button>
        </div>
      </div>

      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-1.5">
          <h4 className={`font-semibold text-sm truncate flex-1 pr-1 ${isCurrent ? 'text-brand-primary' : 'text-gray-100'}`} title={song.title}>
            {song.title}
            {downloaded && (
              <span className="ml-1.5 inline-flex items-center rounded bg-brand-secondary/10 px-1 py-0.5 text-[8px] font-bold text-brand-secondary border border-brand-secondary/25 uppercase font-mono tracking-wider animate-pulse" title="Downloaded Offline">
                Offline
              </span>
            )}
          </h4>
          
          {/* Always visible and non-clipping 3-dot option selector (touch-screen and responsive friendly) */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button 
              id={`opts-grid-btn-${song.id}`}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
              className={`p-1 -mr-1 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer ${showOptions ? 'bg-gray-800/60 text-white' : 'hover:bg-gray-800/40'}`}
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showOptions && (
              <>
                {/* Desktop Absolute Dropdown */}
                <div id={`opts-dropdown-desk-${song.id}`} className="hidden sm:block absolute right-0 mt-2 w-52 bg-[#12121A] border border-gray-850/90 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-1 z-[75] text-sm text-gray-200 animate-in fade-in slide-in-from-top-1 text-left">
                  {renderMenuContent(false)}
                </div>

                {/* Mobile Slide-up Bottom Sheet */}
                <div id={`opts-bottom-sheet-mob-${song.id}`} className="sm:hidden fixed inset-0 z-[999]" onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}>
                  {/* Backdrop */}
                  <div className="absolute inset-0 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200" />
                  
                  {/* Drawer */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-[#0E0E14] border-t border-gray-800/80 rounded-t-3xl p-5 pb-9 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 flex flex-col text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Drag Handle */}
                    <div className="w-12 h-1 bg-gray-800 rounded-full mx-auto mb-5 shrink-0" />
                    
                    {/* Song Header */}
                    <div className="flex items-center gap-4 mb-5 border-b border-gray-900 pb-4 shrink-0">
                      <img 
                        src={song.cover_image} 
                        alt={song.title} 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover shadow-md" 
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate text-white">{song.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{artistName}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="space-y-1 pr-1">
                      {renderMenuContent(true)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mt-0.5">
          <p 
            onClick={(e) => { e.stopPropagation(); onSelectArtist?.(song.artist_id); }}
            className="text-gray-400 truncate hover:underline cursor-pointer max-w-[70%]"
          >
            {artistName}
          </p>
          <span className="text-gray-500 font-mono text-[10px]">{formatDuration(song.duration_seconds)}</span>
        </div>
      </div>
    </div>
  );
};
