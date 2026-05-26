import React, { useState, useEffect, useMemo } from 'react';
import { 
  Music, Sparkles, Flame, Plus, Heart, Compass, Search, User, 
  Crown, LogOut, Sun, Moon, Bell, ChevronRight, Check, Disc, 
  Settings, Layers, ListMusic, Volume2, HelpCircle, AlertCircle, Play, Pause, X, Lock, Send, Bot, MessageSquare,
  Sunrise, Sunset, Headphones, BookOpen, Lightbulb, Leaf, CloudRain, Zap, Brain, Smile, Download, WifiOff, Mail, Eye, EyeOff
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useHealersStore } from './store';
import { OnboardingFlow } from './components/OnboardingFlow';
import { syncHelper, isSupabaseConfigured } from './lib/supabase';
import { SongCard } from './components/SongCard';
import { SearchPanel } from './components/SearchPanel';
import { AudioPlayer } from './components/AudioPlayer';
import { YoutubePlayerBridge } from './components/YoutubePlayerBridge';
import { ArtistProfileView, AlbumProfileView, PlaylistProfileView } from './components/AcousticProfiles';
import { AdminPanel } from './components/AdminPanel';
import { Song, Playlist } from './types';
import { MOODS, GENRES } from './data';

const renderMoodIconName = (emojiName: string, className?: string) => {
  const cn = className || "w-4 h-4";
  switch(emojiName) {
    case 'Leaf': return <Leaf className={cn} />;
    case 'Smile': return <Smile className={cn} />;
    case 'CloudRain': return <CloudRain className={cn} />;
    case 'Zap': return <Zap className={cn} />;
    case 'Heart': return <Heart className={cn} />;
    case 'Brain': return <Brain className={cn} />;
    case 'Flame': return <Flame className={cn} />;
    case 'Sparkles': return <Sparkles className={cn} />;
    case 'Moon': return <Moon className={cn} />;
    case 'Compass': return <Compass className={cn} />;
    default: return <Sparkles className={cn} />;
  }
};

