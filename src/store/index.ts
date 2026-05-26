import { create } from 'zustand';
import { 
  User, UserPreferences, Artist, Album, Song, Playlist, PlaylistSong, 
  LikedSong, PlayHistory, Follower, ListeningTimePreference 
} from '../types';
import { INITIAL_ARTISTS, INITIAL_ALBUMS, INITIAL_SONGS } from '../data';
import { syncHelper, isSupabaseConfigured, supabase } from '../lib/supabase';

// Singleton browser audio element for music playback
let audioInstance: HTMLAudioElement | null = null;
if (typeof window !== 'undefined') {
  audioInstance = new Audio();
}

// Top level variables for Supabase Realtime playback sync
const clientSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'cs-' + Math.random().toString(36).substring(2, 11);
let activePlaybackChannel: any = null;
let isIncomingSyncEvent = false;

interface HealersStore {
  // Auth & User Sessions
  currentUser: User | null;
  preferences: UserPreferences | null;
  onboardingStep: number; // For managing global multi-step onboarding
  isOnboarded: boolean;
  bannedUserIds: string[];

  // Database lists
  users: User[];
  artists: Artist[];
  albums: Album[];
  songs: Song[];
  playlists: Playlist[];
  playlistSongs: PlaylistSong[];
  likedSongs: LikedSong[];
  playHistory: PlayHistory[];
  followers: Follower[];

  // Theme state
  isLightMode: boolean;

  // Guest Listening limits state
  guestLimitReached: boolean;
  setGuestLimitReached: (reached: boolean) => void;

  // Music Player state
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  playedSeconds: number;
  totalSeconds: number;
  playbackQueue: Song[];
  originalQueue: Song[];
  queueIndex: number;
  isShuffle: boolean;
  isRepeat: 'none' | 'all' | 'one';
  showFullscreenPlayer: boolean;
  youtubeSeekSignal?: number | null;

  // Real-time Playback Synchronization state
  playbackSyncRoomId: string;
  isPlaybackSyncEnabled: boolean;
  setPlaybackSyncRoomId: (roomId: string) => void;
  setPlaybackSyncEnabled: (enabled: boolean) => void;
  broadcastPlaybackEvent: (event: 'play' | 'pause' | 'seek', data?: any) => void;
  subscribeToPlaybackSync: () => (() => void);

  // Actions
  toggleTheme: () => void;
  
  // Auth Actions
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, fullName: string, password?: string, avatarUrl?: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean }>;
  logout: () => Promise<void>;
  savePreferences: (prevs: Omit<UserPreferences, 'id' | 'user_id' | 'created_at'>) => void;
  updateProfile: (fullName: string, avatarUrl: string) => void;

  // Interactions
  toggleLikeSong: (songId: string) => void;
  toggleFollowArtist: (artistId: string) => void;
  
  // Playlists
  createPlaylist: (title: string, description: string, coverImage: string, isPublic: boolean, isCollaborative?: boolean) => string;
  deletePlaylist: (playlistId: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  reorderPlaylist: (playlistId: string, songId: string, direction: 'up' | 'down') => void;

  // Player Controls
  playTrack: (song: Song, customQueue?: Song[]) => void;
  togglePlayPause: () => void;
  setVolume: (vol: number) => void;
  seek: (seconds: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: 'none' | 'all' | 'one') => void;
  setShowFullscreenPlayer: (show: boolean) => void;
  addSongToQueue: (song: Song) => void;
  clearQueue: () => void;

  // Admin Controls
  addSong: (songData: Omit<Song, 'id' | 'play_count' | 'like_count' | 'created_at'>) => void;
  editSong: (songId: string, songData: Partial<Song>) => void;
  deleteSong: (songId: string) => void;
  deleteSongsBulk: (songIds: string[]) => void;
  
  addAlbum: (albumData: Omit<Album, 'id' | 'created_at'>) => void;
  editAlbum: (albumId: string, albumData: Partial<Album>) => void;
  deleteAlbum: (albumId: string) => void;

  addArtist: (artistData: Omit<Artist, 'id' | 'created_at' | 'follower_count'>) => void;
  editArtist: (artistId: string, artistData: Partial<Artist>) => void;
  deleteArtist: (artistId: string) => void;

  updateUserRole: (userId: string, role: 'user' | 'admin') => void;
  toggleBanUser: (userId: string) => void;

  // Internal audio-binder initializer
  initAudioListeners: () => void;
  recordPlayMetric: (songId: string) => void;
  syncUserHistoryFromSupabase: () => Promise<void>;
}

// Safe utility to read active Supabase authenticated user ID synchronously from localStorage with zero latency.
export function getSupabaseAuthUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const value = localStorage.getItem(key);
        if (value) {
          const parsed = JSON.parse(value);
          if (parsed && parsed.user && parsed.user.id) {
            return parsed.user.id;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Supabase Auth ID Local Sync Error]:', e);
  }
  return null;
}

// standard mini helper to build a valid random/conforming UUID-v4 format for clients
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Read database or fallback to seeded data
const getStored = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const item = localStorage.getItem(`healers_${key}`);
  return item ? JSON.parse(item) : defaultValue;
};

const setStored = (key: string, value: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`healers_${key}`, JSON.stringify(value));
  }
};

