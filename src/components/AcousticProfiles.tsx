import React, { useState } from 'react';
import { 
  CheckCircle, Users, Play, Heart, Calendar, Disc, Music, Plus, 
  Trash2, Share2, ToggleLeft, ToggleRight, ArrowUp, ArrowDown, Sparkles,
  Edit, X, Download
} from 'lucide-react';
import { useHealersStore } from '../store';
import { toast } from 'sonner';
import { Artist, Album, Song, Playlist } from '../types';
import { SongCard } from './SongCard';

// ==========================================
// 1. ARTIST PROFILE COMPONENT
// ==========================================
interface ArtistViewProps {
  artistId: string;
  onBack: () => void;
  onSelectAlbum: (albumId: string) => void;
}

export const ArtistProfileView: React.FC<ArtistViewProps> = ({ artistId, onBack, onSelectAlbum }) => {
  const { artists, albums, songs, followers, currentUser, toggleFollowArtist, playTrack, editArtist } = useHealersStore();

  const artist = artists.find(a => a.id === artistId);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editCover, setEditCover] = useState('');

  // Sync edit local states when artist changes
  React.useEffect(() => {
    if (artist) {
      setEditName(artist.name);
      setEditBio(artist.bio);
      setEditAvatar(artist.avatar_url);
      setEditCover(artist.cover_image);
      setIsEditingProfile(false);
    }
  }, [artistId, artist]);

  if (!artist) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="font-mono text-sm">Artist curation panel not found.</p>
        <button onClick={onBack} className="mt-4 text-xs font-bold text-brand-primary">Go Back</button>
      </div>
    );
  }

  const isFollowing = followers.some(f => f.follower_id === currentUser?.id && f.artist_id === artist.id);
  const artistSongs = songs.filter(s => s.artist_id === artist.id);
  const artistAlbums = albums.filter(a => a.artist_id === artist.id);

  const handlePlayPopular = () => {
    if (artistSongs.length > 0) {
      playTrack(artistSongs[0], artistSongs);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Artist name cannot be empty');
      return;
    }
    editArtist(artist.id, {
      name: editName.trim(),
      bio: editBio.trim(),
      avatar_url: editAvatar.trim(),
      cover_image: editCover.trim()
    });
    toast.success(`Artist "${editName.trim()}" profile updated successfully!`);
    setIsEditingProfile(false);
  };

  return (
    <div id={`artist-detail-${artistId}`} className="space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Back button */}
      <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer">
        ← Back to Browse
      </button>

      {/* Hero Header Banner */}
      <div className="relative h-60 md:h-80 rounded-2xl overflow-hidden border border-gray-950 shadow-2xl">
        <img 
          src={artist.cover_image} 
          alt={artist.name} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-black/40 to-transparent"></div>
        
        {/* Banner Details */}
        <div className="absolute bottom-6 left-6 md:left-8 flex flex-col md:flex-row items-center md:items-end gap-5">
          <img 
            src={artist.avatar_url} 
            alt={artist.name} 
            className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover border-4 border-brand-card/60 shadow-lg" 
          />
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h2 className="text-2xl md:text-5xl font-display font-bold text-white tracking-tight">{artist.name}</h2>
              {artist.verified && <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-brand-secondary fill-brand-bg0" title="Verified Curated Healer" />}
            </div>
            
            <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-mono text-gray-300 mt-2.5">
              <span className="flex items-center gap-1"><Users className="w-4.5 h-4.5 text-brand-secondary" /> {artist.follower_count.toLocaleString()} monthly fans</span>
            </div>
          </div>
        </div>
      </div>

      {/* Core Body Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 cols: Discography of Tracks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-900 pb-3">
            <h3 className="font-display font-bold text-lg text-white">Popular Compositions</h3>
            
            <div className="flex gap-2">
              <button 
                id={`artist-play-btn-${artist.id}`}
                onClick={handlePlayPopular}
                disabled={artistSongs.length === 0}
                className="px-4.5 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-xs font-bold flex items-center gap-1 h-8 cursor-pointer shadow shadow-brand-primary/10 disabled:opacity-55"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play Stream
              </button>

              <button 
                id={`artist-follow-btn-${artist.id}`}
                onClick={() => toggleFollowArtist(artist.id)}
                className={`px-4.5 py-1.5 rounded-lg text-xs font-bold h-8 transition-colors cursor-pointer border ${
                  isFollowing 
                    ? 'border-brand-secondary text-brand-secondary hover:bg-brand-secondary/10' 
                    : 'bg-brand-surface border-gray-900 text-gray-300 hover:border-gray-800'
                }`}
              >
                {isFollowing ? 'Following Curator' : 'Follow Curator'}
              </button>

              <button 
                id={`artist-edit-btn-${artist.id}`}
                onClick={() => setIsEditingProfile(true)}
                className="px-3.5 py-1.5 bg-brand-surface/80 hover:bg-brand-card/45 text-brand-secondary hover:text-white border border-gray-900 hover:border-gray-800 rounded-lg text-xs font-bold flex items-center gap-1.5 h-8 cursor-pointer transition-all"
                title="Edit Artist Details"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Profile
              </button>
            </div>
          </div>

          {artistSongs.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 font-mono">No tranquil compositions available under this artist yet.</p>
          ) : (
            <div className="space-y-2">
              {artistSongs.map((song, idx) => (
                <SongCard key={song.id} song={song} variant="list" index={idx} />
              ))}
            </div>
          )}
        </div>

        {/* Right 1 col: Bio & Albums list */}
        <div className="space-y-6">
          {/* Biography */}
          <div className="p-5 bg-brand-surface border border-gray-900 rounded-xl space-y-2.5 shadow-md">
            <h4 className="font-display font-bold text-sm text-gray-200">About the Curator</h4>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">{artist.bio}</p>
          </div>

          {/* Album list */}
          <div className="space-y-3.5">
            <h4 className="font-display font-bold text-sm text-gray-200 border-b border-gray-900 pb-2">Albums ({artistAlbums.length})</h4>
            {artistAlbums.length === 0 ? (
              <p className="text-xs text-gray-500 py-2 font-mono">No cohesive albums released yet.</p>
            ) : (
              <div className="space-y-3">
                {artistAlbums.map(alb => (
                  <div 
                    key={alb.id}
                    onClick={() => onSelectAlbum(alb.id)}
                    className="flex items-center gap-3 p-2 bg-brand-surface/40 hover:bg-brand-surface border border-gray-900 hover:border-brand-primary/30 rounded-xl cursor-copy transition-colors group"
                  >
                    <img src={alb.cover_image} alt={alb.title} className="w-10 h-10 object-cover rounded shadow" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-100 group-hover:text-brand-secondary truncate">{alb.title}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5 mt-1 capitalize">{alb.type} • {alb.genre}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. MODAL: EDIT ARTIST PROFILE */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-brand-surface border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsEditingProfile(false)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h3 className="text-sm font-display font-bold uppercase tracking-wider text-brand-secondary mb-1">Update Curator Profile</h3>
            <p className="text-xs text-gray-400 mb-5">Revise public acoustic presence, imagery, and description details.</p>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs text-gray-200">
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Artist Name *</label>
                <input 
                  type="text" 
                  required 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="w-full bg-brand-bg p-3 rounded-lg border border-gray-850 text-white focus:outline-none focus:border-brand-primary" 
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Avatar Image URL *</label>
                  <input 
                    type="text" 
                    required 
                    value={editAvatar} 
                    onChange={(e) => setEditAvatar(e.target.value)} 
                    className="w-full bg-brand-bg p-3 rounded-lg border border-gray-850 text-white focus:outline-none focus:border-brand-primary" 
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Cover Image URL *</label>
                  <input 
                    type="text" 
                    required 
                    value={editCover} 
                    onChange={(e) => setEditCover(e.target.value)} 
                    className="w-full bg-brand-bg p-3 rounded-lg border border-gray-850 text-white focus:outline-none focus:border-brand-primary" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Curation Bio *</label>
                <textarea 
                  rows={4} 
                  required 
                  value={editBio} 
                  onChange={(e) => setEditBio(e.target.value)} 
                  className="w-full bg-brand-bg p-3 rounded-lg border border-gray-850 text-white focus:outline-none focus:border-brand-primary" 
                ></textarea>
              </div>
              
              <div className="flex items-center gap-3 justify-end pt-3 border-t border-gray-900">
                <button 
                  type="button" 
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent font-semibold cursor-pointer text-xs transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/80 font-bold cursor-pointer text-xs transition-all"
                >
                  Apply Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


// ==========================================
// 2. ALBUM PROFILE VIEW
// ==========================================
interface AlbumViewProps {
  albumId: string;
  onBack: () => void;
  onSelectArtist: (artistId: string) => void;
}

export const AlbumProfileView: React.FC<AlbumViewProps> = ({ albumId, onBack, onSelectArtist }) => {
  const { albums, artists, songs, playTrack } = useHealersStore();

  const album = albums.find(a => a.id === albumId);
  if (!album) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="font-mono text-sm">Album structure not loaded.</p>
        <button onClick={onBack} className="mt-4 text-xs font-bold text-brand-primary">Go Back</button>
      </div>
    );
  }

  const artist = artists.find(a => a.id === album.artist_id);
  const albumSongs = songs.filter(s => s.album_id === album.id);

  const handlePlayAlbum = () => {
    if (albumSongs.length > 0) {
      playTrack(albumSongs[0], albumSongs);
    }
  };

  return (
    <div id={`album-detail-${albumId}`} className="space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Back button */}
      <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer">
        ← Back to Browse
      </button>

      {/* Album Meta Card */}
      <div className="flex flex-col md:flex-row gap-6 p-6 bg-brand-surface/90 border border-gray-900 rounded-2xl shadow-xl">
        <img 
          src={album.cover_image} 
          alt={album.title} 
          className="w-40 h-40 md:w-52 md:h-52 object-cover rounded-xl shadow-2xl border border-gray-950 flex-shrink-0" 
        />
        
        <div className="flex flex-col justify-between mt-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand-secondary font-mono">{album.type}</span>
            <h2 className="text-2xl md:text-4xl font-display font-bold text-white tracking-tight mt-1">{album.title}</h2>
            
            <div className="flex items-center gap-2 mt-3.5 text-xs text-gray-300">
              <span className="font-semibold hover:underline cursor-pointer" onClick={() => onSelectArtist(album.artist_id)}>
                {artist?.name || 'Acoustic Healer'}
              </span>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-1 font-mono text-[11px]"><Calendar className="w-3.5 h-3.5" /> Published {album.release_date}</span>
              <span className="text-gray-600">•</span>
              <span className="px-2 py-0.5 bg-brand-bg rounded-full text-[10px] uppercase tracking-wider text-gray-400 font-bold">{album.genre}</span>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button 
              id={`album-play-btn-${album.id}`}
              onClick={handlePlayAlbum}
              disabled={albumSongs.length === 0}
              className="px-5 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-transform hover:scale-103 shadow shadow-brand-primary/15 disabled:opacity-55"
            >
              <Play className="w-4 h-4 fill-current" /> Stream Album ({albumSongs.length} Tracks)
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-sm text-gray-300 border-b border-gray-900 pb-2">Compiles</h3>
        
        {albumSongs.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 font-mono">No songs compiled under this album structure yet.</p>
        ) : (
          <div className="space-y-2">
            {albumSongs.map((song, idx) => (
              <SongCard key={song.id} song={song} variant="list" index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


// ==========================================
// 3. PLAYLIST PROFILE VIEW
// ==========================================
interface PlaylistViewProps {
  playlistId: string;
  onBack: () => void;
  onSelectArtist: (artistId: string) => void;
  onSelectAlbum: (albumId: string) => void;
}

export const PlaylistProfileView: React.FC<PlaylistViewProps> = ({ 
  playlistId, 
  onBack,
  onSelectArtist,
  onSelectAlbum
}) => {
  const { 
    playlists, playlistSongs, songs, reorderPlaylist, playTrack, deletePlaylist
  } = useHealersStore();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [downloadedOffline, setDownloadedOffline] = useState(false);

  const playlistValue = playlists.find(p => p.id === playlistId);
  const playlist = playlistValue!; // Safe since we check for existence of playlist right below

  React.useEffect(() => {
    if (!playlist) return;
    const checkStatus = () => {
      import('../lib/offline').then(module => {
        setDownloadedOffline(module.isPlaylistDownloaded(playlist.id));
      });
    };
    checkStatus();
    window.addEventListener('healers-offline-sync', checkStatus);
    return () => window.removeEventListener('healers-offline-sync', checkStatus);
  }, [playlistId, playlist]);

  if (!playlist) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="font-mono text-sm">Custom playlist index not mapped.</p>
        <button onClick={onBack} className="mt-4 text-xs font-bold text-brand-primary">Go Back</button>
      </div>
    );
  }

  // Find associated song IDs in playlist
  const associationSongs = playlistSongs
    .filter(ps => ps.playlist_id === playlist.id)
    .sort((a,b) => a.position - b.position);

  const playlistTracks = associationSongs
    .map(ps => songs.find(s => s.id === ps.song_id))
    .filter((s): s is Song => !!s);

  const handlePlayPlaylist = () => {
    if (playlistTracks.length > 0) {
      playTrack(playlistTracks[0], playlistTracks);
    }
  };

  const handleSharePlaylist = () => {
    const shareUrl = `${window.location.origin}/playlist/${playlist.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success('Serene Playlist share URL copied!', {
        description: 'Ready to spread cosmic calm.'
      });
    });
  };

  const handleDelete = () => {
    setShowConfirmDelete(true);
  };

  const handleMove = (songId: string, direction: 'up' | 'down') => {
    reorderPlaylist(playlist.id, songId, direction);
  };

  return (
    <div id={`playlist-detail-${playlistId}`} className="space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Custom confirm modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-brand-surface border border-gray-900 bg-[#0f0e13] rounded-xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider text-left">Delete Playlist</h4>
            <p className="text-xs text-gray-400 mt-2.5 leading-relaxed text-left">
              Are you sure you want to permanently delete custom playlist "{playlist.title}"? This action is irreversible.
            </p>
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-brand-bg rounded-lg border border-transparent transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deletePlaylist(playlist.id);
                  onBack();
                  setShowConfirmDelete(false);
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-accent text-white hover:bg-brand-accent/90 rounded-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                Delete collection
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Back button */}
      <button onClick={onBack} className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer">
        ← Back to Browse
      </button>

      {/* Hero card */}
      <div className="flex flex-col md:flex-row gap-6 p-6 bg-brand-surface/90 border border-gray-900 rounded-2xl shadow-xl">
        <div className="w-40 h-40 md:w-52 md:h-52 bg-brand-bg rounded-xl border border-gray-950 flex-shrink-0 flex items-center justify-center relative overflow-hidden shadow-2xl">
          {playlist.cover_image ? (
            <img src={playlist.cover_image} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-16 h-16 text-gray-800" />
          )}
        </div>

        <div className="flex flex-col justify-between mt-1 w-full">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest bg-brand-primary/10 border border-brand-primary/20 text-brand-primary px-2.5 py-0.5 rounded-full font-bold uppercase uppercase">
                {playlist.is_public ? 'Public Playlist' : 'Private Slate'}
              </span>
              {playlist.is_collaborative && (
                <span className="text-[10px] font-mono tracking-widest bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary px-2.5 py-0.5 rounded-full font-bold uppercase">
                  Collaborative Active
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-4xl font-display font-bold text-white tracking-tight mt-2.5">{playlist.title}</h2>
            <p className="text-xs text-gray-400 mt-2.5 max-w-xl font-sans leading-relaxed">{playlist.description}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-900">
            <span className="text-xs text-gray-400 font-mono">Contains <b>{playlistTracks.length}</b> tracks</span>
            
            <div className="flex items-center gap-2">
              <button 
                id="playlist-play-btn"
                onClick={handlePlayPlaylist}
                disabled={playlistTracks.length === 0}
                className="px-4.5 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow shadow-brand-primary/10 transition-transform hover:scale-103 cursor-pointer disabled:opacity-55"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play Session
              </button>

              <button 
                id="playlist-download-btn"
                onClick={async () => {
                  const module = await import('../lib/offline');
                  if (downloadedOffline) {
                    await module.undownloadPlaylist(playlist, playlistTracks);
                  } else {
                    await module.downloadPlaylist(playlist, playlistTracks);
                  }
                }}
                disabled={playlistTracks.length === 0}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  downloadedOffline 
                    ? 'bg-brand-secondary/10 border-brand-secondary/40 text-brand-secondary' 
                    : 'bg-brand-bg hover:bg-brand-surface border-gray-800 text-gray-300'
                }`}
                title={downloadedOffline ? 'Remove download from cache' : 'Download all tracks for offline sessions'}
              >
                {downloadedOffline ? <CheckCircle className="w-3.5 h-3.5 text-brand-secondary animate-pulse" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadedOffline ? 'Downloaded' : 'Download Slate'}</span>
              </button>
              
              <button 
                id="playlist-share-btn"
                onClick={handleSharePlaylist}
                className="p-2 bg-brand-bg hover:bg-brand-surface border border-gray-800 text-gray-300 rounded-lg text-xs font-bold flex items-center gap-1 min-h-8 cursor-pointer"
                title="Generate public share link"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>

              <button 
                id="playlist-delete-btn"
                onClick={handleDelete}
                className="p-2 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/20 text-brand-accent rounded-lg text-xs font-bold flex items-center gap-1 min-h-8 cursor-pointer"
                title="Delete this Slate"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Tracks list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-900 pb-2">
          <h3 className="font-display font-bold text-sm text-gray-300">Tracks compiled</h3>
          <span className="text-[10px] text-gray-500 font-mono tracking-wider uppercase font-bold">Position Controls Active</span>
        </div>

        {playlistTracks.length === 0 ? (
          <div className="p-8 bg-brand-surface/20 border border-gray-900/60 rounded-xl flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <Music className="w-7 h-7 text-gray-700 animate-pulse mb-2" />
            <p className="text-xs font-semibold text-gray-400">Your playlist is empty.</p>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Browse songs or browse search results and tap the three-dot options menu to pack peaceful compositions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {playlistTracks.map((song, idx) => (
              <div key={`${song.id}-${idx}`} className="flex items-center gap-2">
                {/* Positional shift controls */}
                <div className="flex flex-col gap-1 pr-1 text-gray-500">
                  <button 
                    disabled={idx === 0} 
                    onClick={() => handleMove(song.id, 'up')}
                    className="p-0.5 rounded hover:bg-gray-800/50 hover:text-white transition-colors disabled:opacity-20"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    disabled={idx === playlistTracks.length - 1} 
                    onClick={() => handleMove(song.id, 'down')}
                    className="p-0.5 rounded hover:bg-gray-800/50 hover:text-white transition-colors disabled:opacity-20"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <SongCard 
                    song={song} 
                    variant="list" 
                    index={idx}
                    onSelectArtist={onSelectArtist}
                    onSelectAlbum={onSelectAlbum}
                    playlistId={playlist.id} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