export default function App() {
  const {
    currentUser, preferences, isOnboarded, isLightMode, songs, artists, albums,
    playlists, likedSongs, playHistory, followers, login, signup, logout, 
    toggleTheme, createPlaylist, updateProfile,
    guestLimitReached, setGuestLimitReached,
    currentSong, isPlaying, playTrack, subscribeToPlaybackSync
  } = useHealersStore();

  // Authentication Fields / Modal Overlay State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authRoleSelection, setAuthRoleSelection] = useState<'user' | 'admin'>('user');
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Song Request Form States
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAiBot, setShowAiBot] = useState(false);
  const [botStep, setBotStep] = useState<number>(0); // 0=Home, 1=Title, 2=Artist, 3=Email, 4=Genre, 5=Notes, 6=Review, 7=Success
  const [requestTitle, setRequestTitle] = useState('');
  const [requestArtist, setRequestArtist] = useState('');
  const [requestYoutubeUrl, setRequestYoutubeUrl] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestGenre, setRequestGenre] = useState('Devotional');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestYoutubeUrl) {
      toast.error('YouTube URL is required.');
      return;
    }

    setIsSubmittingRequest(true);
    const finalTitle = requestTitle || `YouTube Request (${requestYoutubeUrl.split('v=').pop()?.split('&')[0] || requestYoutubeUrl})`;
    const finalEmail = requestEmail || (currentUser ? currentUser.email : 'guest@purpleheart.com');
    const finalArtist = requestArtist || 'Unknown Artist';

    try {
      // 1. Send via local Nodemailer endpoint
      const response = await fetch('/api/request-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          artist: finalArtist,
          requesterEmail: finalEmail,
          genre: requestGenre,
          notes: requestNotes,
          youtubeUrl: requestYoutubeUrl,
        }),
      });
      const data = await response.json();
      
      // 2. Sync to Supabase table in background
      await syncHelper.syncRequest({
        title: finalTitle,
        artist: finalArtist,
        email: finalEmail,
        genre: requestGenre,
        notes: requestNotes + `\nYouTube: ${requestYoutubeUrl}`
      });

      if (data.success || response.ok) {
        toast.success(`Request Sent Successfully!`, {
          description: "Your suggestion has been sent to our moderators! Admin can monitor and upload it using Purple Heart's automatic AI fetching."
        });
        // Reset and close
        setRequestTitle('');
        setRequestArtist('');
        setRequestYoutubeUrl('');
        setRequestNotes('');
        setShowRequestModal(false);
        setBotStep(7); // Success visual step in interactive AI Botanic Bot
        fetchDynamicNotifications();
      } else {
        toast.error(data.error || 'Failed to submit song request.');
      }
    } catch (err) {
      console.error(err);
      
      // Attempt background Supabase request insert anyway if network local nodemailer simulated fails
      await syncHelper.syncRequest({
        title: finalTitle,
        artist: finalArtist,
        email: finalEmail,
        genre: requestGenre,
        notes: requestNotes + `\nYouTube: ${requestYoutubeUrl}`
      });

      toast.success('Simulation Mode: Request synced & saved to database successfully!');
      setRequestTitle('');
      setRequestArtist('');
      setRequestYoutubeUrl('');
      setRequestNotes('');
      setShowRequestModal(false);
      setBotStep(7); // Success visual step in interactive AI Botanic Bot
      fetchDynamicNotifications();
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Unified Page Router inside client view state
  const [currentSection, setCurrentSection] = useState<'home' | 'search' | 'playlists' | 'profile' | 'admin' | 'auth'>('home');
  const [showPassword, setShowPassword] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'dashboard' | 'songs' | 'all-songs' | 'albums' | 'artists' | 'users' | 'analytics' | 'requests'>('dashboard');
  const [activeTab, setActiveTab] = useState<'for_you' | 'trending' | 'new_releases' | 'genres' | 'artists' | 'moods' | 'top_charts' | 'recommended' | 'recently_played' | 'liked_songs'>('for_you');

  // Offline playback & library tracking states
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [libraryTab, setLibraryTab] = useState<'slates' | 'offline'>('slates');
  const [offlineSongs, setOfflineSongs] = useState<Song[]>([]);
  const [supabaseTablesMissing, setSupabaseTablesMissing] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const syncOfflineSongsMeta = () => {
      import('./lib/offline').then((module) => {
        setOfflineSongs(module.getOfflineSongs());
      });
    };

    syncOfflineSongsMeta();
    window.addEventListener('healers-offline-sync', syncOfflineSongsMeta);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('healers-offline-sync', syncOfflineSongsMeta);
    };
  }, []);

  // Subscribe to real-time playback synchronization channel
  useEffect(() => {
    const unsubscribe = subscribeToPlaybackSync();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [subscribeToPlaybackSync]);
  
  // Custom router selections for details profile views
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Modals / Dropdowns
  const [showNotifications, setShowNotifications] = useState(false);
  const [dynamicNotifications, setDynamicNotifications] = useState<{ title: string; body: string; time: string; id?: string }[]>([]);

  const fetchDynamicNotifications = async () => {
    try {
      const res = await fetch('/api/requests');
      if (!res.ok) return;
      const data = await res.json();
      if (data.supabaseTablesMissing) {
        setSupabaseTablesMissing(true);
      } else {
        setSupabaseTablesMissing(false);
      }
      if (data.requests) {
        let alertList: { title: string; body: string; time: string; id?: string }[] = [];
        
        if (currentUser?.role === 'admin') {
          // Only Admin sees and receives notification alerts for song requests
          const pending = data.requests.filter((r: any) => r.status === 'pending');
          alertList = pending.map((r: any) => ({
            id: r.id,
            title: '📥 New Song Request',
            body: `User ${r.requesterEmail} has submitted a song request for "${r.title}" by ${r.artist || 'Unknown Artist'}. Click to view in the Admin Panel.`,
            time: 'Review Pending'
          }));
        } else {
          // If NOT admin, do not show any song request notifications (not even "Request Submitted" or guest requests)
          alertList = [];
        }

        // Add default system alerts to enrich the dashboard beautifully
        const systemNotif = [
          { title: '🌸 Keep Breathing', body: 'Take a deep breath. Align your spine, close your eyes, and listen.', time: 'System' },
          { title: 'Harmonize Onboarding Active', body: 'Customize your soundboard, pick 3 premium verified creators.', time: 'System' }
        ];

        setDynamicNotifications([...alertList, ...systemNotif]);
      }
    } catch (err) {
      // Gracefully capture background network polling failures silently 
      // during local server restarts or transient offline states
    }
  };

  useEffect(() => {
    fetchDynamicNotifications();
    const interval = setInterval(fetchDynamicNotifications, 12000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Load and periodically synchronize server-side curated songs (approved requests and admin added songs)
  useEffect(() => {
    const fetchServerSongs = async () => {
      try {
        const res = await fetch('/api/songs');
        if (!res.ok) return;
        const data = await res.json();
        if (data.supabaseTablesMissing) {
          setSupabaseTablesMissing(true);
        } else {
          setSupabaseTablesMissing(false);
        }
        if (data.songs && Array.isArray(data.songs)) {
          const storeSongs = useHealersStore.getState().songs;

          // 1. Identify local-only songs (not on the server) and push them to the server/Supabase
          const serverIds = new Set(data.songs.map((s: any) => s.id));
          const localOnlySongs = storeSongs.filter(s => !serverIds.has(s.id));

          if (localOnlySongs.length > 0) {
            console.log(`[Sync] Pushing ${localOnlySongs.length} local-only songs to server database...`);
            for (const localSong of localOnlySongs) {
              try {
                await fetch('/api/songs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(localSong)
                });
              } catch (postErr) {
                console.error('[Sync] Failed to upload local song during auto-sync:', postErr);
              }
            }
          }

          // 2. Combine server songs with any verified pending local-only songs
          const updatedServerIds = new Set(data.songs.map((s: any) => s.id));
          const unsyncedSongs = storeSongs.filter(s => !updatedServerIds.has(s.id));
          const finalSongsList = [...data.songs, ...unsyncedSongs];

          // 3. Update local state and localStorage on change detection
          const hasDifferentCount = storeSongs.length !== finalSongsList.length;
          let hasPropertyChange = false;

          if (!hasDifferentCount) {
            for (let i = 0; i < storeSongs.length; i++) {
              const local = storeSongs[i];
              const corresponding = finalSongsList.find(c => c.id === local.id);
              if (!corresponding || 
                  local.title !== corresponding.title ||
                  local.audio_url !== corresponding.audio_url ||
                  local.cover_image !== corresponding.cover_image ||
                  local.genre !== corresponding.genre
              ) {
                hasPropertyChange = true;
                break;
              }
            }
          }

          if (hasDifferentCount || hasPropertyChange) {
            useHealersStore.setState({ songs: finalSongsList });
            localStorage.setItem('healers_songs', JSON.stringify(finalSongsList));
          }
        }
      } catch (err) {
        // Gracefully handle background polling fetch exceptions silently/warnings during server bootup or restarts
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
          console.log('[Background Sync] Server is offline or restarting. Using local audio composition state.');
        } else {
          console.warn('[Sync] Syncing backend compositions warning:', err);
        }
      }
    };

    fetchServerSongs();
    const serverSyncInterval = setInterval(fetchServerSongs, 10000);
    return () => clearInterval(serverSyncInterval);
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  
  // Add Playlist Slate Form
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(true);
  const [newPlaylistCollab, setNewPlaylistCollab] = useState(false);

  // Edit profile form
  const [editNameText, setEditNameText] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  // Genre quick sub-filter
  const [activeSubGenre, setActiveSubGenre] = useState<string | null>(null);

  // Sync edit profile local states on render
  useEffect(() => {
    if (currentUser) {
      setEditNameText(currentUser.full_name);
      setEditAvatarUrl(currentUser.avatar_url);
    }
  }, [currentUser]);

  // Sync routing details
  const navigateToArtist = (id: string) => {
    setSelectedArtistId(id);
    setSelectedAlbumId(null);
    setSelectedPlaylistId(null);
    setCurrentSection('home'); // focus in primary column
  };

  const navigateToAlbum = (id: string) => {
    setSelectedAlbumId(id);
    setSelectedArtistId(null);
    setSelectedPlaylistId(null);
    setCurrentSection('home');
  };

  const navigateToPlaylist = (id: string) => {
    setSelectedPlaylistId(id);
    setSelectedArtistId(null);
    setSelectedAlbumId(null);
    setCurrentSection('playlists');
  };

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle) return;

    // Pick random calming thumbnail placeholder
    const thumbs = [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=50',
      'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=50',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=50',
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=50'
    ];
    const itemCover = thumbs[Math.floor(Math.random() * thumbs.length)];

    const id = createPlaylist(newPlaylistTitle, newPlaylistDesc, itemCover, newPlaylistPublic, newPlaylistCollab);
    toast.success(`Custom soundscape collection "${newPlaylistTitle}" prepped!`);
    
    setNewPlaylistTitle('');
    setNewPlaylistDesc('');
    setNewPlaylistCollab(false);
    setShowCreatePlaylistModal(false);
    
    // Jump straight into the playlist slate view
    navigateToPlaylist(id);
  };

  // Helper: Greeting based on Hour
  const getGreetingData = () => {
    const hrs = new Date().getUTCHours() + 6; // adjust slightly for timezone simulation
    const currentHour = hrs % 24;
    
    if (currentHour < 12) return { text: 'Good Morning', icon: 'Sunrise' };
    if (currentHour < 17) return { text: 'Good Afternoon', icon: 'Sun' };
    return { text: 'Good Evening', icon: 'Moon' };
  };

  // ==========================================
  // LOGIC: Personalized Content Builders (For You)
  // ==========================================
  const personalizedSongs = useMemo(() => {
    if (!preferences) return songs.slice(0, 5);
    
    // Weighted scoring algorithm based on user onboarding selections
    return songs.filter(s => {
      const artName = artists.find(a => a.id === s.artist_id)?.name || '';
      const inArtists = preferences.favorite_artists.includes(s.artist_id);
      const inGenres = preferences.favorite_genres.includes(s.genre);
      const inMoods = s.mood.some(m => preferences.mood.includes(m));
      
      return inArtists || inGenres || inMoods;
    }).slice(0, 6);
  }, [songs, preferences, artists]);

  // Trending Filter: highest play counts
  const trendingSongs = useMemo(() => {
    return [...songs].sort((a,b) => b.play_count - a.play_count);
  }, [songs]);

  // New releases filter last 30 days releases
  const newReleasesThisWeek = useMemo(() => {
    return songs.filter(s => {
      const dateVal = new Date(s.release_date);
      const cutoff = new Date('2026-05-01'); // Relative current release date
      return dateVal >= cutoff;
    });
  }, [songs]);

  const newReleasesThisMonth = useMemo(() => {
    return songs.filter(s => {
      const dateVal = new Date(s.release_date);
      const cutoff = new Date('2026-04-01');
      return dateVal < new Date('2026-05-01') && dateVal >= cutoff;
    });
  }, [songs]);

  // Top Charts rank sorting
  const topChartsSongs = useMemo(() => {
    return [...songs].sort((a,b) => (b.play_count * 1.5) + b.like_count - (a.play_count * 1.5)).slice(0, 20);
  }, [songs]);

  // Recommended based on play logs
  const recommendedSongs = useMemo(() => {
    // Falls back to featured tags or unplayed compositions
    return songs.filter(s => s.is_featured);
  }, [songs]);

  // User plays history mapping
  const playHistoryTracks = useMemo(() => {
    const userHistory = playHistory.filter(h => h.user_id === currentUser?.id || h.user_id === 'anonymous');
    return userHistory
      .map(h => songs.find(s => s.id === h.song_id))
      .filter((s): s is Song => !!s)
      .slice(0, 15);
  }, [playHistory, songs, currentUser]);

  // Liked items matching
  const userLikedTracks = useMemo(() => {
    return likedSongs
      .filter(l => l.user_id === currentUser?.id)
      .map(l => songs.find(s => s.id === l.song_id))
      .filter((s): s is Song => !!s);
  }, [likedSongs, songs, currentUser]);

  // Render multi step onboarding if user preferences are missing and we have a logged-in user
  if (currentUser && (!isOnboarded || !preferences)) {
    return <OnboardingFlow />;
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-400 font-sans select-none ${isLightMode ? 'bg-gray-50 text-gray-900' : 'bg-brand-bg text-gray-100'}`}>
      <Toaster richColors position="top-right" theme={isLightMode ? 'light' : 'dark'} closeButton />
      
      {/* ==========================================
          TOP NAVIGATION PLATFORM TOOLBAR
          ========================================== */}
      <nav className={`fixed top-0 left-0 right-0 h-16 border-b z-35 flex items-center justify-between px-3 md:px-8 shadow-xl backdrop-blur-xl transition-all duration-300 ${isLightMode ? 'bg-white/95 border-gray-200 text-gray-950' : 'bg-brand-surface/90 border-brand-primary/25 text-white'}`}>
        
        {/* Left: Brand name */}
        <div className="flex items-center gap-2 sm:gap-5">
          <div 
            onClick={() => { 
               setSelectedArtistId(null); setSelectedAlbumId(null); setSelectedPlaylistId(null);
               setCurrentSection('home'); setActiveSubGenre(null);
            }}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-brand-primary text-white flex items-center justify-center font-bold shadow-md shadow-brand-primary/20 group-hover:rotate-6 duration-200 shrink-0">
              P
            </div>
            <span className={`font-display font-bold text-sm sm:text-base md:text-lg tracking-tight group-hover:text-brand-primary transition-colors whitespace-nowrap ${isLightMode ? 'text-gray-900' : 'text-white'}`}>Purple Heart</span>
          </div>
        </div>

        {/* Center: Search Launcher widgets */}
        <div className="flex-1 max-w-[200px] sm:max-w-xs md:max-w-md mx-2 sm:mx-6 relative hidden xs:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-brand-primary" />
          <input 
            id="top-nav-search-bar"
            type="text"
            placeholder="Search loops, ragas..."
            onClick={() => { setCurrentSection('search'); setSelectedArtistId(null); setSelectedAlbumId(null); setSelectedPlaylistId(null); }}
            className={`w-full p-2 pl-8 text-[11px] border rounded-xl cursor-pointer focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 transition-all truncate ${isLightMode ? 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900 placeholder-gray-500' : 'bg-black/50 hover:bg-black/70 border-gray-800 text-white placeholder-gray-450'}`} 
          />
        </div>

        {/* Right side controls: notifications, theme, user menu dropdown */}
        <div className="flex items-center gap-1 sm:gap-2.5">
          {/* Light/Dark theme toggling */}
          <button 
            id="top-nav-theme-toggle"
            onClick={toggleTheme}
            className={`p-1.5 sm:p-2 rounded-full cursor-pointer hover:bg-gray-800/40 relative active:scale-95 transition-all ${isLightMode ? 'text-gray-800 hover:text-black' : 'text-gray-100 hover:text-white'}`}
            title={isLightMode ? 'Shift to Dark Midnight mode' : 'Shift to Light soothing mode'}
          >
            {isLightMode ? <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
          </button>

          {/* Notifications Simulator toggling */}
          <div className="relative">
            <button 
              id="top-nav-bell-toggle"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-1.5 sm:p-2 rounded-full cursor-pointer hover:bg-gray-800/40 relative active:scale-95 transition-all ${isLightMode ? 'text-gray-800 hover:text-black' : 'text-gray-100 hover:text-white'}`}
            >
              <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              {dynamicNotifications.some(n => n.time !== 'System') && (
                <span className="absolute top-1 right-1 bg-brand-primary w-2 h-2 rounded-full ring-2 ring-brand-surface animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div className={`absolute right-[-48px] sm:right-0 mt-3 w-[290px] min-[375px]:w-[330px] max-w-[calc(100vw-32px)] border p-4 rounded-xl shadow-2xl z-50 text-xs transition-all duration-300 animate-in fade-in slide-in-from-top-2 focus:outline-none ${
                isLightMode 
                  ? 'bg-white/95 border-gray-200 text-gray-900 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)]' 
                  : 'bg-brand-surface/95 border-gray-800/80 text-gray-150 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)]'
              }`}>
                <div className={`font-bold border-b pb-2 mb-2 flex items-center justify-between ${isLightMode ? 'border-gray-150' : 'border-gray-800'}`}>
                  <span>Circadian Alerts</span>
                  <span className="text-[10px] font-mono font-bold text-brand-primary uppercase">{dynamicNotifications.length} Alerts</span>
                </div>
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {dynamicNotifications.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      No active alerts.
                    </div>
                  ) : (
                    dynamicNotifications.map((n, idx) => {
                      const isRequestNotif = n.time !== 'System' || n.title.includes('Request') || n.title.includes('Suggestion');
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (isRequestNotif) {
                              if (currentUser?.role === 'admin') {
                                setCurrentSection('admin');
                                setAdminInitialTab('requests');
                              } else {
                                setShowRequestModal(true);
                              }
                              setShowNotifications(false);
                            }
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-all duration-200 ${
                            isLightMode 
                              ? 'bg-gray-50 border-gray-200/60' 
                              : 'bg-brand-bg border-gray-900/90'
                          } ${
                            isRequestNotif 
                              ? 'hover:bg-brand-primary/5 hover:border-brand-primary/30 cursor-pointer active:scale-[0.98]' 
                              : ''
                          }`}
                        >
                          <p className="font-bold flex items-center justify-between gap-1.5">
                            <span className={isLightMode ? 'text-gray-900 font-bold' : 'text-gray-100 font-bold'}>{n.title}</span>
                            {isRequestNotif && <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider">Review</span>}
                          </p>
                          <p className={`text-[10px] mt-1.5 leading-normal ${isLightMode ? 'text-gray-600' : 'text-gray-450'}`}>{n.body}</p>
                          <p className={`text-[8px] font-mono mt-2.5 flex justify-between items-center ${isLightMode ? 'text-gray-450' : 'text-gray-500'}`}>
                            <span>{n.time}</span>
                            {isRequestNotif && <span className="text-[8px] text-brand-primary font-bold">View Request →</span>}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-l border-gray-850 h-5 my-auto mx-1.5 hidden md:block"></div>

          <button
            onClick={() => {
              if (currentUser) {
                setRequestEmail(currentUser.email);
              }
              setShowRequestModal(true);
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-brand-primary/30 hover:border-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 rounded-xl text-[11px] font-bold text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-secondary" /> Request Song
          </button>

          {currentUser ? (
            <>
              {/* User profile dropdown drawer */}
              <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setCurrentSection('profile')}>
                <img 
                  src={currentUser.avatar_url} 
                  alt={currentUser.full_name || 'Subscriber Account'} 
                  className="w-8 h-8 rounded-full object-cover border border-gray-800" 
                />
                <span className="text-xs font-bold text-gray-200 group-hover:text-brand-primary hidden md:inline truncate max-w-28 capitalize font-sans">
                  {currentUser.full_name.split(' ')[0]}
                </span>
              </div>

              <button 
                id="top-nav-logout-btn"
                onClick={logout} 
                className="hidden md:block p-2 text-gray-500 hover:text-brand-accent rounded-full cursor-pointer hover:bg-gray-800/20"
                title="Disconnect portal Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                id="top-nav-signin-icon-btn"
                onClick={() => { setAuthMode('login'); setCurrentSection('auth'); }}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-800/10 rounded-full cursor-pointer transition-colors flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold"
                title="Sign In"
              >
                <User className="w-4 h-4 sm:w-4.5 sm:h-4.5 focus:outline-none" />
                <span className="hidden min-[360px]:inline">Sign In</span>
              </button>
              
              <button 
                id="top-nav-signup-btn"
                onClick={() => { setAuthMode('signup'); setCurrentSection('auth'); }}
                className="hidden sm:flex px-4 py-1.5 text-xs bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-full transition-transform hover:scale-103 cursor-pointer items-center justify-center"
                title="Create Account"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

      </nav>

      {/* ==========================================
          MAIN COLLABORATIVE GRID BODY LAYOUT
          ========================================== */}
      <div className="flex-1 flex pt-16 pb-36 md:pb-24" id="main-application-frame-grid">
        
        {/* SIDEBAR NAVIGATION BAR DRAW PANEL */}
        <aside className={`w-56 hidden md:flex flex-col justify-between p-4.5 border-r border-gray-900/40 select-none sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto ${isLightMode ? 'bg-white' : 'bg-brand-surface/40'}`}>
          <div className="space-y-6">
            
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono tracking-widest text-gray-500 uppercase font-bold block px-3">Navigation Map</span>
              
              {[
                { id: 'home', label: 'Primary Browse', icon: Compass },
                { id: 'search', label: 'Active Search', icon: Search },
                { id: 'playlists', label: 'My Saved Slates', icon: ListMusic },
                { id: 'profile', label: 'Listener Profile', icon: User }
              ].map(opt => {
                const Icon = opt.icon;
                const active = currentSection === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`sidebar-link-${opt.id}`}
                    onClick={() => { 
                      setCurrentSection(opt.id as any);
                      setSelectedArtistId(null);
                      setSelectedAlbumId(null);
                      setSelectedPlaylistId(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-bold transition-all cursor-pointer ${
                      active 
                        ? 'bg-brand-primary text-white shadow shadow-brand-primary/15' 
                        : 'text-gray-400 hover:text-white hover:bg-brand-card/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Playlist slates overview */}
            <div className="space-y-2 pt-2 border-t border-gray-900/60">
              <div className="flex items-center justify-between px-3">
                <span className="text-[9px] font-mono tracking-widest text-gray-500 uppercase font-bold">My Slates</span>
                <button 
                  id="sidebar-create-playlist-btn"
                  onClick={() => setShowCreatePlaylistModal(true)}
                  className="hover:text-brand-secondary p-0.5 rounded"
                  title="Prepare new soundscape Slate"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 max-h-56 overflow-y-auto">
                {playlists.length === 0 ? (
                  <p className="text-[10px] text-gray-500 px-3 font-mono leading-relaxed py-1">No custom collections curated yet.</p>
                ) : (
                  playlists.map(pl => (
                    <button
                      key={pl.id}
                      onClick={() => navigateToPlaylist(pl.id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-white truncate hover:bg-brand-card/25 rounded flex items-center gap-1.5 font-medium"
                    >
                      <Layers className="w-3 h-3 text-brand-primary shrink-0" />
                      {pl.title}
                    </button>
                  ))
                )}
              </div>
            </div>

          </div>

          <div className="p-3.5 bg-brand-surface border border-gray-950/60 rounded-xl leading-normal text-[10px] text-gray-400 space-y-1 shadow shadow-brand-secondary/5 animate-pulse-slow">
            <span className="font-bold text-brand-secondary flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-brand-secondary shrink-0 animate-spin-slow" /> Harmonic Tuning:
            </span>
            Ambient raga frequencies calibrated natively for: <span className="font-bold text-gray-200 capitalize">{preferences?.listening_time || 'anytime'}</span> listening.
          </div>

          <div className="p-3.5 bg-brand-surface/80 border border-gray-950/60 rounded-xl leading-normal text-[10px] text-gray-400 space-y-1.5 shadow shadow-brand-primary/5 mt-3 text-center">
            <span className="font-bold text-brand-primary flex items-center gap-1 justify-center">
              <Sparkles className="w-3.5 h-3.5 text-brand-primary shrink-0 animate-pulse" /> Missing Ragas?
            </span>
            <p className="text-[9px] text-gray-500 leading-normal">
              Can't find your peaceful bhajan or sitar track? Suggest a piece to the curators!
            </p>
            <button
              onClick={() => {
                if (currentUser) {
                  setRequestEmail(currentUser.email);
                }
                setShowRequestModal(true);
              }}
              className="w-full py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg font-bold text-[9px] cursor-pointer transition-transform hover:scale-101 text-center"
            >
              Request a Song
            </button>
          </div>
        </aside>

        {/* Dynamic primary content viewport */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden scrollbar-thin scroll-smooth" id="spotify-main-scroller">
          
          {/* Connectivity Status Banner */}
          {!isOnline && (
            <div className="mb-6 p-4 rounded-xl bg-orange-650/15 border border-orange-500/35 text-orange-200 text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-full bg-orange-500/15 text-orange-400">
                  <WifiOff className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-orange-100">Local Offline Mode Active</p>
                  <p className="text-[11px] text-orange-300/75 mt-0.5">No network linkage detected. Your offline downloaded songs and playlists remain safe and playable inside your library.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setLibraryTab('offline');
                  setCurrentSection('playlists');
                }}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-lg"
              >
                View Offline Library
              </button>
            </div>
          )}

          {/* Database Table Missing Helper Alert */}
          {supabaseTablesMissing && isSupabaseConfigured && (
            <div className="mb-6 p-4 rounded-xl bg-amber-950/20 border border-amber-600/40 text-amber-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4" id="supabase-missing-banner">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-0.5" id="supabase-missing-icon-container">
                  <AlertCircle className="w-4 h-4" id="supabase-missing-icon" />
                </div>
                <div>
                  <p className="font-semibold text-xs text-amber-100 flex items-center gap-1.5" id="supabase-missing-title">
                    Supabase Tables Missing (Database Schema Required)
                  </p>
                  <p className="text-[11px] text-amber-300/75 mt-0.5 leading-relaxed" id="supabase-missing-desc">
                    Some Supabase tables (e.g., <code className="bg-black/30 px-1 py-0.2 rounded text-amber-200 text-[10px]">healers_songs</code>) were not found in your database. 
                    Please copy our premade SQL schema query and run it inside your Supabase SQL Editor to initialize.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto" id="supabase-missing-actions">
                <button 
                  onClick={() => {
                    const schema = syncHelper.getSQLSchema();
                    navigator.clipboard.writeText(schema);
                    toast.success('SQL Query Copied!', {
                      description: 'Paste it in your Supabase SQL Editor to instantly bootstrap your tables!'
                    });
                  }}
                  id="supabase-copy-sql-btn"
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] font-mono transition-all cursor-pointer shadow-md select-none w-full md:w-auto text-center"
                >
                  Copy SQL Query
                </button>
              </div>
            </div>
          )}
          
          {/* ==========================================
              1. REGULAR ADMIN ROUTER
              ========================================== */}
          {currentSection === 'admin' && currentUser?.role === 'admin' && (
            <div className="animate-in fade-in" id="primary-view-admin">
              <div className="flex items-center justify-between border-b border-gray-900 pb-4 mb-6">
                <div>
                  <h2 className="text-xl md:text-3xl font-display font-medium tracking-tight text-white flex items-center gap-2">
                    <Crown className="w-7 h-7 text-brand-secondary fill-current animate-pulse" /> Purple Heart Curator Command
                  </h2>
                  <p className="text-xs text-gray-400 leading-relaxed mt-1">
                    Deploy, review, and synchronize premium ragas, acoustic models and user memberships.
                  </p>
                </div>
              </div>

              <AdminPanel initialTab={adminInitialTab} />
            </div>
          )}

          {/* ==========================================
              AUTH MODULE VIEW (DEDICATED FULL-PAGE VIEW WITH PASSWORD TOGGLE)
              ========================================== */}
          {currentSection === 'auth' && (
            <div className="animate-in fade-in max-w-md mx-auto py-10 px-4 scroll-smooth" id="primary-view-auth">
              <div className="w-full p-6 md:p-8 bg-[#0D0D15] border border-gray-900 rounded-2xl shadow-2xl space-y-6">
                
                <div className="text-center relative">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary text-white flex items-center justify-center font-bold text-lg mx-auto shadow-lg shadow-brand-primary/20 animate-pulse">
                    P
                  </div>
                  <h2 className="text-2xl font-display font-semibold tracking-tight mt-3 text-white">Purple Heart Portal</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Connect your soul and synchronize personalized calm configurations.
                  </p>
                </div>

                {/* Explicit Modern Pill Tab Selector */}
                <div className="grid grid-cols-2 p-1 bg-[#05050A] border border-gray-900 rounded-xl relative select-none">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); setShowPassword(false); }}
                    className={`py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-brand-primary text-white shadow-md font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/10'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setShowPassword(false); }}
                    className={`py-2 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      authMode === 'signup'
                        ? 'bg-brand-primary text-white shadow-md font-bold'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/10'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Form Tab 1: SIGN IN FORM */}
                {authMode === 'login' && (() => {
                  const usersList = useHealersStore.getState().users;
                  const cleanedEmail = authEmail.toLowerCase().trim();
                  const emailExists = usersList.some(u => u.email.toLowerCase() === cleanedEmail);
                  const isDefaultAdmin = cleanedEmail === 'ausiaam83@gmail.com';

                  const handleLoginSubmit = async (e: React.FormEvent) => {
                    e.preventDefault();
                    if (!cleanedEmail) return;

                    if (!authPassword || !authPassword.trim()) {
                      toast.error('Please enter your password to sign in.');
                      return;
                    }

                    const toastId = toast.loading('Initializing session...');
                    try {
                      const result = await login(cleanedEmail, authPassword);
                      if (result && result.success) {
                        toast.success(`Welcome back, ${useHealersStore.getState().currentUser?.full_name || 'peaceful listener'}!`, { id: toastId });
                        setCurrentSection('home');
                        setUploadedAvatarUrl('');
                        setAuthFullName('');
                        setAuthPassword('');
                      } else {
                        toast.error(result.error || 'Authentication failed. Please verify your credentials.', { id: toastId });
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'An unexpected authentication error occurred.', { id: toastId });
                    }
                  };

                  return (
                    <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-sans animate-in fade-in slide-in-from-top-1 duration-200">
                      <div>
                        <label className="text-gray-400 font-bold block mb-1.5">Soul Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type="email"
                            required
                            placeholder="name@domain.com"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="w-full bg-[#05050A] border border-gray-900 focus:border-brand-primary rounded-lg pl-10 pr-3 py-3 text-white placeholder-gray-600 focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors font-medium text-xs font-sans" 
                          />
                        </div>

                        {isDefaultAdmin && (
                          <p className="text-[10px] text-brand-secondary font-mono mt-2 leading-normal">
                            Verified ausiaam83@gmail.com administrator session. Instantly granted Access to /admin metrics.
                          </p>
                        )}

                        {!emailExists && cleanedEmail && (
                          <div className="mt-3.5 p-3 rounded-lg bg-orange-950/10 border border-orange-900/30 text-[11px] text-orange-400 leading-relaxed animate-in slide-in-from-top-1">
                            We didn't find an account for this email yet. Tap 
                            <button 
                              type="button" 
                              onClick={() => setAuthMode('signup')}
                              className="text-brand-secondary font-bold hover:underline mx-1 cursor-pointer"
                            >
                              Create Account
                            </button> 
                            above to initialize your spiritual profile!
                          </div>
                        )}

                        {emailExists && cleanedEmail && (
                          <div className="mt-3.5 p-3 rounded-lg bg-teal-950/10 border border-teal-900/30 text-[11px] text-teal-400 leading-relaxed animate-in slide-in-from-top-1">
                            ✓ Registered Soul profile recognized. Ready to connect!
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-gray-400 font-bold block mb-1.5">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            className="w-full bg-[#05050A] border border-gray-950 rounded-lg pl-10 pr-10 py-3 text-white placeholder-gray-600 focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors font-medium text-xs font-sans" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="w-full py-3 text-center bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-1.5 text-xs font-semibold"
                      >
                        <Sparkles className="w-4 h-4 text-brand-secondary" />
                        Sign In & Access
                      </button>
                    </form>
                  );
                })()}

                {/* Form Tab 2: SIGN UP / REGISTER FORM */}
                {authMode === 'signup' && (() => {
                  const CALM_AVATARS = [
                    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop',
                    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop'
                  ];

                  const usersList = useHealersStore.getState().users;
                  const cleanedEmail = authEmail.toLowerCase().trim();
                  const emailExists = usersList.some(u => u.email.toLowerCase() === cleanedEmail);

                  const handleDragOver = (e: React.DragEvent) => {
                    e.preventDefault();
                    setDragActive(true);
                  };
                  const handleDragLeave = () => {
                    setDragActive(false);
                  };
                  const handleDrop = (e: React.DragEvent) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      const file = e.dataTransfer.files[0];
                      if (!file.type.startsWith('image/')) {
                        toast.error('Image files only please!');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) {
                          setUploadedAvatarUrl(ev.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  };

                  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (!file.type.startsWith('image/')) {
                        toast.error('Image files only please!');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        if (ev.target?.result) {
                          setUploadedAvatarUrl(ev.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  };

                  const handleSignupSubmit = async (e: React.FormEvent) => {
                    e.preventDefault();
                    if (!cleanedEmail) return;
                    if (!authFullName.trim()) {
                      toast.error('Please enter your full name to initialize your soul profile.');
                      return;
                    }
                    if (!authPassword || authPassword.length < 6) {
                      toast.error('Password must be at least 6 characters long for security.');
                      return;
                    }

                    const toastId = toast.loading('Creating secure account...');
                    try {
                      const selectedAvatar = uploadedAvatarUrl || CALM_AVATARS[Math.floor(Math.random() * CALM_AVATARS.length)];
                      const result = await signup(cleanedEmail, authFullName.trim(), authPassword, selectedAvatar);
                      
                      if (result && result.success) {
                        if (result.requiresVerification) {
                          toast.info(result.error || 'A verification link was sent to your email. Please click it to verify.', { id: toastId, duration: 8000 });
                          setAuthMode('login');
                        } else {
                          toast.success(`Successfully registered and synchronized account for ${authFullName}!`, { id: toastId });
                          setCurrentSection('home');
                          setUploadedAvatarUrl('');
                          setAuthFullName('');
                          setAuthPassword('');
                        }
                      } else {
                        toast.error(result.error || 'Could not complete registration. Please try again.', { id: toastId });
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'An unexpected error occurred during signup.', { id: toastId });
                    }
                  };

                  return (
                    <form onSubmit={handleSignupSubmit} className="space-y-4 text-xs font-sans animate-in fade-in slide-in-from-top-1 duration-200">
                      <div>
                        <label className="text-gray-400 font-bold block mb-1.5">Soul Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type="email"
                            required
                            placeholder="name@domain.com"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="w-full bg-[#05050A] border border-gray-900 focus:border-brand-primary rounded-lg pl-10 pr-3 py-3 text-white placeholder-gray-600 focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors font-medium text-xs font-sans" 
                          />
                        </div>

                        {emailExists && cleanedEmail && (
                          <div className="mt-3 p-3 rounded-lg bg-teal-950/10 border border-teal-900/30 text-[11px] text-teal-400 leading-relaxed animate-in slide-in-from-top-1">
                            An account already exists under this email address. Tap 
                            <button 
                              type="button" 
                              onClick={() => setAuthMode('login')}
                              className="text-brand-secondary font-bold hover:underline mx-1 cursor-pointer"
                            >
                              Sign In
                            </button> 
                            above to access it instantly!
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1.5 font-bold">Your Spiritual Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type="text"
                            required
                            placeholder="e.g. Anand Satya"
                            value={authFullName}
                            onChange={(e) => setAuthFullName(e.target.value)}
                            className="w-full bg-[#05050A] border border-gray-900 focus:border-brand-primary rounded-lg pl-10 pr-3 py-3 text-white focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors font-medium text-xs font-sans" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1.5 font-bold">Secure Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="Minimum 6 characters"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            className="w-full bg-[#05050A] border border-gray-950 rounded-lg pl-10 pr-10 py-3 text-white focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors font-medium text-xs font-sans" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Interactive Photo Upload and Drag-and-Drop Area */}
                      <div>
                        <label className="block text-gray-400 mb-1.5 font-bold">Acoustic Soul Avatar</label>
                        
                        <div 
                          onDragEnter={handleDragOver}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-xl p-4.5 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 ${
                            dragActive 
                              ? 'border-brand-primary bg-brand-primary/5' 
                              : 'border-gray-900 hover:border-brand-primary bg-brand-bg/20'
                          }`}
                          onClick={() => document.getElementById('avatar-file-upload-page')?.click()}
                        >
                          <input 
                            type="file"
                            id="avatar-file-upload-page"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                          />

                          {uploadedAvatarUrl ? (
                            <div className="relative group">
                              <img 
                                src={uploadedAvatarUrl} 
                                alt="Uploaded profile photo preview" 
                                className="w-16 h-16 rounded-full object-cover border-2 border-brand-primary shadow-xl"
                              />
                              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] text-white font-bold leading-none">Change Photo</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 flex flex-col items-center">
                              <div className="w-10 h-10 rounded-full bg-brand-primary/5 flex items-center justify-center text-brand-primary border border-brand-primary/10 mb-1.5">
                                <Sparkles className="w-4 h-4 text-brand-secondary animate-pulse" />
                              </div>
                              <p className="text-[10px] font-bold text-gray-300">Drag & drop your spiritual photo here</p>
                              <p className="text-[9px] text-gray-500 mt-0.5">Or tap/click to select image from your device</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick fallback avatars */}
                      <div>
                        <span className="block text-[10px] text-gray-500 mb-1.5 font-semibold">Or select a calming preset profile avatar:</span>
                        <div className="flex gap-2 justify-center">
                          {CALM_AVATARS.map((av, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setUploadedAvatarUrl(av)}
                              className={`p-0.5 rounded-full border-2 transition-transform hover:scale-105 shrink-0 ${
                                uploadedAvatarUrl === av ? 'border-brand-primary scale-110 shadow-lg shadow-brand-primary/15' : 'border-transparent opacity-70 hover:opacity-100'
                              }`}
                            >
                              <img src={av} alt="" className="w-8 h-8 rounded-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="w-full py-3 text-center bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-1.5 text-xs font-semibold"
                      >
                        <Sparkles className="w-4 h-4 text-brand-secondary" />
                        Complete Soul Registration
                      </button>
                    </form>
                  );
                })()}

              </div>
            </div>
          )}

          {/* ==========================================
              2. SEARCH MODULE VIEW
              ========================================== */}
          {currentSection === 'search' && (
            <div className="animate-in fade-in" id="primary-view-search">
              <SearchPanel 
                onSelectArtist={navigateToArtist} 
                onSelectAlbum={navigateToAlbum}
                onSelectPlaylist={navigateToPlaylist} 
              />
            </div>
          )}

          {/* ==========================================
              3. SAVED PLAYLIST SLATES VIEW
              ========================================== */}
          {currentSection === 'playlists' && (
            <div className="animate-in fade-in" id="primary-view-playlists">
              {selectedPlaylistId ? (
                <PlaylistProfileView 
                  playlistId={selectedPlaylistId} 
                  onBack={() => setSelectedPlaylistId(null)} 
                  onSelectArtist={navigateToArtist} 
                  onSelectAlbum={navigateToAlbum}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-900 pb-3">
                    <div>
                      <h2 className="text-xl md:text-3xl font-display font-bold tracking-tight text-white">Your Music Library</h2>
                      <p className="text-xs text-gray-400 mt-1">Manage customizable slates or listen to downloaded tracks in offline mode.</p>
                    </div>
                    {libraryTab === 'slates' && (
                      <button 
                        onClick={() => setShowCreatePlaylistModal(true)}
                        className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer hover:bg-brand-primary/95 shadow"
                      >
                        <Plus className="w-4 h-4" /> Curate New Slate
                      </button>
                    )}
                  </div>

                  {/* Sub-Tabs Selector */}
                  <div className="flex gap-4 border-b border-gray-900/60 pb-1.5">
                    <button 
                      onClick={() => setLibraryTab('slates')}
                      className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                        libraryTab === 'slates' 
                          ? 'border-brand-primary text-brand-primary' 
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      Curated Slates ({playlists.length})
                    </button>
                    <button 
                      onClick={() => setLibraryTab('offline')}
                      className={`pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                        libraryTab === 'offline' 
                          ? 'border-brand-primary text-brand-primary' 
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 font-bold" />
                      Offline Downloads ({offlineSongs.length})
                    </button>
                  </div>

                  {libraryTab === 'slates' ? (
                    playlists.length === 0 ? (
                      <div className="p-12 text-center bg-brand-surface/20 border border-dashed border-gray-800 rounded-2xl max-w-sm mx-auto">
                        <ListMusic className="w-8 h-8 text-gray-600 animate-pulse mx-auto mb-3" />
                        <p className="text-xs font-semibold text-gray-300">You have no custom slates.</p>
                        <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                          Tap "Curate New Slate" above to compile a custom audio playlist flow.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-in fade-in">
                        {playlists.map(pl => (
                          <div 
                            key={pl.id}
                            onClick={() => navigateToPlaylist(pl.id)}
                            className="p-4 bg-brand-surface/40 hover:bg-brand-surface border border-gray-900 hover:border-gray-800 rounded-xl cursor-pointer group transition-all hover:-translate-y-1 shadow flex flex-col justify-between aspect-square"
                          >
                            <div className="w-10 h-10 rounded bg-brand-primary/10 flex items-center justify-center text-brand-primary group-hover:scale-105 duration-200 shadow">
                              <Layers className="w-5 h-5" />
                            </div>
                            
                            <div>
                              <h4 className="font-bold text-xs text-gray-200 mt-4 group-hover:text-brand-secondary truncate">{pl.title}</h4>
                              <p className="text-[10px] text-gray-500 mt-1 truncate">{pl.songs_count} songs • {pl.is_public ? 'Public' : 'Private'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="p-3 bg-brand-surface/75 border border-gray-900 rounded-xl text-xs text-gray-400 leading-relaxed flex items-center gap-3">
                        <div className="p-2 rounded-full bg-brand-secondary/15 text-brand-secondary">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-200 text-xs">Offline Cache Sync is Operational</p>
                          <p className="text-[10px] text-gray-500">Tracks listed here are stored fully locally. They will stream instantly even with your network adapter disabled.</p>
                        </div>
                      </div>

                      {offlineSongs.length === 0 ? (
                        <div className="p-12 text-center bg-brand-surface/20 border border-dashed border-gray-850 rounded-2xl max-w-sm mx-auto">
                          <Layers className="w-8 h-8 text-gray-650 mx-auto mb-3 animate-pulse" />
                          <p className="text-xs font-semibold text-gray-300">No channels downloaded offline yet.</p>
                          <p className="text-[10px] text-gray-500 mt-1 text-center">
                            Tap the 3-dot options menu of any music and choose "Save Offline Cache" to store files locally.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {offlineSongs.map((song, idx) => (
                            <SongCard 
                              key={`offline-${song.id}-${idx}`}
                              song={song} 
                              variant="list" 
                              index={idx}
                              onSelectArtist={navigateToArtist}
                              onSelectAlbum={navigateToAlbum}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              4. LISTENER ACCOUNT PROFILE VIEW
              ========================================== */}
          {currentSection === 'profile' && (
            currentUser ? (
              <div className="animate-in fade-in max-w-4xl space-y-8" id="primary-view-profile">
                
                <div className="flex flex-col md:flex-row gap-6 p-6 bg-brand-surface/80 border border-gray-900 rounded-2xl shadow-lg justify-between items-start md:items-center">
                  <div className="flex items-center gap-4.5">
                    <img src={currentUser.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-brand-primary shadow-xl" />
                    <div>
                      <h2 className="text-2xl font-display font-bold text-white tracking-tight">{currentUser.full_name}</h2>
                      <p className="text-xs text-gray-400 mt-1 font-mono">{currentUser.email} • role: <span className="text-brand-primary capitalize font-bold">{currentUser.role}</span></p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {currentUser.role === 'admin' && (
                      <button 
                        onClick={() => {
                          setSelectedArtistId(null); setSelectedAlbumId(null); setSelectedPlaylistId(null);
                          setCurrentSection('admin');
                        }}
                        className="px-3.5 py-1.5 rounded bg-brand-primary/20 border border-brand-primary/40 hover:bg-brand-primary/35 text-brand-primary font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Crown className="w-3.5 h-3.5 text-brand-secondary fill-current" />
                        Admin Dashboard
                      </button>
                    )}
                    <button 
                      onClick={() => setShowSettings(!showSettings)}
                      className="px-3.5 py-1.5 rounded bg-brand-bg border border-gray-800 text-gray-300 font-bold"
                    >
                      Edit profile details
                    </button>
                    <button 
                      onClick={logout}
                      className="px-3.5 py-1.5 rounded bg-brand-accent/10 text-brand-accent font-bold"
                    >
                      Logout Session
                    </button>
                  </div>
                </div>
                {/* Collapsible edit details settings drawer */}
                {showSettings && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
                    
                    {/* Column 1: Adjust Profile Particulars */}
                    <div className="p-5 bg-brand-surface border border-brand-primary/20 rounded-xl space-y-4">
                      <h4 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                        <User className="w-4 h-4 text-brand-primary" /> Adjust Profile Particulars
                      </h4>
                      <div className="space-y-3.5 text-xs">
                        <div>
                          <label className="block text-gray-400 mb-1 font-bold">Public Full Name</label>
                          <input 
                            type="text"
                            value={editNameText}
                            onChange={(e) => setEditNameText(e.target.value)}
                            className="w-full bg-brand-bg/60 p-2 text-xs border border-gray-900 rounded-lg text-white focus:outline-none focus:border-brand-primary" 
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1 font-bold">Profile Avatar URL</label>
                          <input 
                            type="text"
                            value={editAvatarUrl}
                            onChange={(e) => setEditAvatarUrl(e.target.value)}
                            className="w-full bg-brand-bg/60 p-2 text-xs border border-gray-900 rounded-lg text-white focus:outline-none focus:border-brand-primary" 
                          />
                        </div>
                        <button 
                          onClick={() => { 
                            updateProfile(editNameText, editAvatarUrl); 
                            setShowSettings(false); 
                            toast.success('Profile variables saved successfully.'); 
                          }}
                          className="w-full uppercase font-mono tracking-wider font-bold text-[10px] md:text-xs py-2 bg-brand-primary text-white rounded-lg cursor-pointer hover:bg-brand-primary/90 transition-all text-center"
                        >
                          Apply Profile Modifications
                        </button>
                      </div>
                    </div>

                    {/* Column 2: Interactive Supabase Integration Center */}
                    <div className="p-5 bg-brand-surface border border-gray-900 rounded-xl space-y-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-brand-secondary animate-pulse" /> Supabase Integration
                          </h4>
                          {isSupabaseConfigured ? (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 font-mono font-bold animate-pulse">
                              ● Connected Active
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent border border-brand-accent/20 font-mono font-bold">
                              ● Sandbox Local Mode
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                          Your account sessions are automatically synced. To plug in your real database, configure 
                          <code className="text-brand-secondary bg-black/40 px-1 py-0.5 rounded mx-1 text-[10px]">VITE_SUPABASE_URL</code> 
                          and <code className="text-brand-secondary bg-black/40 px-1 py-0.5 rounded text-[10px]">VITE_SUPABASE_ANON_KEY</code>.
                        </p>

                        <div className="mt-2.5 space-y-1 text-[10px] font-mono text-gray-500">
                          <p className="flex items-center gap-1.5">
                            <Check className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-brand-secondary' : 'text-gray-600'}`} /> Syncs <span className="text-gray-300">healers_users</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Check className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-brand-secondary' : 'text-gray-600'}`} /> Syncs <span className="text-gray-300">healers_preferences</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Check className={`w-3.5 h-3.5 ${isSupabaseConfigured ? 'text-brand-secondary' : 'text-gray-600'}`} /> Syncs <span className="text-gray-300">healers_requests</span>
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            const schema = syncHelper.getSQLSchema();
                            navigator.clipboard.writeText(schema);
                            toast.success('Supabase SQL Schema copied to clipboard!', {
                              description: 'Paste this into your Supabase SQL Editor to bootstrap tables instantly.'
                            });
                          }}
                          className="w-full text-center py-2 border border-gray-800 hover:border-brand-secondary bg-black/30 text-[10px] font-mono font-semibold hover:text-white rounded-lg cursor-pointer transition-colors"
                        >
                          Get Supabase SQL Schema (Copy Query)
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* Stats overview boxes */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                  <div className="p-3 sm:p-4 bg-brand-surface border border-gray-900 rounded-xl text-center">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-brand-accent mx-auto fill-current animate-pulse" />
                    <p className="text-lg sm:text-xl font-bold text-white mt-1.5">{userLikedTracks.length}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-1 truncate">Liked Songs</p>
                  </div>

                  <div className="p-3 sm:p-4 bg-brand-surface border border-gray-900 rounded-xl text-center">
                    <ListMusic className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary mx-auto" />
                    <p className="text-lg sm:text-xl font-bold text-white mt-1.5">{playlists.length}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-1 truncate">Slates Created</p>
                  </div>

                  <div className="p-3 sm:p-4 bg-brand-surface border border-gray-900 rounded-xl text-center">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-brand-secondary mx-auto" />
                    <p className="text-lg sm:text-xl font-bold text-white mt-1.5">{followers.length}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500 font-mono uppercase tracking-wider mt-1 truncate">Curators</p>
                  </div>
                </div>

                {/* Personalized Onboard parameters detail lists */}
                {preferences && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl space-y-3">
                      <h4 className="font-display font-medium text-xs tracking-widest text-gray-300 uppercase">My Alignment tags</h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {preferences.favorite_genres.map(g => (
                          <span key={g} className="px-3 py-1 bg-brand-bg border border-gray-950 rounded text-brand-secondary font-bold font-mono">
                            #{g}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl space-y-3">
                      <h4 className="font-display font-medium text-xs tracking-widest text-gray-300 uppercase">My Target moods</h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {preferences.mood.map(m => {
                          const iconName = MOODS.find(mood => mood.name === m)?.emoji || 'Sparkles';
                          return (
                            <span key={m} className="px-3 py-1 bg-brand-bg border border-gray-950 rounded text-brand-primary font-bold flex items-center gap-1.5">
                              {renderMoodIconName(iconName, "w-3.5 h-3.5 text-brand-primary shrink-0")}
                              <span>{m}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="animate-in fade-in max-w-lg mx-auto py-16 text-center space-y-6" id="primary-view-profile-guest">
                <div className="w-20 h-20 bg-brand-surface border border-gray-955 rounded-3xl flex items-center justify-center mx-auto text-brand-primary shadow-xl">
                  <User className="w-10 h-10 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-display font-bold text-white tracking-wider">Account Synchronization Pending</h3>
                  <p className="text-xs text-gray-400 leading-relaxed px-4">
                    Connect your account to save listening preferences, organize custom playlists, and follow your favorite music curators.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAuthMode('signup');
                    setCurrentSection('auth');
                  }}
                  className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold text-xs rounded-xl shadow-lg transition-transform hover:scale-101 cursor-pointer"
                >
                  Synchronize Soul Account
                </button>
              </div>
            )
          )}

          {/* ==========================================
              5. PRIMARY BROWSE VIEWS (HOME DASHBOARD)
              ========================================== */}
          {currentSection === 'home' && (
            <div className="space-y-8 animate-in fade-in" id="primary-view-home">
              
              {/* Back out subdetail route selectors */}
              {selectedArtistId ? (
                <ArtistProfileView 
                  artistId={selectedArtistId || ''} 
                  onBack={() => setSelectedArtistId(null)}
                  onSelectAlbum={navigateToAlbum} 
                />
              ) : selectedAlbumId ? (
                <AlbumProfileView 
                  albumId={selectedAlbumId || ''} 
                  onBack={() => setSelectedAlbumId(null)}
                  onSelectArtist={navigateToArtist} 
                />
              ) : (
                <>
                  {/* Greeting layout: Modern responsive grid card to prevent text overflows/unwanted columns */}
                  <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 sm:p-5 rounded-xl mb-6 shadow-sm border transition-all duration-300 ${isLightMode ? 'bg-white border-gray-200' : 'bg-brand-surface/40 border-gray-900/50'}`}>
                    <div className="md:col-span-8 flex items-center gap-4 min-w-0">
                      <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary shrink-0">
                        {getGreetingData().text === 'Good Morning' && <Sunrise className="w-8 h-8 sm:w-10 sm:h-10" />}
                        {getGreetingData().text === 'Good Afternoon' && <Sun className="w-8 h-8 sm:w-10 sm:h-10" />}
                        {getGreetingData().text === 'Good Evening' && <Moon className="w-8 h-8 sm:w-10 sm:h-10" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className={`text-lg sm:text-2xl md:text-3xl font-display font-bold tracking-tight ${isLightMode ? 'text-gray-900' : 'text-white'}`}>
                            {getGreetingData().text},
                          </span>
                          <span className="text-brand-primary text-lg sm:text-2xl md:text-3xl font-display font-bold tracking-tight">
                            {currentUser ? currentUser.full_name.split(' ')[0] : 'Peaceful Listener'}
                          </span>
                        </div>
                        <p className={`text-xs mt-1 leading-relaxed truncate ${isLightMode ? 'text-gray-650 font-medium' : 'text-gray-400'}`}>
                          Sourced therapeutic alignments calibrated beautifully for your soul profile.
                        </p>
                      </div>
                    </div>
                    
                    {/* Right column: Status element on larger screens, hidden on extra small screens */}
                    <div className="md:col-span-4 flex md:justify-end items-center gap-2 text-xs text-brand-primary/90 font-mono font-bold uppercase text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-pulse"></span>
                      <span>Symmetric Onboarding Active</span>
                    </div>
                  </div>

                  {/* Spotify Premium Quick Access 6-Grid */}
                  {songs.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-2 mb-6 animate-in fade-in duration-350">
                      {songs.slice(0, 6).map((s) => {
                        const isCurrent = currentSong?.id === s.id;
                        return (
                          <div 
                            key={s.id}
                            onClick={() => playTrack(s, songs)}
                            className="group relative flex items-center bg-[#1A1A22] hover:bg-[#2A2A35] transition-all duration-300 rounded-lg overflow-hidden cursor-pointer h-16 md:h-20 select-none border border-gray-900/60 hover:border-gray-800 shadow-md"
                          >
                            {/* Card Cover Art */}
                            <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-gray-950 overflow-hidden relative">
                              <img src={s.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" referrerPolicy="no-referrer" />
                              {isCurrent && (
                                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                  {isPlaying ? (
                                    <div className="flex gap-1 items-end h-4 pb-0.5">
                                      <span className="w-1 bg-brand-primary animate-pulse h-3"></span>
                                      <span className="w-1 bg-brand-primary animate-pulse h-4" style={{ animationDelay: '150ms' }}></span>
                                      <span className="w-1 bg-brand-primary animate-pulse h-2" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                  ) : (
                                    <Play className="w-4 h-4 fill-current text-brand-primary" />
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Track Details */}
                            <div className="flex-1 px-3 sm:px-4 min-w-0 pr-2 sm:pr-14">
                              <span className={`text-xs sm:text-sm font-bold truncate block ${isCurrent ? 'text-brand-primary' : 'text-gray-100'}`}>
                                {s.title}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate block mt-0.5 font-medium">
                                {s.genre || 'Composition'}
                              </span>
                            </div>

                            {/* Hover circle action play trigger */}
                            <div className="absolute right-4 opacity-0 scale-90 translate-x-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all duration-300 z-10 hidden sm:block">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playTrack(s, songs);
                                }}
                                className="w-10 h-10 rounded-full bg-brand-primary text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                                title="Listen instantly"
                              >
                                {isCurrent && isPlaying ? <Pause className="w-4.5 h-4.5 fill-current text-white" /> : <Play className="w-4.5 h-4.5 fill-current text-white ml-0.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Horizontal Scrollable Tab selectors */}
                  <div className="flex gap-2 overflow-x-auto pb-1.5 border-b border-gray-900/60 select-none">
                    {[
                      { id: 'for_you', label: 'For You' },
                      { id: 'trending', label: 'Trending Now' },
                      { id: 'new_releases', label: 'New Releases' },
                      { id: 'genres', label: 'Genres' },
                      { id: 'artists', label: 'Curators' },
                      { id: 'moods', label: 'Mood Plays' },
                      { id: 'top_charts', label: 'Top Calms' },
                      { id: 'recommended', label: 'Smart Recs' },
                      { id: 'recently_played', label: 'Recent' },
                      { id: 'liked_songs', label: 'Liked Tracks' }
                    ].map(tab => {
                      const active = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          id={`home-tab-btn-${tab.id}`}
                          onClick={() => { setActiveTab(tab.id as any); setActiveSubGenre(null); }}
                          className={`px-4.5 py-2 rounded-full text-xs font-bold font-mono transition-all flex-shrink-0 cursor-pointer ${
                            active 
                              ? 'bg-brand-primary text-white shadow shadow-brand-primary/10' 
                              : 'bg-brand-surface border border-gray-900/30 text-gray-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* TAB CONTENT RENDERS */}
                  {songs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl bg-brand-surface/60 border border-gray-905 max-w-xl mx-auto space-y-4 shadow-2xl animate-in fade-in duration-300">
                      <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary border border-brand-primary/25">
                        <Disc className="w-7 h-7 animate-spin" style={{ animationDuration: '6s' }} />
                      </div>
                      <div>
                        <h2 className="text-lg font-display font-medium text-white">No active songs in platform</h2>
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                          Your acoustic raga collection is empty by default as requested. Admin panels are open and ready for manual song uploads.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={async () => {
                            const adminEmail = 'ausiaam83@gmail.com';
                            await login(adminEmail);
                            toast.success(`Logged in as Sandbox Admin ${adminEmail}`, {
                              description: 'Go to the admin control center near your avatar to upload your first song!'
                            });
                          }}
                          className="px-5 py-2.5 bg-brand-primary text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-brand-primary/95 transition-all shadow-lg shadow-brand-primary/15"
                        >
                          <Crown className="w-4 h-4" /> Instantly Enter Admin View
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  
                  {/* T-1: FOR YOU PERSONALIZED */}
                  {activeTab === 'for_you' && (
                    <div className="space-y-8 animate-in fade-in" id="home-contents-for-you">
                      
                      {/* Recently Added Section */}
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-gray-900/40 pb-2">
                          <h3 className="font-display font-bold text-sm text-gray-200">Recently Added (Approved)</h3>
                          <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-secondary text-[9px] font-bold uppercase tracking-wider rounded border border-brand-primary/15 font-mono animate-pulse">Live Catalog</span>
                        </div>
                        {songs.length === 0 ? (
                          <div className="p-5 bg-brand-surface/40 border border-gray-900/60 rounded-xl text-center text-gray-500 font-medium font-mono text-xs">
                            No tracks in the active catalog yet. Suggest or request a song below!
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
                            {songs.slice(0, 8).map(song => (
                              <SongCard key={song.id} song={song} variant="grid" />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Your Favorite Artists Section */}
                      <div className="space-y-3.5">
                        <h3 className="font-display font-bold text-sm text-gray-200">Your Favorite Artists' Latest</h3>
                        {personalizedSongs.length === 0 ? (
                          <p className="text-xs text-gray-500 font-mono py-2">No tracked artist records yet.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {personalizedSongs.slice(0, 4).map(song => (
                              <SongCard key={song.id} song={song} variant="grid" />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Based on Mood Segment */}
                      {preferences ? (
                        <div className="space-y-3.5">
                          <h3 className="font-display font-bold text-sm text-gray-200">Because your aligned moods include: {preferences.mood.join(', ')}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {songs.filter(s => s.mood.some(m => preferences.mood.includes(m))).slice(0, 4).map(song => (
                              <SongCard key={song.id} song={song} variant="grid" />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          <h3 className="font-display font-bold text-sm text-gray-200">Recommended Healing Soundscapes</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {songs.slice(0, 4).map(song => (
                              <SongCard key={song.id} song={song} variant="grid" />
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* T-2: TRENDING TRACKS */}
                  {activeTab === 'trending' && (
                    <div className="space-y-5 animate-in fade-in" id="home-contents-trending">
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-brand-accent fill-current" />
                        <h3 className="font-display font-bold text-sm text-gray-200 uppercase tracking-wide">Most streamed compositions</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {trendingSongs.map((song, idx) => (
                          <div key={song.id} className="flex items-center gap-4.5 bg-brand-surface/40 p-3 rounded-xl border border-gray-900/60 hover:bg-brand-surface transition-all">
                            <span className="font-display font-bold text-xl md:text-2xl text-gray-600 font-mono w-8 text-center">#{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <SongCard song={song} variant="list" onSelectArtist={navigateToArtist} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* T-3: NEW RELEASES */}
                  {activeTab === 'new_releases' && (
                    <div className="space-y-6 animate-in fade-in" id="home-contents-new">
                      
                      <div className="space-y-3">
                        <h3 className="font-mono text-[10px] uppercase tracking-widest text-brand-secondary font-bold">Published This Week</h3>
                        {newReleasesThisWeek.length === 0 ? (
                          <p className="text-xs text-gray-500 font-mono py-2">No newly released tracks registered this week.</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {newReleasesThisWeek.map(song => <SongCard key={song.id} song={song} variant="grid" />)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gray-900/40">
                        <h3 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 font-bold">Lately Released (30 Days)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {newReleasesThisMonth.map(song => <SongCard key={song.id} song={song} variant="list" />)}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* T-4: GENRES */}
                  {activeTab === 'genres' && (
                    <div className="space-y-6 animate-in fade-in" id="home-contents-genres">
                      
                      {activeSubGenre ? (
                        <div className="space-y-4">
                          <button onClick={() => setActiveSubGenre(null)} className="text-xs font-bold text-brand-primary">← Back to Genre hubs</button>
                          <h3 className="font-display font-bold text-sm text-white">Tracks categorized under "{activeSubGenre}"</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {songs.filter(s => s.genre === activeSubGenre).map(song => <SongCard key={song.id} song={song} variant="list" />)}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {GENRES.map((g, idx) => {
                            const gradients = [
                              'from-brand-primary/50 to-brand-secondary/40', 'from-brand-secondary/50 to-brand-primary/40',
                              'from-brand-primary/50 to-brand-accent/40', 'from-brand-accent/50 to-brand-secondary/40',
                              'from-brand-secondary/50 to-brand-accent/40', 'from-brand-accent/50 to-brand-primary/40'
                            ];
                            const flowGrad = gradients[idx % gradients.length];
                            return (
                              <div 
                                key={g}
                                id={`genre-card-${g}`}
                                onClick={() => setActiveSubGenre(g)}
                                className={`p-6.5 rounded-xl bg-gradient-to-br ${flowGrad} border border-white/5 cursor-pointer transform hover:scale-103 duration-250 flex flex-col justify-between aspect-video relative overflow-hidden`}
                              >
                                <div className="absolute right-[-10px] bottom-[-10px] text-gray-100/10 pointer-events-none transform rotate-12">
                                  <Compass className="w-16 h-16 shrink-0" />
                                </div>
                                <h4 className="font-display font-medium text-white tracking-tight leading-none">{g}</h4>
                                <span className="text-[10px] text-white/50 font-mono">Open category</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>
                  )}

                  {/* T-5: Premium Verified Artists Grid list */}
                  {activeTab === 'artists' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 animate-in fade-in" id="home-contents-artists">
                      {artists.map(art => (
                        <div 
                          key={art.id}
                          id={`artist-avatar-card-${art.id}`}
                          onClick={() => navigateToArtist(art.id)}
                          className="bg-brand-surface/40 hover:bg-brand-surface p-4.5 rounded-xl border border-gray-900/60 hover:border-brand-primary/30 cursor-pointer transform hover:-translate-y-1 text-center transition-all flex flex-col items-center justify-between"
                        >
                          <img src={art.avatar_url} alt="" className="w-18 h-18 rounded-full border border-gray-800 object-cover shadow" />
                          <div className="mt-3.5">
                            <div className="flex items-center justify-center gap-1">
                              <p className="text-xs font-bold text-white line-clamp-1">{art.name}</p>
                              {art.verified && <Check className="w-3.5 h-3.5 text-brand-secondary inline-block shrink-0" />}
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono mt-1 capitalize leading-none">{art.follower_count.toLocaleString()} monthly</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* T-6: Curated Mood tiles */}
                  {activeTab === 'moods' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 animate-in fade-in" id="home-contents-moods">
                      {MOODS.map(m => (
                        <div 
                          key={m.name}
                          id={`home-mood-tile-${m.name}`}
                          onClick={() => {
                            // Automatically filter tracks tagged with this mood
                            setActiveTab('for_you');
                            toast.info(`Showing compositions tagged with ${m.name}`);
                          }}
                          className={`p-5 rounded-2xl bg-gradient-to-br ${m.gradient} border border-white/5 cursor-pointer transform hover:scale-103 duration-200 flex flex-col justify-between h-28 relative overflow-hidden text-white`}
                        >
                          <span>{renderMoodIconName(m.emoji, "w-8 h-8 text-white")}</span>
                          <p className="font-bold text-xs text-white leading-none mt-4 text-left">{m.name} Playboards</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* T-7: TOP CHARTS */}
                  {activeTab === 'top_charts' && (
                    <div className="space-y-4 animate-in fade-in" id="home-contents-charts">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-gray-400 font-bold">Top 20 calming sound compositions</h3>
                      <div className="space-y-2 max-w-4xl mx-auto">
                        {topChartsSongs.map((song, idx) => (
                          <SongCard key={song.id} song={song} variant="list" index={idx} onSelectArtist={navigateToArtist} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* T-8: RECOMMENDED composed tracks */}
                  {activeTab === 'recommended' && (
                    <div className="space-y-4 animate-in fade-in" id="home-contents-recs">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-brand-secondary font-bold">AI Recommended selections</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {recommendedSongs.map(song => <SongCard key={song.id} song={song} variant="grid" />)}
                      </div>
                    </div>
                  )}

                  {/* T-9: RECENTLY PLAYED */}
                  {activeTab === 'recently_played' && (
                    <div className="space-y-4 animate-in fade-in" id="home-contents-recent">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-gray-500 font-bold">Recently Played history</h3>
                      {playHistoryTracks.length === 0 ? (
                        <div className="py-12 bg-brand-surface/20 border border-gray-900 rounded-xl text-center max-w-xs mx-auto">
                          <Compass className="w-8 h-8 text-gray-700 animate-pulse mx-auto mb-2" />
                          <p className="text-xs font-semibold text-gray-400">No tracks logged in this session.</p>
                          <p className="text-[10px] text-gray-500 mt-1">Play any compose to initialize logging.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {playHistoryTracks.map((song, idx) => (
                            <SongCard key={song.id} song={song} variant="list" index={idx} onSelectArtist={navigateToArtist} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* T-10: LIKED SONGS */}
                  {activeTab === 'liked_songs' && (
                    <div className="space-y-4 animate-in fade-in" id="home-contents-liked">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-brand-accent font-bold flex items-center gap-1 font-sans">My Liked soundscapes</h3>
                      {userLikedTracks.length === 0 ? (
                        <div className="py-12 bg-brand-surface/20 border border-gray-900 rounded-xl text-center max-w-xs mx-auto">
                          <Heart className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-gray-400">No thumbs up logged yet.</p>
                          <p className="text-[10px] text-gray-500 mt-1">Click the heart button on song cards to mix.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {userLikedTracks.map((song, idx) => (
                            <SongCard key={song.id} song={song} variant="list" index={idx} onSelectArtist={navigateToArtist} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ==========================================
          MODALS INTERACTIVE POPUPS
          ========================================== */}
      
      {/* A. Create Playlist modal form */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            id="create-playlist-form"
            onSubmit={handleCreatePlaylistSubmit}
            className="w-full max-w-md bg-brand-surface border border-gray-950/80 p-6 rounded-2xl shadow-2xl relative space-y-4 text-xs select-none"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <h4 className="font-display font-bold text-sm text-white flex items-center gap-1.5"><ListMusic className="w-4.5 h-4.5 text-brand-primary" /> Curate Soundspace Slate</h4>
              <button 
                type="button" 
                onClick={() => setShowCreatePlaylistModal(false)}
                className="text-gray-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div>
              <label className="block text-gray-400 mb-1 font-bold">Collection Title *</label>
              <input 
                id="playlist-form-title"
                type="text"
                required
                placeholder="e.g. Rainy Sunday Evening Flute"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                className="w-full bg-brand-bg p-2.5 rounded border border-gray-850 text-white" 
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-1 font-semibold">Description</label>
              <textarea 
                id="playlist-form-desc"
                placeholder="A customized sound alignment containing morning/night compositions..."
                rows={3}
                value={newPlaylistDesc}
                onChange={(e) => setNewPlaylistDesc(e.target.value)}
                className="w-full bg-brand-bg p-2 text-[11px] rounded border border-gray-850 text-white whitespace-pre-wrap leading-normal"
              ></textarea>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input 
                  type="checkbox" 
                  checked={newPlaylistPublic} 
                  onChange={(e) => setNewPlaylistPublic(e.target.checked)}
                  className="accent-brand-primary w-4 h-4 rounded" 
                />
                Public collection
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input 
                  type="checkbox" 
                  checked={newPlaylistCollab} 
                  onChange={(e) => setNewPlaylistCollab(e.target.checked)}
                  className="accent-brand-primary w-4 h-4 rounded" 
                />
                Collaborative Slate
              </label>
            </div>

            <button 
              id="playlist-form-submit"
              type="submit" 
              className="w-full py-2.5 text-center bg-brand-primary text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-brand-primary/95 transition-all shadow"
            >
              Delineate and Publish collection
            </button>
          </form>
        </div>
      )}

      {/* Mobile Interactive Bottom Navigation Bar */}
      <nav id="mobile-bottom-navigation-bar" className="fixed bottom-0 left-0 right-0 h-14 bg-brand-surface border-t border-gray-950 flex items-center justify-around px-2 z-45 md:hidden select-none shadow-xl">
        {[
          { id: 'home', label: 'Browse', icon: Compass },
          { id: 'search', label: 'Search', icon: Search },
          { id: 'playlists', label: 'My Slates', icon: ListMusic },
          ...(currentUser?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: Settings }] : []),
          { id: 'profile', label: 'Profile', icon: User }
        ].map(opt => {
          const Icon = opt.icon;
          const active = currentSection === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => {
                setCurrentSection(opt.id as any);
                setSelectedArtistId(null);
                setSelectedAlbumId(null);
                setSelectedPlaylistId(null);
              }}
              className={`flex flex-col items-center justify-center gap-1.5 flex-1 py-1 transition-all cursor-pointer ${
                active ? 'text-brand-primary' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-bold font-sans tracking-wide leading-none">{opt.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Persistent global audio streams controller bottom panel */}
      <AudioPlayer />
      <YoutubePlayerBridge />

      {/* ==========================================
          INTERACTIVE HEALER AI SOUNDBOT - BOTTOM RIGHT
          ========================================== */}
      <div 
        id="healers-ai-bot-root" 
        className="fixed bottom-36 right-4 md:bottom-24 md:right-8 z-48 select-none"
      >
        {/* Pulsing launcher button if bot is NOT open */}
        {!showAiBot ? (
          <button
            id="healers-ai-bot-trigger"
            onClick={() => {
              if (currentUser) {
                setRequestEmail(currentUser.email);
              }
              setShowAiBot(true);
              setBotStep(0);
            }}
            className="relative p-3 rounded-full bg-brand-primary text-white border-2 border-brand-primary/40 shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer group flex items-center justify-center animate-bounce-short"
            title="Ask Purple Heart AI Soundbot"
          >
            {/* Pulsing halo */}
            <span className="absolute inset-0 rounded-full bg-brand-primary/30 animate-pulse opacity-75"></span>
            <Bot className="w-6 h-6 shrink-0 relative z-10" />
            
            {/* Hover tooltip label */}
            <span className="absolute right-14 bg-brand-surface border border-gray-900 text-[10px] text-gray-200 py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-md font-bold uppercase whitespace-nowrap tracking-wide leading-none">
              Acoustic AI Helper
            </span>
          </button>
        ) : (
          /* Real-time conversational dialogue panel card */
          <div 
            id="healers-ai-bot-container"
            className="w-[280px] sm:w-[340px] bg-brand-surface border border-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans animate-in slide-in-from-bottom-5 duration-300"
          >
            {/* Header section with live status indicator */}
            <div className="bg-brand-bg px-4 py-3 border-b border-gray-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-secondary border border-brand-primary/30">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-brand-secondary border border-brand-bg " />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white font-display">Prana AI</h4>
                  <span className="text-[8px] text-gray-400 font-mono tracking-wider block">CURATION ASSISTANT</span>
                </div>
              </div>
              <button 
                onClick={() => setShowAiBot(false)}
                className="p-1 px-1.5 hover:bg-gray-800/40 text-gray-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Scrolling Body */}
            <div className="max-h-[380px] overflow-y-auto p-4 space-y-3.5 bg-brand-surface/40">
              
              {/* Bot greeting */}
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-primary/10 border border-brand-primary/25 text-brand-secondary text-[9px] font-bold flex items-center justify-center mt-1 shrink-0 font-mono">
                  AI
                </div>
                <div className="bg-brand-bg/90 border border-gray-950/40 rounded-2xl rounded-tl-none p-3 text-xs text-gray-300 leading-relaxed max-w-[85%] shadow-sm font-sans space-y-1">
                  {botStep === 0 && (
                    <p>
                      Hello! I am Prana AI, your curation assistant. If you would like to suggest a classical raga, devotional bhajan, or acoustic track to our collection, please let me know.
                    </p>
                  )}
                  {botStep === 1 && (
                    <p>
                      Please fill out the beautiful <b>Song Request Form</b> below. I will hand over your suggestion to our administrators for instant AI fetching and publication!
                    </p>
                  )}
                  {botStep === 7 && (
                    <p>
                      Your request has been successfully submitted! Our curating moderators will review it and notify you automatically once live on the app.
                    </p>
                  )}
                </div>
              </div>

              {/* Bot-guided form steps inside the chat flow */}
              <div className="space-y-3 pl-8 text-xs">
                {botStep === 0 && (
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setBotStep(1)}
                      className="w-full text-left p-2.5 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 hover:border-brand-primary text-brand-secondary rounded-xl font-bold font-sans transition-all cursor-pointer flex items-center gap-1.5 justify-between"
                    >
                      <span>Suggest a New Song</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => toast.info('Purple Heart streams high-resolution classical loops custom aligned with your active hours of focus.')}
                      className="w-full text-left p-2.5 bg-brand-bg hover:bg-black/20 border border-gray-950 text-gray-300 rounded-xl font-medium transition-all cursor-pointer flex items-center justify-between"
                    >
                      <span>How does Purple Heart work?</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setShowAiBot(false)}
                      className="w-full text-left p-2 bg-brand-surface hover:bg-black/20 border border-gray-950 text-gray-500 rounded-xl font-medium transition-all cursor-pointer text-center text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {botStep === 1 && (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!requestYoutubeUrl.trim()) {
                        toast.error('YouTube URL is required.');
                        return;
                      }
                      await handleRequestSubmit(e);
                    }}
                    className="space-y-3 bg-brand-bg/30 border border-gray-900/60 p-3.5 rounded-xl text-left"
                  >
                    <div>
                      <label className="block text-gray-400 mb-1 font-bold text-[10px]">YouTube URL *</label>
                      <input 
                        type="url"
                        required
                        className="w-full bg-brand-bg/85 border border-gray-800 rounded-lg p-2 text-white placeholder-gray-600 outline-none focus:border-brand-primary text-xs font-mono"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={requestYoutubeUrl}
                        onChange={(e) => setRequestYoutubeUrl(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-950/60 font-sans">
                      <button 
                        type="button"
                        onClick={() => setBotStep(0)} 
                        className="text-[10px] text-gray-400 font-bold hover:underline"
                      >
                        ← Back
                      </button>
                      <button 
                        type="submit"
                        disabled={isSubmittingRequest || !requestYoutubeUrl.trim()}
                        className="px-4 py-2 bg-brand-secondary text-brand-bg font-bold rounded-xl cursor-pointer text-[10px] hover:scale-[1.02] active:scale-98 transition-transform disabled:opacity-45 flex items-center gap-1"
                      >
                        {isSubmittingRequest ? 'Sending...' : 'Submit Request ✓'}
                      </button>
                    </div>
                  </form>
                )}

                {botStep === 7 && (
                  <div className="text-center pt-1 pr-6">
                    <button 
                      onClick={() => {
                        setBotStep(0);
                        setShowAiBot(false);
                      }}
                      className="px-5 py-2 bg-brand-primary text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-103 cursor-pointer text-[11px]"
                    >
                      Breathe in Peace
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>


      {/* MODAL 2: Nodemailer Raga Song Request form */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm p-6 bg-brand-surface border border-gray-900 rounded-2xl shadow-2xl space-y-5">
            
            <button
              onClick={() => setShowRequestModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 hover:bg-gray-800/40 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-display font-medium text-white tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-primary" /> Request a Song
              </h3>
              <p className="text-xs text-gray-400 leading-normal mt-1">
                Your target track suggestion will be sent to the moderation panel for automated curation and instant streaming!
              </p>
            </div>

            <form onSubmit={handleRequestSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-gray-400 mb-1.5 font-bold">YouTube URL *</label>
                <input 
                  type="url"
                  required
                  placeholder="e.g. https://www.youtube.com/watch?v=..."
                  value={requestYoutubeUrl}
                  onChange={(e) => setRequestYoutubeUrl(e.target.value)}
                  className="w-full bg-brand-bg/40 border border-gray-800 focus:border-brand-primary rounded-lg p-2.5 text-white font-mono placeholder-gray-650" 
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmittingRequest || !requestYoutubeUrl.trim()}
                className="w-full py-2.5 text-center bg-brand-primary rounded-xl text-white font-bold cursor-pointer hover:bg-brand-primary/95 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 text-white" />
                {isSubmittingRequest ? 'Submitting Request...' : 'Submit Request'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: Guest Listening Daily Plays Limit Warning Dialog */}
      {guestLimitReached && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm p-6 text-center bg-brand-surface border border-gray-900 rounded-3xl space-y-5">
            <div className="w-16 h-16 bg-brand-accent/10 border border-brand-accent rounded-full flex items-center justify-center mx-auto text-brand-accent">
              <Lock className="w-8 h-8 animate-pulse text-brand-accent" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-display font-bold text-white tracking-wide">Daily Alignment Limit Met</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                You have streamed your maximum daily limit of six free therapeutic raga tracks under a guest account. 
              </p>
              <p className="text-[11px] text-brand-secondary/80 leading-relaxed font-semibold">
                You can wait to listen tomorrow, or connect a synchronized Soul account instantly for unlimited free acoustic streaming!
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  setGuestLimitReached(false);
                  setAuthMode('signup');
                  setCurrentSection('auth');
                }}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg hover:scale-101 transition-transform"
              >
                Connect Free Soul Account
              </button>

              <button 
                onClick={() => setGuestLimitReached(false)}
                className="w-full py-2 text-gray-500 hover:text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