export const useHealersStore = create<HealersStore>((set, get) => {
  
  // Set up standard default test account values mapped strictly to valid UUID shapes
  const resolvedAdminId = (isSupabaseConfigured && getSupabaseAuthUserId()) || 'ad000000-ad0a-4000-ad0a-000000000000';
  const resolvedUserId = '00000000-0000-4000-a000-000000000001';

  const defaultUsers: User[] = [
    {
      id: resolvedAdminId,
      email: 'ausiaam83@gmail.com', // Matching current user email so they can log in instantly!
      full_name: 'Healers Founder',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
      role: 'admin',
      created_at: '2026-05-01T00:00:00Z'
    },
    {
      id: resolvedUserId,
      email: 'user@healers.com',
      full_name: 'Peaceful Listener',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop',
      role: 'user',
      created_at: '2026-05-10T12:00:00Z'
    }
  ];

  // Load database arrays - fall back to seeded initial arrays so they show by default!
  let artists = getStored<Artist[]>('artists', []);
  if (artists.length === 0) {
    artists = INITIAL_ARTISTS;
    setStored('artists', artists);
  }

  let albums = getStored<Album[]>('albums', []);
  if (albums.length === 0) {
    albums = INITIAL_ALBUMS;
    setStored('albums', albums);
  }

  let songs = getStored<Song[]>('songs', []);
  if (songs.length === 0) {
    songs = INITIAL_SONGS;
    setStored('songs', songs);
  }
  const playlists = getStored<Playlist[]>('playlists', []);
  const playlistSongs = getStored<PlaylistSong[]>('playlist_songs', []);
  const likedSongs = getStored<LikedSong[]>('liked_songs', []);
  const playHistory = getStored<PlayHistory[]>('play_history', []);
  const followers = getStored<Follower[]>('followers', []);
  const users = getStored<User[]>('users', defaultUsers);
  const bannedUserIds = getStored<string[]>('banned_user_ids', []);

  // Current session information
  let currentUser = getStored<User | null>('current_user', null);
  
  // Real-time migration to upgrade any stale or legacy mock string IDs to compliant UUID configurations
  if (currentUser) {
    if (currentUser.id === 'usr-admin') {
      currentUser.id = resolvedAdminId;
      setStored('current_user', currentUser);
    } else if (currentUser.id === 'usr-1') {
      currentUser.id = resolvedUserId;
      setStored('current_user', currentUser);
    }
  }

  const preferences = getStored<UserPreferences | null>('preferences', null);
  const isOnboarded = getStored<boolean>('is_onboarded', false);
  const isLightMode = getStored<boolean>('is_light_mode', false);

  return {
    currentUser,
    preferences,
    onboardingStep: 1,
    isOnboarded,
    bannedUserIds,

    users,
    artists,
    albums,
    songs,
    playlists,
    playlistSongs,
    likedSongs,
    playHistory,
    followers,

    isLightMode,
    guestLimitReached: false,
    setGuestLimitReached: (reached) => set({ guestLimitReached: reached }),

    // Playback state
    currentSong: null,
    isPlaying: false,
    volume: 0.8,
    playedSeconds: 0,
    totalSeconds: 0,
    playbackQueue: [],
    originalQueue: [],
    queueIndex: -1,
    isShuffle: false,
    isRepeat: 'none',
    showFullscreenPlayer: false,

    // Real-time Playback Sync
    playbackSyncRoomId: 'general-listening',
    isPlaybackSyncEnabled: true,

    toggleTheme: () => {
      const target = !get().isLightMode;
      set({ isLightMode: target });
      setStored('is_light_mode', target);
    },

    // Auth Actions
    login: async (email, password = '') => {
      const cleaned = email.toLowerCase().trim();
      const bannedList = get().bannedUserIds;
      let existingUser: User | null = null;

      if (isSupabaseConfigured && supabase) {
        try {
          // Attempt authentic sign in via Supabase Auth
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleaned,
            password: password
          });

          if (authError) {
            return { success: false, error: authError.message };
          }

          if (!authData.user) {
            return { success: false, error: 'User session not found.' };
          }

          // Force check if email needs verification and user is not verified
          if (!authData.user.email_confirmed_at) {
            return { 
              success: false, 
              error: 'Please verify your email address before logging in. A confirmation link was sent to your inbox.' 
            };
          }

          // Find role from healers_users DB table
          const { data: dbUser, error: dbError } = await supabase
            .from('healers_users')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (dbUser) {
            existingUser = {
              id: dbUser.id,
              email: dbUser.email,
              full_name: dbUser.full_name,
              avatar_url: dbUser.avatar_url,
              role: dbUser.role || 'user',
              created_at: dbUser.created_at
            };
          } else {
            // Fallback: if not registered in tables, auto-upsert as basic 'user'
            const newUserObj = {
              id: authData.user.id,
              email: cleaned,
              full_name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || 'Peaceful Listener',
              avatar_url: authData.user.user_metadata?.avatar_url || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop`,
              role: 'user',
              created_at: authData.user.created_at || new Date().toISOString()
            };
            await syncHelper.syncUser(newUserObj);
            existingUser = newUserObj as any;
          }
        } catch (err: any) {
          console.error('[Supabase Auth Login Error]:', err);
          return { success: false, error: err.message || 'An error occurred during Supabase authentication.' };
        }
      } else {
        // --- Fallback Local Mock Mode ---
        const userList = get().users;
        const mockUserRecords = getStored<any[]>('mock_user_passwords', []);
        
        const matchedRecord = mockUserRecords.find(r => r.email.toLowerCase() === cleaned);
        if (!matchedRecord) {
          const basicUser = userList.find(u => u.email.toLowerCase() === cleaned);
          if (basicUser) {
            existingUser = basicUser;
          } else {
            return { success: false, error: 'User registration not found. Please sign up to create your profile.' };
          }
        } else {
          if (matchedRecord.password !== password) {
            return { success: false, error: 'Incorrect email or password. Please try again.' };
          }
          existingUser = {
            id: matchedRecord.id,
            email: matchedRecord.email,
            full_name: matchedRecord.full_name,
            avatar_url: matchedRecord.avatar_url,
            role: matchedRecord.role || 'user',
            created_at: matchedRecord.created_at
          };
        }
      }

      // Check if user is banned
      if (existingUser && bannedList.includes(existingUser.id)) {
        return { success: false, error: 'Your account is currently disabled/banned by an administrator.' };
      }

      if (existingUser) {
        // Force matching default admin logic if relevant
        if (cleaned === 'ausiaam83@gmail.com') {
          existingUser.role = 'admin';
        }

        set({ currentUser: existingUser });
        setStored('current_user', existingUser);

        // Fetch or create user preferences
        const prefsList = getStored<UserPreferences[]>('all_preferences', []);
        let userPrefs = prefsList.find(p => p.user_id === existingUser!.id);
        
        if (isSupabaseConfigured) {
          try {
            const dbPrefs = await syncHelper.fetchPreferences(existingUser!.id);
            if (dbPrefs) {
              userPrefs = dbPrefs as any;
            }
          } catch(e) {}
        }

        if (!userPrefs) {
          userPrefs = {
            id: `pref-${Date.now()}`,
            user_id: existingUser!.id,
            favorite_artists: [get().artists[0]?.id || 'art-1', get().artists[1]?.id || 'art-2'],
            favorite_genres: ['Calming', 'Nature'],
            listening_time: 'anytime',
            mood: ['Focus', 'Relax'],
            created_at: new Date().toISOString()
          };
          const updatedPrefsList = [...prefsList, userPrefs];
          setStored('all_preferences', updatedPrefsList);
        }

        set({ preferences: userPrefs, isOnboarded: true });
        setStored('preferences', userPrefs);
        setStored('is_onboarded', true);

        // Fetch user history from Supabase if connected
        if (isSupabaseConfigured) {
          get().syncUserHistoryFromSupabase().catch(err => {
            console.error('Failed to sync history after logging in:', err);
          });
        }

        return { success: true };
      }

      return { success: false, error: 'Authorization failed.' };
    },

    signup: async (email, fullName, password = '', avatarUrl) => {
      const cleaned = email.toLowerCase().trim();
      const userList = get().users;
      const parsedAvatar = avatarUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop`;

      const isDefaultAdmin = cleaned === 'ausiaam83@gmail.com';
      const defaultRole = isDefaultAdmin ? 'admin' : 'user'; // automatic role user

      if (isSupabaseConfigured && supabase) {
        try {
          // Supabase Auth Sign Up
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: cleaned,
            password: password,
            options: {
              data: {
                full_name: fullName,
                avatar_url: parsedAvatar,
                role: defaultRole
              }
            }
          });

          if (authError) {
            return { success: false, error: authError.message };
          }

          if (!authData.user) {
            return { success: false, error: 'Sign up failed to generate an authenticated user.' };
          }

          // Register in DB healers_users Table
          const newUser: User = {
            id: authData.user.id,
            email: cleaned,
            full_name: fullName,
            avatar_url: parsedAvatar,
            role: defaultRole,
            created_at: authData.user.created_at || new Date().toISOString()
          };

          await syncHelper.syncUser(newUser);

          if (authData.session) {
            set({ currentUser: newUser, preferences: null, isOnboarded: false });
            setStored('current_user', newUser);
            setStored('preferences', null);
            setStored('is_onboarded', false);
            return { success: true };
          } else {
            // Emits standard requirement for verification
            return { 
              success: true, 
              requiresVerification: true, 
              error: 'Successfully registered! A verification link was sent to your email. Please verify before signing in.' 
            };
          }
        } catch (err: any) {
          console.error('[Supabase Auth Sign Up Error]:', err);
          return { success: false, error: err.message || 'An error occurred during registration.' };
        }
      } else {
        // --- Fallback Local Mock Mode ---
        const existingInList = userList.find(u => u.email.toLowerCase() === cleaned);
        if (existingInList) {
          return { success: false, error: 'This email is already registered.' };
        }

        const mockUserId = generateUUID();
        const newUser: User = {
          id: mockUserId,
          email: cleaned,
          full_name: fullName,
          avatar_url: parsedAvatar,
          role: defaultRole,
          created_at: new Date().toISOString()
        };

        // Cache simulated secure password
        const mockUserRecords = getStored<any[]>('mock_user_passwords', []);
        mockUserRecords.push({
          id: mockUserId,
          email: cleaned,
          full_name: fullName,
          avatar_url: parsedAvatar,
          role: defaultRole,
          password: password,
          created_at: newUser.created_at
        });
        setStored('mock_user_passwords', mockUserRecords);

        const updatedUsers = [...userList, newUser];
        set({ users: updatedUsers, currentUser: newUser, preferences: null, isOnboarded: false });
        setStored('users', updatedUsers);
        setStored('current_user', newUser);
        setStored('preferences', null);
        setStored('is_onboarded', false);

        return { success: true };
      }
    },

    logout: async () => {
      if (audioInstance) {
        audioInstance.pause();
      }
      
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.auth.signOut();
        } catch(e) {
          console.warn('[Supabase SignOut Error]:', e);
        }
      }

      set({ currentUser: null, preferences: null, isOnboarded: false, currentSong: null, isPlaying: false });
      setStored('current_user', null);
      setStored('preferences', null);
      setStored('is_onboarded', false);
    },

    savePreferences: (prevs) => {
      const user = get().currentUser;
      if (!user) return;

      const newPrefs: UserPreferences = {
        id: `pref-${Date.now()}`,
        user_id: user.id,
        favorite_artists: prevs.favorite_artists,
        favorite_genres: prevs.favorite_genres,
        listening_time: prevs.listening_time,
        mood: prevs.mood,
        created_at: new Date().toISOString()
      };

      // Store in all preferences list
      const allPrefs = getStored<UserPreferences[]>('all_preferences', []);
      const filtered = allPrefs.filter(p => p.user_id !== user.id);
      const updatedPrefs = [...filtered, newPrefs];
      
      setStored('all_preferences', updatedPrefs);
      set({ preferences: newPrefs, isOnboarded: true });
      setStored('preferences', newPrefs);
      setStored('is_onboarded', true);

      // Synchronize in background if Supabase is connected
      syncHelper.syncPreferences(newPrefs);
    },

    updateProfile: (fullName, avatarUrl) => {
      const user = get().currentUser;
      if (!user) return;

      const updatedUser: User = {
        ...user,
        full_name: fullName,
        avatar_url: avatarUrl || user.avatar_url
      };

      const userList = get().users.map(u => u.id === user.id ? updatedUser : u);
      set({ currentUser: updatedUser, users: userList });
      setStored('current_user', updatedUser);
      setStored('users', userList);

      // Synchronize in background if Supabase is connected
      syncHelper.syncUser(updatedUser);
    },

    // Interactions: Like Song
    toggleLikeSong: (songId) => {
      const user = get().currentUser;
      if (!user) return;

      const likes = get().likedSongs;
      const isLiked = likes.some(l => l.user_id === user.id && l.song_id === songId);

      let newLikes: LikedSong[];
      if (isLiked) {
        newLikes = likes.filter(l => !(l.user_id === user.id && l.song_id === songId));
      } else {
        newLikes = [...likes, {
          id: `like-${Date.now()}`,
          user_id: user.id,
          song_id: songId,
          created_at: new Date().toISOString()
        }];
      }

      // Update liked counts in songs database as well!
      const updatedSongs = get().songs.map(s => {
        if (s.id === songId) {
          return {
            ...s,
            like_count: Math.max(0, s.like_count + (isLiked ? -1 : 1))
          };
        }
        return s;
      });

      set({ likedSongs: newLikes, songs: updatedSongs });
      setStored('liked_songs', newLikes);
      setStored('songs', updatedSongs);
    },

    // Follow Artist
    toggleFollowArtist: (artistId) => {
      const user = get().currentUser;
      if (!user) return;

      const follows = get().followers;
      const isFollowing = follows.some(f => f.follower_id === user.id && f.artist_id === artistId);

      let newFollows: Follower[];
      if (isFollowing) {
        newFollows = follows.filter(f => !(f.follower_id === user.id && f.artist_id === artistId));
      } else {
        newFollows = [...follows, {
          id: `foll-${Date.now()}`,
          follower_id: user.id,
          artist_id: artistId,
          created_at: new Date().toISOString()
        }];
      }

      // Update followers count in artists database
      const updatedArtists = get().artists.map(a => {
        if (a.id === artistId) {
          return {
            ...a,
            follower_count: Math.max(0, a.follower_count + (isFollowing ? -1 : 1))
          };
        }
        return a;
      });

      set({ followers: newFollows, artists: updatedArtists });
      setStored('followers', newFollows);
      setStored('artists', updatedArtists);
    },

    // Playlist Management
    createPlaylist: (title, description, coverImage, isPublic, isCollaborative = false) => {
      const user = get().currentUser;
      if (!user) return '';

      const newPlaylist: Playlist = {
        id: `ply-${Date.now()}`,
        user_id: user.id,
        title,
        description: description || 'A serene personal collection',
        cover_image: coverImage || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=50',
        is_public: isPublic,
        is_collaborative: isCollaborative,
        songs_count: 0,
        created_at: new Date().toISOString()
      };

      const updatedPlaylists = [newPlaylist, ...get().playlists];
      set({ playlists: updatedPlaylists });
      setStored('playlists', updatedPlaylists);
      return newPlaylist.id;
    },

    deletePlaylist: (playlistId) => {
      const updatedPlaylists = get().playlists.filter(p => p.id !== playlistId);
      const updatedPlaylistSongs = get().playlistSongs.filter(ps => ps.playlist_id !== playlistId);
      
      set({ playlists: updatedPlaylists, playlistSongs: updatedPlaylistSongs });
      setStored('playlists', updatedPlaylists);
      setStored('playlist_songs', updatedPlaylistSongs);
    },

    addSongToPlaylist: (playlistId, songId) => {
      const currentListSongs = get().playlistSongs;
      const currentList = currentListSongs.filter(ps => ps.playlist_id === playlistId);
      
      // Ensure we don't add duplicate songs to the playlist
      if (currentList.some(ps => ps.song_id === songId)) return;

      const newPS: PlaylistSong = {
        id: `plysng-${Date.now()}`,
        playlist_id: playlistId,
        song_id: songId,
        position: currentList.length + 1,
        added_at: new Date().toISOString()
      };

      const updatedPS = [...currentListSongs, newPS];
      
      // Increment playlist song count
      const updatedPlaylists = get().playlists.map(p => {
        if (p.id === playlistId) {
          return { ...p, songs_count: p.songs_count + 1 };
        }
        return p;
      });

      set({ playlistSongs: updatedPS, playlists: updatedPlaylists });
      setStored('playlist_songs', updatedPS);
      setStored('playlists', updatedPlaylists);
    },

    removeSongFromPlaylist: (playlistId, songId) => {
      const filteredPS = get().playlistSongs.filter(ps => !(ps.playlist_id === playlistId && ps.song_id === songId));
      
      // Re-index remaining positions
      const playlistTracks = filteredPS.filter(ps => ps.playlist_id === playlistId)
        .sort((a,b) => a.position - b.position)
        .map((ps, idx) => ({ ...ps, position: idx + 1 }));
      
      const fullyUpdatedPS = [
        ...filteredPS.filter(ps => ps.playlist_id !== playlistId),
        ...playlistTracks
      ];

      // Decrement playlist song count
      const updatedPlaylists = get().playlists.map(p => {
        if (p.id === playlistId) {
          return { ...p, songs_count: Math.max(0, p.songs_count - 1) };
        }
        return p;
      });

      set({ playlistSongs: fullyUpdatedPS, playlists: updatedPlaylists });
      setStored('playlist_songs', fullyUpdatedPS);
      setStored('playlists', updatedPlaylists);
    },

    reorderPlaylist: (playlistId, songId, direction) => {
      const allPlaylistSongs = get().playlistSongs;
      const targetTracks = allPlaylistSongs.filter(ps => ps.playlist_id === playlistId)
        .sort((a,b) => a.position - b.position);

      const songIdx = targetTracks.findIndex(ps => ps.song_id === songId);
      if (songIdx === -1) return;

      const targetIdx = direction === 'up' ? songIdx - 1 : songIdx + 1;
      if (targetIdx < 0 || targetIdx >= targetTracks.length) return; // Boundary lock

      // Swap position metrics
      const temp = targetTracks[songIdx].song_id;
      targetTracks[songIdx].song_id = targetTracks[targetIdx].song_id;
      targetTracks[targetIdx].song_id = temp;

      const updatedAll = [
        ...allPlaylistSongs.filter(ps => ps.playlist_id !== playlistId),
        ...targetTracks
      ];

      set({ playlistSongs: updatedAll });
      setStored('playlist_songs', updatedAll);
    },

    // Sound Player Implementations
    initAudioListeners: () => {
      if (!audioInstance) return;

      audioInstance.addEventListener('timeupdate', () => {
        set({ playedSeconds: audioInstance?.currentTime || 0 });
      });

      audioInstance.addEventListener('durationchange', () => {
        set({ totalSeconds: audioInstance?.duration || 0 });
      });

      audioInstance.addEventListener('ended', () => {
        const { isRepeat, currentSong } = get();
        if (isRepeat === 'one' && currentSong) {
          // Re-play same
          if (audioInstance) {
            audioInstance.currentTime = 0;
            audioInstance.play().catch(err => console.log('Audio Autoplay Blocked:', err));
          }
        } else {
          get().nextTrack();
        }
      });
    },

    playTrack: (song, customQueue) => {
      if (!audioInstance) return;

      // Intercept guest play limits
      const user = get().currentUser;
      if (!user) {
        if (typeof window !== 'undefined') {
          const todayStr = new Date().toLocaleDateString();
          const storedDate = localStorage.getItem('healers_guest_plays_date');
          let guestCount = 0;

          if (storedDate === todayStr) {
            guestCount = parseInt(localStorage.getItem('healers_guest_num_plays') || '0', 10);
          } else {
            localStorage.setItem('healers_guest_plays_date', todayStr);
            localStorage.setItem('healers_guest_num_plays', '0');
          }

          if (guestCount >= 6) {
            set({ guestLimitReached: true });
            return;
          }

          // Count play
          const nextCount = guestCount + 1;
          localStorage.setItem('healers_guest_num_plays', nextCount.toString());
        }
      }

      const current = get().currentSong;
      
      // If toggling exactly the same song, play or pause
      if (current && current.id === song.id) {
        get().togglePlayPause();
        return;
      }

      // Handle new context queue
      let finalQueue = customQueue || get().playbackQueue;
      if (finalQueue.length === 0 || !finalQueue.some(s => s.id === song.id)) {
        finalQueue = [song, ...finalQueue.filter(s => s.id !== song.id)];
      }

      const songIndex = finalQueue.findIndex(s => s.id === song.id);
      const isYt = !!song.youtube_url;

      set({
        currentSong: song,
        isPlaying: true,
        playbackQueue: finalQueue,
        originalQueue: customQueue ? [...customQueue] : get().originalQueue.length ? get().originalQueue : [song],
        queueIndex: songIndex,
        playedSeconds: 0,
        totalSeconds: song.duration_seconds || song.audio_duration || 240,
        youtubeSeekSignal: null
      });

      if (isYt) {
        if (audioInstance) {
          audioInstance.pause();
          audioInstance.src = "";
        }
        get().recordPlayMetric(song.id);
      } else {
        if (audioInstance) {
          audioInstance.src = song.audio_url;
          audioInstance.volume = get().volume;
          
          audioInstance.play()
            .then(() => {
              get().recordPlayMetric(song.id);
            })
            .catch(err => {
              console.warn('Playback error, browser may require initial engagement:', err);
              set({ isPlaying: false });
            });
        }
      }

      // Sync broadcast
      if (!isIncomingSyncEvent) {
        get().broadcastPlaybackEvent('play', { queue: finalQueue });
      }
    },

    togglePlayPause: () => {
      const { isPlaying, currentSong, songs } = get();

      if (!currentSong) {
        // Fallback to playing first song in DB
        const firstSong = songs[0];
        if (firstSong) {
          get().playTrack(firstSong, songs);
        }
        return;
      }

      const isYt = !!currentSong.youtube_url;

      if (isPlaying) {
        if (!isYt && audioInstance) {
          audioInstance.pause();
        }
        set({ isPlaying: false });
        if (!isIncomingSyncEvent) {
          get().broadcastPlaybackEvent('pause');
        }
      } else {
        if (isYt) {
          set({ isPlaying: true });
          if (!isIncomingSyncEvent) {
            get().broadcastPlaybackEvent('play');
          }
        } else {
          if (audioInstance) {
            audioInstance.play()
              .then(() => {
                set({ isPlaying: true });
                if (!isIncomingSyncEvent) {
                  get().broadcastPlaybackEvent('play');
                }
              })
              .catch(err => console.log('Interactive Play blocked:', err));
          }
        }
      }
    },

    setVolume: (vol) => {
      const safeVolume = Math.max(0, Math.min(1, vol));
      set({ volume: safeVolume });
      if (audioInstance) {
        audioInstance.volume = safeVolume;
      }
    },

    seek: (seconds) => {
      const { currentSong } = get();
      if (currentSong?.youtube_url) {
        set({ youtubeSeekSignal: seconds, playedSeconds: seconds });
      } else {
        if (audioInstance) {
          audioInstance.currentTime = seconds;
        }
        set({ playedSeconds: seconds });
      }
      if (!isIncomingSyncEvent) {
        get().broadcastPlaybackEvent('seek', { seconds });
      }
    },

    nextTrack: () => {
      const { queueIndex, playbackQueue, isRepeat } = get();
      if (playbackQueue.length === 0) return;

      let nextIdx = queueIndex + 1;
      if (nextIdx >= playbackQueue.length) {
        if (isRepeat === 'all') {
          nextIdx = 0;
        } else {
          // No more songs
          set({ isPlaying: false });
          if (audioInstance) audioInstance.pause();
          return;
        }
      }

      const nextSong = playbackQueue[nextIdx];
      set({ queueIndex: nextIdx, currentSong: nextSong, playedSeconds: 0, youtubeSeekSignal: null });
      
      const isNextYt = !!nextSong.youtube_url;
      if (isNextYt) {
        if (audioInstance) {
          audioInstance.pause();
          audioInstance.src = "";
        }
        set({ isPlaying: true });
        get().recordPlayMetric(nextSong.id);
      } else {
        if (audioInstance) {
          audioInstance.src = nextSong.audio_url;
          audioInstance.play()
            .then(() => get().recordPlayMetric(nextSong.id))
            .catch(err => {
              console.log(err);
              set({ isPlaying: false });
            });
        }
      }

      // Sync broadcast
      if (!isIncomingSyncEvent) {
        get().broadcastPlaybackEvent('play', { queue: playbackQueue });
      }
    },

    prevTrack: () => {
      const { queueIndex, playbackQueue } = get();
      if (playbackQueue.length === 0) return;

      let prevIdx = queueIndex - 1;
      if (prevIdx < 0) {
        prevIdx = playbackQueue.length - 1; // loop back to end
      }

      const prevSong = playbackQueue[prevIdx];
      set({ queueIndex: prevIdx, currentSong: prevSong, playedSeconds: 0, youtubeSeekSignal: null });

      const isPrevYt = !!prevSong.youtube_url;
      if (isPrevYt) {
        if (audioInstance) {
          audioInstance.pause();
          audioInstance.src = "";
        }
        set({ isPlaying: true });
        get().recordPlayMetric(prevSong.id);
      } else {
        if (audioInstance) {
          audioInstance.src = prevSong.audio_url;
          audioInstance.play()
            .then(() => get().recordPlayMetric(prevSong.id))
            .catch(err => {
              console.log(err);
              set({ isPlaying: false });
            });
        }
      }

      // Sync broadcast
      if (!isIncomingSyncEvent) {
        get().broadcastPlaybackEvent('play', { queue: playbackQueue });
      }
    },

    setShuffle: (shuffle) => {
      const { currentSong, playbackQueue, originalQueue } = get();
      if (!currentSong) {
        set({ isShuffle: shuffle });
        return;
      }

      let newQueue = [...playbackQueue];
      if (shuffle) {
        // Shuffle everything except the currently playing song which goes to index 0
        const itemsToShuffle = playbackQueue.filter(s => s.id !== currentSong.id);
        for (let i = itemsToShuffle.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [itemsToShuffle[i], itemsToShuffle[j]] = [itemsToShuffle[j], itemsToShuffle[i]];
        }
        newQueue = [currentSong, ...itemsToShuffle];
      } else {
        // Restore original queue order if specified
        if (originalQueue.length > 0) {
          newQueue = [...originalQueue];
        }
      }

      const newIdx = newQueue.findIndex(s => s.id === currentSong.id);
      set({
        isShuffle: shuffle,
        playbackQueue: newQueue,
        queueIndex: newIdx
      });
    },

    setRepeat: (repeat) => {
      set({ isRepeat: repeat });
    },

    setShowFullscreenPlayer: (show) => {
      set({ showFullscreenPlayer: show });
    },

    addSongToQueue: (song) => {
      const queue = get().playbackQueue;
      if (queue.some(s => s.id === song.id)) return;
      const updatedQueue = [...queue, song];
      set({ playbackQueue: updatedQueue });
    },

    clearQueue: () => {
      const { currentSong } = get();
      set({
        playbackQueue: currentSong ? [currentSong] : [],
        queueIndex: currentSong ? 0 : -1,
        originalQueue: currentSong ? [currentSong] : []
      });
    },

    setPlaybackSyncRoomId: (roomId) => {
      set({ playbackSyncRoomId: roomId });
      const { isPlaybackSyncEnabled, subscribeToPlaybackSync } = get();
      if (isPlaybackSyncEnabled) {
        subscribeToPlaybackSync();
      }
    },

    setPlaybackSyncEnabled: (enabled) => {
      set({ isPlaybackSyncEnabled: enabled });
      const { subscribeToPlaybackSync } = get();
      if (enabled) {
        subscribeToPlaybackSync();
      } else {
        if (activePlaybackChannel) {
          activePlaybackChannel.unsubscribe();
          activePlaybackChannel = null;
        }
      }
    },

    broadcastPlaybackEvent: (event, data) => {
      const { isPlaybackSyncEnabled, playbackSyncRoomId, currentSong, currentUser } = get();
      if (!isPlaybackSyncEnabled || isIncomingSyncEvent || !isSupabaseConfigured || !supabase || !activePlaybackChannel) {
        return;
      }

      const senderName = currentUser?.full_name || 'Guest User';
      const songId = currentSong?.id || '';

      const payload = {
        senderId: clientSessionId,
        senderName,
        event,
        songId,
        seconds: event === 'seek' ? data?.seconds : (audioInstance?.currentTime || 0),
        queue: event === 'play' ? data?.queue : undefined,
        timestamp: Date.now()
      };

      console.log('[Supabase Realtime Sync] Broadcasting event:', event, payload);
      activePlaybackChannel.send({
        type: 'broadcast',
        event: 'playback',
        payload
      });
    },

    subscribeToPlaybackSync: () => {
      if (typeof window === 'undefined') return () => {};

      if (activePlaybackChannel) {
        try {
          activePlaybackChannel.unsubscribe();
        } catch (e) {
          console.warn('Error unsubscribing previous channel:', e);
        }
        activePlaybackChannel = null;
      }

      const { isPlaybackSyncEnabled, playbackSyncRoomId } = get();
      if (!isPlaybackSyncEnabled || !isSupabaseConfigured || !supabase) {
        return () => {};
      }

      const channelName = `playback-sync-${playbackSyncRoomId}`;
      const channel = supabase.channel(channelName);

      channel
        .on('broadcast', { event: 'playback' }, ({ payload }) => {
          if (!payload || payload.senderId === clientSessionId) return;

          console.log('[Supabase Realtime Sync] Received remote event:', payload);
          const { event, songId, seconds, queue } = payload;

          isIncomingSyncEvent = true;
          try {
            if (event === 'play') {
              const allSongs = get().songs;
              const targetSong = allSongs.find(s => s.id === songId);
              if (targetSong) {
                get().playTrack(targetSong, queue);
              }
            } else if (event === 'pause') {
              const { isPlaying, currentSong } = get();
              if (isPlaying && currentSong?.id === songId) {
                if (audioInstance) {
                  audioInstance.pause();
                }
                set({ isPlaying: false });
              }
            } else if (event === 'seek') {
              get().seek(seconds);
            }
          } catch (err) {
            console.error('[Sync Error]:', err);
          } finally {
            isIncomingSyncEvent = false;
          }
        })
        .subscribe((status) => {
          console.log(`[Supabase Realtime Sync] Subscribed to ${channelName} status:`, status);
        });

      activePlaybackChannel = channel;

      return () => {
        if (channel) {
          try {
            channel.unsubscribe();
          } catch (e) {
            console.warn('Error unsubscribing channel on cleanup:', e);
          }
          if (activePlaybackChannel === channel) {
            activePlaybackChannel = null;
          }
        }
      };
    },

    recordPlayMetric: (songId) => {
      const user = get().currentUser;
      const history = get().playHistory;

      // Update play counter inside the song array
      const updatedSongs = get().songs.map(s => {
        if (s.id === songId) {
          return { ...s, play_count: s.play_count + 1 };
        }
        return s;
      });

      // Append entry to play history
      const newHistory: PlayHistory = {
        id: `hist-${Date.now()}`,
        user_id: user?.id || 'anonymous',
        song_id: songId,
        played_at: new Date().toISOString(),
        duration_played: 120 // simulated 2 min play for stats
      };

      const updatedHistory = [newHistory, ...history].slice(0, 100); // keep last 100

      set({ songs: updatedSongs, playHistory: updatedHistory });
      setStored('songs', updatedSongs);
      setStored('play_history', updatedHistory);

      // Save play history to Supabase if live connection is active
      if (user && isSupabaseConfigured) {
        syncHelper.syncPlayHistory(newHistory).catch(err => {
          console.error('[Supabase Sync Error] Could not synchronize play history entry:', err);
        });
      }
    },

    syncUserHistoryFromSupabase: async () => {
      const user = get().currentUser;
      if (!user || !isSupabaseConfigured) return;
      try {
        const dbHistory = await syncHelper.fetchPlayHistory(user.id);
        if (dbHistory && Array.isArray(dbHistory)) {
          const mappedHistory: PlayHistory[] = dbHistory.map((item: any) => ({
            id: item.id || `hist-${Date.now()}-${item.song_id}`,
            user_id: item.user_id,
            song_id: item.song_id,
            played_at: item.played_at,
            duration_played: item.duration_played || 120
          }));
          
          const currentHistory = get().playHistory;
          const combined = [...currentHistory, ...mappedHistory];
          const unique: PlayHistory[] = [];
          const seenKeys = new Set<string>();
          
          for (const item of combined) {
            const key = item.id || `${item.song_id}-${item.played_at}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              unique.push(item);
            }
          }
          
          unique.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
          const trimmed = unique.slice(0, 100);
          
          set({ playHistory: trimmed });
          setStored('play_history', trimmed);
        }
      } catch (e) {
        console.error('Failed to sync user history from Supabase:', e);
      }
    },

    // Administrator CRUD controls
    addSong: (songData) => {
      const newSong: Song = {
        ...songData,
        id: (songData as any).id || `sng-${Date.now()}`,
        play_count: 0,
        like_count: 0,
        created_at: new Date().toISOString()
      };

      const updatedSongs = [newSong, ...get().songs];
      set({ songs: updatedSongs });
      setStored('songs', updatedSongs);

      // Backup to server-side JSON database
      fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSong)
      }).catch(err => console.error('Failed to sync added song to server:', err));
    },

    editSong: (songId, songData) => {
      const idx = get().songs.findIndex(s => s.id === songId);
      if (idx === -1) return;
      const updatedSong = { ...get().songs[idx], ...songData };

      const updatedSongs = get().songs.map(s => {
        if (s.id === songId) {
          return updatedSong;
        }
        return s;
      });
      set({ songs: updatedSongs });
      setStored('songs', updatedSongs);

      // Sync edit to server
      fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSong)
      }).catch(err => console.error('Failed to sync edited song to server:', err));
    },

    deleteSong: (songId) => {
      const updatedSongs = get().songs.filter(s => s.id !== songId);
      const updatedPlaylistSongs = get().playlistSongs.filter(ps => ps.song_id !== songId);
      const updatedLikedSongs = get().likedSongs.filter(ls => ls.song_id !== songId);

      set({ 
        songs: updatedSongs, 
        playlistSongs: updatedPlaylistSongs, 
        likedSongs: updatedLikedSongs,
        currentSong: get().currentSong?.id === songId ? null : get().currentSong
      });
      
      setStored('songs', updatedSongs);
      setStored('playlist_songs', updatedPlaylistSongs);
      setStored('liked_songs', updatedLikedSongs);

      // Sync delete to server
      fetch(`/api/songs/${songId}`, {
        method: 'DELETE'
      }).catch(err => console.error('Failed to sync deleted song to server:', err));
    },

    deleteSongsBulk: (songIds) => {
      const updatedSongs = get().songs.filter(s => !songIds.includes(s.id));
      const updatedPlaylistSongs = get().playlistSongs.filter(ps => !songIds.includes(ps.song_id));
      const updatedLikedSongs = get().likedSongs.filter(ls => !songIds.includes(ls.song_id));

      set({
        songs: updatedSongs,
        playlistSongs: updatedPlaylistSongs,
        likedSongs: updatedLikedSongs,
        currentSong: songIds.includes(get().currentSong?.id || '') ? null : get().currentSong
      });

      setStored('songs', updatedSongs);
      setStored('playlist_songs', updatedPlaylistSongs);
      setStored('liked_songs', updatedLikedSongs);

      // Sync bulk delete to server
      fetch('/api/songs/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: songIds })
      }).catch(err => console.error('Failed to sync bulk deleted songs to server:', err));
    },

    addAlbum: (albumData) => {
      const newAlbum: Album = {
        ...albumData,
        id: `alb-${Date.now()}`,
        created_at: new Date().toISOString()
      };

      const updatedAlbums = [newAlbum, ...get().albums];
      set({ albums: updatedAlbums });
      setStored('albums', updatedAlbums);
    },

    editAlbum: (albumId, albumData) => {
      const updatedAlbums = get().albums.map(a => {
        if (a.id === albumId) {
          return { ...a, ...albumData };
        }
        return a;
      });
      set({ albums: updatedAlbums });
      setStored('albums', updatedAlbums);
    },

    deleteAlbum: (albumId) => {
      const updatedAlbums = get().albums.filter(a => a.id !== albumId);
      // Detach songs associated with this album
      const updatedSongs = get().songs.map(s => s.album_id === albumId ? { ...s, album_id: null } : s);

      set({ albums: updatedAlbums, songs: updatedSongs });
      setStored('albums', updatedAlbums);
      setStored('songs', updatedSongs);
    },

    addArtist: (artistData) => {
      const newArtist: Artist = {
        ...artistData,
        id: `art-${Date.now()}`,
        follower_count: 0,
        created_at: new Date().toISOString()
      };

      const updatedArtists = [newArtist, ...get().artists];
      set({ artists: updatedArtists });
      setStored('artists', updatedArtists);
    },

    editArtist: (artistId, artistData) => {
      const updatedArtists = get().artists.map(a => {
        if (a.id === artistId) {
          return { ...a, ...artistData };
        }
        return a;
      });
      set({ artists: updatedArtists });
      setStored('artists', updatedArtists);
    },

    deleteArtist: (artistId) => {
      const updatedArtists = get().artists.filter(a => a.id !== artistId);
      
      // Cascade delete songs and albums by the artist
      const updatedSongs = get().songs.filter(s => s.artist_id !== artistId);
      const updatedAlbums = get().albums.filter(a => a.artist_id !== artistId);

      set({ artists: updatedArtists, songs: updatedSongs, albums: updatedAlbums });
      setStored('artists', updatedArtists);
      setStored('songs', updatedSongs);
      setStored('albums', updatedAlbums);
    },

    updateUserRole: (userId, role) => {
      const updatedUsers = get().users.map(u => {
        if (u.id === userId) {
          const updated = { ...u, role };
          if (get().currentUser?.id === userId) {
            set({ currentUser: updated });
            setStored('current_user', updated);
          }
          return updated;
        }
        return u;
      });
      
      set({ users: updatedUsers });
      setStored('users', updatedUsers);
    },

    toggleBanUser: (userId) => {
      const blocked = get().bannedUserIds;
      const isBanned = blocked.includes(userId);
      let nextBlocked: string[];

      if (isBanned) {
        nextBlocked = blocked.filter(id => id !== userId);
      } else {
        nextBlocked = [...blocked, userId];
      }

      set({ bannedUserIds: nextBlocked });
      setStored('banned_user_ids', nextBlocked);

      // Force logout if banned user is active
      if (get().currentUser?.id === userId && !isBanned) {
        get().logout();
      }
    }
  };
});

// Auto-subscribe to live Supabase Auth changes to dynamically bind auth.uid()
if (isSupabaseConfigured && supabase) {
  // Listen to authentic auth state changes dynamically
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const authUser = session.user;
      const email = authUser.email || '';
      const isDefaultAdmin = email.toLowerCase() === 'ausiaam83@gmail.com';
      
      const current = useHealersStore.getState().currentUser;
      const userObj: User = {
        id: authUser.id, // Actual Supabase authenticated ID (auth.uid())
        email: email,
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || current?.full_name || 'Healers Soul',
        avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || current?.avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop`,
        role: isDefaultAdmin ? 'admin' : (current?.role || 'user'),
        created_at: authUser.created_at || new Date().toISOString()
      };
      
      // Update store state and persist changes synchronously
      useHealersStore.setState({ currentUser: userObj });
      setStored('current_user', userObj);
      
      // Auto-sync play history
      useHealersStore.getState().syncUserHistoryFromSupabase().catch(e => {
        console.error('Failed to auto-sync user history after auth state change:', e);
      });
    } else if (event === 'SIGNED_OUT') {
      useHealersStore.setState({ currentUser: null, preferences: null, isOnboarded: false });
      setStored('current_user', null);
      setStored('preferences', null);
      setStored('is_onboarded', false);
    }
  });

  // Try to load initial user session immediately
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      const authUser = session.user;
      const email = authUser.email || '';
      const isDefaultAdmin = email.toLowerCase() === 'ausiaam83@gmail.com';
      
      const current = useHealersStore.getState().currentUser;
      const userObj: User = {
        id: authUser.id, // Actual Supabase authenticated ID (auth.uid())
        email: email,
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || current?.full_name || 'Healers Soul',
        avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || current?.avatar_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop`,
        role: isDefaultAdmin ? 'admin' : (current?.role || 'user'),
        created_at: authUser.created_at || new Date().toISOString()
      };
      
      useHealersStore.setState({ currentUser: userObj });
      setStored('current_user', userObj);

      // Auto-sync play history on initial load
      useHealersStore.getState().syncUserHistoryFromSupabase().catch(e => {
        console.error('Failed to auto-sync user history on session load:', e);
      });
    }
  }).catch((err) => {
    console.warn('[Initial session lookup error]:', err);
  });
}
