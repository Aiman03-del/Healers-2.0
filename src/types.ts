/**
 * Types and interfaces for the Healers music platform.
 */

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: 'user' | 'moderator' | 'modaretor' | 'admin';
  created_at: string;
}

export type ListeningTimePreference = 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime';

export interface UserPreferences {
  id: string;
  user_id: string;
  favorite_artists: string[]; // Artist IDs
  favorite_genres: string[];
  listening_time: ListeningTimePreference;
  mood: string[];
  created_at: string;
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  avatar_url: string;
  cover_image: string;
  verified: boolean;
  follower_count: number;
  created_at: string;
}

export interface Album {
  id: string;
  title: string;
  artist_id: string;
  cover_image: string;
  release_date: string;
  genre: string;
  type: 'album' | 'ep' | 'single';
  created_at: string;
}

export interface Song {
  id: string;
  title: string;
  artist_id: string;
  album_id: string | null;
  audio_url: string;
  cover_image: string;
  duration_seconds: number;
  genre: string;
  language: string;
  mood: string[];
  tags: string[];
  play_count: number;
  like_count: number;
  is_trending: boolean;
  is_featured: boolean;
  release_date: string;
  lyrics?: string;
  lyricist?: string;
  composer?: string;
  description?: string;
  youtube_url?: string;
  lyrics_synced?: { start: number; end: number; text: string; }[];
  audio_duration?: number;
  created_at: string;
}

export interface Playlist {
  id: string;
  user_id: string;
  title: string;
  description: string;
  cover_image: string;
  is_public: boolean;
  is_collaborative?: boolean;
  songs_count: number;
  created_at: string;
}

export interface PlaylistSong {
  id: string;
  playlist_id: string;
  song_id: string;
  position: number;
  added_at: string;
}

export interface LikedSong {
  id: string;
  user_id: string;
  song_id: string;
  created_at: string;
}

export interface PlayHistory {
  id: string;
  user_id: string;
  song_id: string;
  played_at: string;
  duration_played: number; // in seconds
}

export interface Follower {
  id: string;
  follower_id: string;
  artist_id: string;
  created_at: string;
}

export interface SongRequest {
  id: string;
  title: string;
  artist: string;
  requesterEmail: string;
  genre: string;
  notes: string;
  youtubeUrl?: string;
  status: 'pending' | 'added';
  createdAt: string;
}

export interface AppState {
  currentUser: User | null;
  preferences: UserPreferences | null;
  artists: Artist[];
  albums: Album[];
  songs: Song[];
  playlists: Playlist[];
  playlistSongs: PlaylistSong[];
  likedSongs: LikedSong[];
  playHistory: PlayHistory[];
  followers: Follower[];
}
