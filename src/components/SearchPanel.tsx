import React, { useState } from 'react';
import { Search, Sparkles, SlidersHorizontal, Disc, User, Play, Music, Flame } from 'lucide-react';
import { useHealersStore } from '../store';
import { Song, Artist, Album, Playlist } from '../types';
import { GENRES, MOODS } from '../data';

interface SearchPanelProps {
  onSelectArtist: (artistId: string) => void;
  onSelectAlbum: (albumId: string) => void;
  onSelectPlaylist: (playlistId: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist
}) => {
  const { songs, artists, albums, playlists, playTrack } = useHealersStore();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtering states
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedMood, setSelectedMood] = useState<string>('All');

  const trendingSearches = [
    'Sitar Drone', 'Monsoon Ragas', 'Beta Focus Beats', 'Bangla Calm Flute', 'Insomnia Cures', 'Mantra'
  ];

  const handleTrendingClick = (term: string) => {
    setQuery(term);
  };

  const handlePlaySongDirectly = (song: Song) => {
    playTrack(song, songs);
  };

  // Filter songs
  const filteredSongs = songs.filter(song => {
    const matchesQuery = song.title.toLowerCase().includes(query.toLowerCase()) || 
                         song.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));
    const matchesLang = selectedLanguage === 'All' || song.language === selectedLanguage;
    const matchesGenre = selectedGenre === 'All' || song.genre === selectedGenre;
    const matchesMood = selectedMood === 'All' || song.mood.includes(selectedMood);
    return matchesQuery && matchesLang && matchesGenre && matchesMood;
  });

  // Filter artists
  const filteredArtists = artists.filter(art => 
    art.name.toLowerCase().includes(query.toLowerCase()) || 
    art.bio.toLowerCase().includes(query.toLowerCase())
  );

  // Filter albums
  const filteredAlbums = albums.filter(alb => 
    alb.title.toLowerCase().includes(query.toLowerCase()) ||
    (selectedGenre === 'All' || alb.genre === selectedGenre)
  );

  // Filter playlists
  const filteredPlaylists = playlists.filter(pl => 
    pl.title.toLowerCase().includes(query.toLowerCase()) ||
    pl.description.toLowerCase().includes(query.toLowerCase())
  );

  const isSearching = query.trim() !== '' || selectedLanguage !== 'All' || selectedGenre !== 'All' || selectedMood !== 'All';

  return (
    <div id="searching-dashboard-section" className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* 1. Header and Searchbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input 
            id="main-dashboard-search-bar"
            type="text"
            placeholder="Search peaceful healing tracks, verified acoustic artists, yoga albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-brand-surface p-3.5 pl-11 text-sm border border-gray-900 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-gray-500 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        <button 
          id="search-filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-3.5 rounded-xl border border-gray-900 text-xs font-bold font-mono transition-colors cursor-pointer ${
            showFilters ? 'bg-brand-primary text-white border-brand-primary' : 'bg-brand-surface text-gray-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* 2. Collapsible Filters Drawer */}
      {showFilters && (
        <div className="p-4 bg-brand-surface rounded-xl border border-gray-950/80 grid grid-cols-1 sm:grid-cols-3 gap-4.5 animate-in slide-in-from-top-1">
          {/* Language filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5 font-mono">Language</label>
            <select 
              id="search-filter-language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-brand-bg p-2 text-xs font-medium border border-gray-900 rounded-lg text-white appearance-none"
            >
              <option value="All">All Languages</option>
              <option value="English">English</option>
              <option value="Bangla">Bangla</option>
              <option value="Hindi">Hindi / Sanskrit</option>
              <option value="Others">Others (Latin, Instrumental)</option>
            </select>
          </div>

          {/* Genre filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5 font-mono">Genre vibe</label>
            <select 
              id="search-filter-genre"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full bg-brand-bg p-2 text-xs font-medium border border-gray-900 rounded-lg text-white appearance-none"
            >
              <option value="All">All Genres</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Mood filter */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5 font-mono">Curative mood</label>
            <select 
              id="search-filter-mood"
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="w-full bg-brand-bg p-2 text-xs font-medium border border-gray-900 rounded-lg text-white appearance-none"
            >
              <option value="All">All Moods</option>
              {MOODS.map(m => <option key={m.name} value={m.name}>{m.name} Vibes</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 3. Preloading State (Trending Tags) */}
      {!isSearching && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-gray-400">
            <Flame className="w-5 h-5 text-brand-accent fill-current" />
            <h4 className="font-display font-medium text-sm">Trending search terms</h4>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {trendingSearches.map(term => (
              <button
                key={term}
                id={`trending-tag-${term.replace(/\s+/g, '-')}`}
                onClick={() => handleTrendingClick(term)}
                className="px-3.5 py-1.5 bg-brand-surface rounded-full text-xs font-medium text-gray-300 border border-gray-900 hover:border-brand-primary hover:text-white transition-all scale-100 hover:scale-103"
              >
                {term}
              </button>
            ))}
          </div>

          {/* Prompt banner */}
          <div className="p-8 bg-brand-surface/40 rounded-2xl border border-gray-900 flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-8">
            <Sparkles className="w-8 h-8 text-brand-secondary animate-pulse mb-3" />
            <h5 className="font-bold text-sm text-gray-200">Tune in your focus</h5>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Purple Heart matches music loops natively according to your search inputs. Type keywords like <b>Sitar</b>, <b>Insomnia</b>, <b>Breath</b> or <b>Monsoon</b> to begin your auditory alignment.
            </p>
          </div>
        </div>
      )}

      {/* 4. Real-time Search Results */}
      {isSearching && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Group 1: Filtered Songs */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-sm text-gray-300 border-b border-gray-900 pb-2">
              Songs Matches ({filteredSongs.length})
            </h4>
            {filteredSongs.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 font-mono">No song tracks found with current criteria.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSongs.map(song => (
                  <div 
                    key={song.id}
                    onClick={() => handlePlaySongDirectly(song)}
                    className="flex items-center justify-between p-2.5 bg-brand-surface/45 hover:bg-brand-surface border border-gray-900 hover:border-gray-800 rounded-xl cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={song.cover_image} alt={song.title} className="w-10 h-10 object-cover rounded shadow" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-200 group-hover:text-brand-primary truncate">{song.title}</p>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {artists.find(a => a.id === song.artist_id)?.name || 'Healing Artist'}
                        </p>
                      </div>
                    </div>
                    
                    <button className="p-2 bg-brand-bg border border-gray-800 text-brand-primary rounded-full group-hover:bg-brand-primary group-hover:text-white transition-all transform group-hover:scale-105">
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group 2: Filtered Artists */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-sm text-gray-300 border-b border-gray-900 pb-2">
              Curators Matches ({filteredArtists.length})
            </h4>
            {filteredArtists.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 font-mono">No artists match the filter query.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {filteredArtists.map(artist => (
                  <div 
                    key={artist.id}
                    onClick={() => onSelectArtist(artist.id)}
                    className="flex items-center gap-3 bg-brand-surface/70 border border-gray-900 p-2.5 px-4 rounded-xl cursor-pointer hover:border-gray-800"
                  >
                    <img src={artist.avatar_url} alt={artist.name} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-bold text-white leading-none">{artist.name}</p>
                      <p className="text-[9px] text-gray-500 mt-1 font-mono">{artist.follower_count.toLocaleString()} fans</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group 3: Filtered Albums */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-sm text-gray-300 border-b border-gray-900 pb-2">
              Albums Matches ({filteredAlbums.length})
            </h4>
            {filteredAlbums.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 font-mono">No albums match the filter query.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {filteredAlbums.map(alb => {
                  const creator = artists.find(a => a.id === alb.artist_id)?.name || 'Healer';
                  return (
                    <div 
                      key={alb.id}
                      onClick={() => onSelectAlbum(alb.id)}
                      className="flex items-center gap-3 bg-brand-surface/70 border border-gray-900 p-2.5 px-4 rounded-xl cursor-pointer hover:border-gray-800"
                    >
                      <Disc className="w-5 h-5 text-brand-secondary" />
                      <div>
                        <p className="text-xs font-bold text-white leading-none">{alb.title}</p>
                        <p className="text-[9px] text-gray-500 mt-1">{creator} • {alb.type.toUpperCase()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group 4: Playlists matches */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-sm text-gray-300 border-b border-gray-900 pb-2">
              Playlists ({filteredPlaylists.length})
            </h4>
            {filteredPlaylists.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 font-mono">No public matching playlists found.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {filteredPlaylists.map(pl => (
                  <div 
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl.id)}
                    className="flex items-center gap-3 bg-brand-surface/70 border border-gray-900 p-2.5 px-4 rounded-xl cursor-pointer hover:border-gray-800"
                  >
                    <Music className="w-4 h-4 text-brand-primary" />
                    <div>
                      <p className="text-xs font-bold text-white leading-none">{pl.title}</p>
                      <p className="text-[9px] text-gray-500 mt-1">{pl.songs_count} songs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
