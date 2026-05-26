import { createClient } from '@supabase/supabase-js';

// Read from client-side dynamic environment variables (which the user can define in Settings)
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// True if fully connected to a live Supabase backend
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Safe utility to handle converting any custom string to a conforming, deterministic UUID
 * if it doesn't already fit the standard UUID pattern.
 */
export function convertToUUID(str: string): string {
  if (!str) return '00000000-0000-4000-a000-000000000000';
  // Check if standard UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str;

  // Manual mapping for common non-UUID placeholders
  if (str === 'usr-admin') {
    return 'ad000000-ad0a-4000-ad0a-000000000000';
  }
  if (str === 'usr-1') {
    return '00000000-0000-4000-a000-000000000001';
  }

  // Generate a deterministic UUID-like value based on the characters
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const tail = str.replace(/[^0-9a-f]/gi, '').toLowerCase().padEnd(20, 'a').slice(0, 20);
  return `${hex}-${tail.slice(0, 4)}-4${tail.slice(4, 7)}-a${tail.slice(7, 10)}-${tail.slice(10, 22)}`;
}

/**
 * Helpful helper to sync data to Supabase if configured.
 * Otherwise, stores locally.
 */
export const syncHelper = {
  // 1. Synchronize or Register a User
  async syncUser(user: any) {
    if (!supabase) return { success: false, data: user };
    try {
      let resolvedId = user.id;

      // Try reading user from active Supabase Auth session first
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          resolvedId = authUser.id;
        }
      } catch (e) {
        console.warn('Could not read auth user from Supabase:', e);
      }

      // Convert local or hardcoded formats to UUID conforming state
      resolvedId = convertToUUID(resolvedId);

      const { data, error } = await supabase
        .from('healers_users')
        .upsert({
          id: resolvedId,
          email: user.email,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          role: user.role,
          created_at: user.created_at
        })
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('Supabase Sync Error [syncUser]:', err);
      return { success: false, error: err };
    }
  },

  // 2. Fetch Users from Supabase
  async fetchUsers() {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('healers_users')
        .select('*');
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Supabase Error [fetchUsers]:', err);
      return null;
    }
  },

  // 3. Synchronize Preferences
  async syncPreferences(prefs: any) {
    if (!supabase) return { success: false, data: prefs };
    try {
      let resolvedUserId = prefs.user_id;

      // Read from active Supabase Auth user if logged in
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          resolvedUserId = authUser.id;
        }
      } catch (e) {}

      resolvedUserId = convertToUUID(resolvedUserId);

      const { data, error } = await supabase
        .from('healers_preferences')
        .upsert({
          id: prefs.id,
          user_id: resolvedUserId,
          favorite_artists: prefs.favorite_artists,
          favorite_genres: prefs.favorite_genres,
          listening_time: prefs.listening_time,
          mood: prefs.mood,
          created_at: prefs.created_at
        })
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('Supabase Sync Error [syncPreferences]:', err);
      return { success: false, error: err };
    }
  },

  // 4. Fetch User Preferences
  async fetchPreferences(userId: string) {
    if (!supabase) return null;
    try {
      let resolvedUserId = userId;

      // Read from active Supabase Auth user if logged in
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          resolvedUserId = authUser.id;
        }
      } catch (e) {}

      resolvedUserId = convertToUUID(resolvedUserId);

      const { data, error } = await supabase
        .from('healers_preferences')
        .select('*')
        .eq('user_id', resolvedUserId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Supabase Error [fetchPreferences]:', err);
      return null;
    }
  },

  // 5. Submit Missing Raga Request
  async syncRequest(request: any) {
    if (!supabase) return { success: false, data: request };
    try {
      const { data, error } = await supabase
        .from('healers_requests')
        .insert({
          title: request.title,
          artist: request.artist,
          requester_email: request.requesterEmail || request.email,
          genre: request.genre,
          notes: request.notes,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('Supabase Sync Error [syncRequest]:', err);
      return { success: false, error: err };
    }
  },

  // 6. Sync Song to Supabase
  async syncSong(song: any) {
    if (!supabase) return { success: false, data: song };
    try {
      const { data, error } = await supabase
        .from('healers_songs')
        .upsert({
          id: song.id,
          title: song.title,
          artist_id: song.artist_id,
          album_id: song.album_id,
          audio_url: song.audio_url,
          cover_image: song.cover_image,
          duration_seconds: song.duration_seconds,
          genre: song.genre,
          language: song.language,
          mood: song.mood,
          tags: song.tags,
          is_trending: song.is_trending,
          is_featured: song.is_featured,
          release_date: song.release_date,
          lyrics: song.lyrics,
          youtube_url: song.youtube_url,
          lyrics_synced: song.lyrics_synced,
          audio_duration: song.audio_duration,
          play_count: song.play_count || 0,
          like_count: song.like_count || 0,
          created_at: song.created_at
        })
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('Supabase Sync Error [syncSong]:', err);
      return { success: false, error: err };
    }
  },

  // 6.5. Synchronize Play History to Supabase
  async syncPlayHistory(historyItem: any) {
    if (!supabase) return { success: false, data: historyItem };
    try {
      let resolvedUserId = historyItem.user_id;

      // Try reading user from active Supabase Auth session first
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          resolvedUserId = authUser.id;
        }
      } catch (e) {}

      resolvedUserId = convertToUUID(resolvedUserId);

      const { data, error } = await supabase
        .from('healers_history')
        .upsert({
          id: historyItem.id,
          user_id: resolvedUserId,
          song_id: historyItem.song_id,
          played_at: historyItem.played_at || new Date().toISOString(),
          duration_played: historyItem.duration_played || 120
        })
        .select();

      if (error) throw error;
      return { success: true, data: data?.[0] };
    } catch (err) {
      console.error('Supabase Sync Error [syncPlayHistory]:', err);
      return { success: false, error: err };
    }
  },

  // Fetch Play History from Supabase
  async fetchPlayHistory(userId: string) {
    if (!supabase) return null;
    try {
      let resolvedUserId = userId;

      // Try reading user from active Supabase Auth session first
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          resolvedUserId = authUser.id;
        }
      } catch (e) {}

      resolvedUserId = convertToUUID(resolvedUserId);

      const { data, error } = await supabase
        .from('healers_history')
        .select('*')
        .eq('user_id', resolvedUserId)
        .order('played_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Supabase Error [fetchPlayHistory]:', err);
      return null;
    }
  },

  // 7. SQL Setup Script for the administrator to build tables easily in Supabase SQL editor
  getSQLSchema() {
    return `-- Run this in your Supabase SQL Editor to construct the schema required by Healers Soundboard:

-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.healers_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Users Table
ALTER TABLE public.healers_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read users" ON public.healers_users FOR SELECT USING (true);
CREATE POLICY "Allow individual upsert" ON public.healers_users FOR ALL USING (true) WITH CHECK (true);

-- 2. Create Preferences Table
CREATE TABLE IF NOT EXISTS public.healers_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.healers_users(id) ON DELETE CASCADE,
    favorite_artists TEXT[] DEFAULT '{}',
    favorite_genres TEXT[] DEFAULT '{}',
    listening_time TEXT,
    mood TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Preferences Table
ALTER TABLE public.healers_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read preferences" ON public.healers_preferences FOR SELECT USING (true);
CREATE POLICY "Allow individual write" ON public.healers_preferences FOR ALL USING (true) WITH CHECK (true);

-- 3. Create Song Request Table
CREATE TABLE IF NOT EXISTS public.healers_requests (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    requester_email TEXT NOT NULL,
    genre TEXT,
    notes TEXT,
    youtube_url TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Requests Table
ALTER TABLE public.healers_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anyone to insert request" ON public.healers_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read for logged users" ON public.healers_requests FOR SELECT USING (true);

-- 4. Create Songs Table with Synced Lyrics Columns
CREATE TABLE IF NOT EXISTS public.healers_songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    album_id TEXT,
    audio_url TEXT NOT NULL,
    cover_image TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    genre TEXT NOT NULL,
    language TEXT NOT NULL,
    mood TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_trending BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    release_date TEXT NOT NULL,
    lyrics TEXT,
    youtube_url TEXT,
    lyrics_synced JSONB,
    audio_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for Songs Table
ALTER TABLE public.healers_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read songs" ON public.healers_songs FOR SELECT USING (true);
CREATE POLICY "Allow admin write songs" ON public.healers_songs FOR ALL USING (true) WITH CHECK (true);

-- 5. Create Play History Table
CREATE TABLE IF NOT EXISTS public.healers_history (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.healers_users(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    duration_played INTEGER DEFAULT 0
);

-- Enable RLS for Play History Table
ALTER TABLE public.healers_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read history" ON public.healers_history FOR SELECT USING (true);
CREATE POLICY "Allow individual write history" ON public.healers_history FOR ALL USING (true) WITH CHECK (true);
`;
  }
};
