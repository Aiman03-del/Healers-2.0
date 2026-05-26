import express from 'express';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const dbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = dbUrl && dbKey ? createClient(dbUrl, dbKey) : null;

if (supabase) {
  console.log('💚 Supabase global database client initialized successfully on Healers backend!');
} else {
  console.log('⚠️ Supabase environment variables not found / incomplete in backend. Using local JSON storage fallback.');
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Temporary in-memory list for referencing song requests
interface SongRequest {
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

const REQUESTS_FILE_PATH = path.join(process.cwd(), 'song_requests.json');

function loadSongRequests(): SongRequest[] {
  try {
    if (fs.existsSync(REQUESTS_FILE_PATH)) {
      const data = fs.readFileSync(REQUESTS_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load song requests from file:', err);
  }
  return [];
}

function saveSongRequests(requests: SongRequest[]) {
  try {
    fs.writeFileSync(REQUESTS_FILE_PATH, JSON.stringify(requests, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save song requests to file:', err);
  }
}

let songRequests: SongRequest[] = loadSongRequests();

const CURATED_SONGS_FILE_PATH = path.join(process.cwd(), 'curated_songs.json');

function loadCuratedSongs(): any[] {
  try {
    if (fs.existsSync(CURATED_SONGS_FILE_PATH)) {
      const data = fs.readFileSync(CURATED_SONGS_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load curated songs from file:', err);
  }

  // Auto-seed from approved requests in song_requests.json if curated_songs doesn't exist
  try {
    const requests = songRequests;
    const approvedRequests = requests.filter(r => r.status === 'added');
    if (approvedRequests.length > 0) {
      const seeded = approvedRequests.map((req, index) => {
        return {
          id: `sng-${req.id.replace('req-', '') || String(Date.now() + index)}`,
          title: req.title,
          artist_id: 'art-healers',
          album_id: null,
          audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          cover_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop',
          duration_seconds: 300,
          genre: req.genre && req.genre !== 'Any' ? req.genre : 'Devotional',
          language: 'Bangla',
          lyricist: 'Traditional raga',
          composer: 'Healers Ensemble',
          description: req.notes || 'A tranquil devotional composition shared by our subscriber community.',
          mood: ['Calm', 'Peaceful'],
          tags: ['raga', 'meditational', 'community'],
          is_trending: false,
          is_featured: false,
          release_date: req.createdAt ? req.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          lyrics: `[00:00] (Aromatic Acoustic Soundscape)\n[00:15] OM and deep breaths...\n[01:00] The cosmic raga expands beautifully through space.`
        };
      });
      fs.writeFileSync(CURATED_SONGS_FILE_PATH, JSON.stringify(seeded, null, 2), 'utf8');
      console.log(`✅ Auto-seeded ${seeded.length} curated songs from pre-approved requests.`);
      return seeded;
    }
  } catch (e) {
    console.error('Failed to auto-seed curated songs from approved requests:', e);
  }

  return [];
}

function saveCuratedSongs(songs: any[]) {
  try {
    fs.writeFileSync(CURATED_SONGS_FILE_PATH, JSON.stringify(songs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save curated songs to file:', err);
  }
}

let curatedSongs: any[] = loadCuratedSongs();

// Transporter lazy builder in case variables are unconfigured or custom
function getTransporter() {
  let host = (process.env.SMTP_HOST || 'smtp.gmail.com').replace(/^["']|["']$/g, '').trim();
  let port = parseInt((process.env.SMTP_PORT || '587').replace(/^["']|["']$/g, '').trim());
  let user = (process.env.SMTP_USER || '').replace(/^["']|["']$/g, '').trim();
  let pass = (process.env.SMTP_PASS || '').replace(/^["']|["']$/g, '').trim();

  if (!user || !pass) {
    console.log('⚠️ SMTP credentials not configured in environment variables. Falling back to simulated log-only nodemailer.');
    return null;
  }

  // Auto-correct case where SMTP_HOST is mistakenly set to an email address (containing @)
  if (host.includes('@')) {
    console.warn(`⚠️ Warning: SMTP_HOST "${host}" appears to be an email address. Attempting alignment...`);
    const domain = host.split('@').pop()?.toLowerCase() || '';
    if (domain.includes('gmail') || domain.includes('gmai')) {
      host = 'smtp.gmail.com';
    } else if (domain.includes('outlook') || domain.includes('hotmail')) {
      host = 'smtp-mail.outlook.com';
    } else if (domain.includes('yahoo')) {
      host = 'smtp.mail.yahoo.com';
    } else {
      host = 'smtp.gmail.com'; // safe fallback
    }
    console.log(`🔧 Auto-corrected SMTP_HOST to standard server address: "${host}"`);
  }

  // Treat common typos/misunderstandings of Gmail SMTP host
  const lowerHost = host.toLowerCase();
  if (lowerHost.includes('gmai.com') || lowerHost === 'gmail.com' || lowerHost === 'smtp.gmai.com') {
    host = 'smtp.gmail.com';
    console.log(`🔧 Corrected standard Gmail SMTP host to "smtp.gmail.com"`);
  }

  // Correct any "gmai.com" domain typos in SMTP user username as well
  if (user.toLowerCase().includes('gmai.com')) {
    const correctedUser = user.replace(/gmai\.com/gi, 'gmail.com');
    console.log(`🔧 Auto-corrected SMTP_USER from "${user}" to "${correctedUser}"`);
    user = correctedUser;
  }

  // Also if they are placeholder values, don't attempt real SMTP to save time and avoid login rejections
  const isPlaceholderUser = user === 'your.gmail.account@gmail.com' || user === 'your-email@gmail.com' || user.includes('your-email');
  const isPlaceholderPass = pass === 'your-gmail-app-specific-password' || !pass.trim();
  if (isPlaceholderUser || isPlaceholderPass) {
    console.log('⚠️ SMTP credentials are dummy placeholder values. Falling back to simulated log-only nodemailer.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    // Adding timeout values to prevent long hang-times on incorrect configs
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000
  });
}

// API for recording and emailing missing song requests
app.post('/api/request-song', async (req, res) => {
  const { title, artist, requesterEmail, genre, notes, youtubeUrl } = req.body;
  
  if (!youtubeUrl) {
    return res.status(400).json({ error: 'YouTube URL is required.' });
  }

  const finalTitle = title || `YouTube Request (${youtubeUrl.split('v=').pop()?.split('&')[0] || youtubeUrl})`;
  const finalEmail = requesterEmail || 'guest@purpleheart.com';

  const newRequest: SongRequest = {
    id: `req-${Date.now()}`,
    title: finalTitle,
    artist: artist || 'Unknown Artist',
    requesterEmail: finalEmail,
    genre: genre || 'Any',
    notes: notes || '',
    youtubeUrl: youtubeUrl || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  songRequests.push(newRequest);
  saveSongRequests(songRequests);

  if (supabase) {
    try {
      const { error } = await supabase.from('healers_requests').insert({
        title: newRequest.title,
        artist: newRequest.artist,
        requester_email: newRequest.requesterEmail,
        genre: newRequest.genre,
        notes: newRequest.notes,
        youtube_url: newRequest.youtubeUrl || '',
        status: newRequest.status,
        created_at: newRequest.createdAt
      });
      if (error) throw error;
      console.log(`✅ Synced song request "${newRequest.title}" to Supabase.`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errCode = err?.code || 'Unknown';
      console.warn(`⚠️ Could not insert song request to Supabase: ${errMsg} (code: ${errCode})`);
      if (errCode === '42P01') {
        console.warn('💡 Troubleshooting Hint: The "healers_requests" table does not exist in your Supabase DB. Please create it using the SQL schema in your Supabase SQL editor!');
      }
    }
  }

  const transporter = getTransporter();
  let adminEmail = (process.env.ADMIN_EMAIL || 'ausiaam83@gmail.com').replace(/^["']|["']$/g, '').trim();
  if (adminEmail.toLowerCase().includes('gmai.com')) {
    adminEmail = adminEmail.replace(/gmai\.com/gi, 'gmail.com');
  }
  const rawSender = process.env.SMTP_FROM || `Purple Heart Care <${process.env.SMTP_USER || 'no-reply@purpleheart.com'}>`;
  let mailSender = rawSender.replace(/^["']|["']$/g, '').trim();
  if (mailSender.toLowerCase().includes('gmai.com')) {
    mailSender = mailSender.replace(/gmai\.com/gi, 'gmail.com');
  }

  const emailSubject = `🎵 [Song Request] "${newRequest.title}" by ${newRequest.artist}`;
  const emailBodyHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; background-color: #fafafa;">
      <h2 style="color: #a855f7;">New Purple Heart Track Request</h2>
      <p style="color: #333;">A subscriber has submitted a request for a devotional, acoustic, or missing classical composition:</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; font-weight: bold; width: 30%; border: 1px solid #e5e7eb;">Song Title</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${newRequest.title}</td></tr>
        <tr><td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Artist</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${newRequest.artist}</td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">YouTube Link</td><td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="${newRequest.youtubeUrl}" target="_blank">${newRequest.youtubeUrl || 'None'}</a></td></tr>
        <tr><td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Requested By</td><td style="padding: 10px; border: 1px solid #e5e7eb;"><a href="mailto:${newRequest.requesterEmail}">${newRequest.requesterEmail}</a></td></tr>
        <tr style="background-color: #f3f4f6;"><td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Genre</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${newRequest.genre}</td></tr>
        <tr><td style="padding: 10px; font-weight: bold; border: 1px solid #e5e7eb;">Notes</td><td style="padding: 10px; border: 1px solid #e5e7eb;">${newRequest.notes || 'None'}</td></tr>
      </table>
      <div style="margin-top: 25px; padding-top: 15px; border-t: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; text-align: center;">
        Purple Heart Soundboard Notification Engine. Keep breathing. 🧘🏽‍♂️
      </div>
    </div>
  `;

  let emailStatus = 'simulated';
  let smtpErrorMessage = null;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: mailSender,
        to: adminEmail,
        subject: emailSubject,
        html: emailBodyHtml,
      });
      console.log(`✅ Nodemailer - Email sent successfully to admin (${adminEmail}) for request "${newRequest.title}"`);
      emailStatus = 'sent';
    } catch (err: any) {
      smtpErrorMessage = err.message;
      console.error('❌ Failed to dispatch email via SMTP. Falling back to simulated logger:', err.message);
      console.log(`\n========================================\n📧 [FALLBACK SIMULATED NODEMAILER TRANSMISSION due to SMTP Error]\nTo: ${adminEmail}\nSubject: ${emailSubject}\nBody:\n${emailBodyHtml}\n========================================\n`);
    }
  } else {
    console.log(`\n========================================\n📧 [SIMULATED NODEMAILER TRANSMISSION]\nTo: ${adminEmail}\nSubject: ${emailSubject}\nBody:\n${emailBodyHtml}\n========================================\n`);
  }

  return res.json({ 
    success: true, 
    message: smtpErrorMessage 
      ? `Your song request was registered, but the server returned SMTP authorization failure (${smtpErrorMessage}). The transfer was simulated to the console!` 
      : 'Your song request has been submitted and admin notified!', 
    request: newRequest,
    emailStatus,
    smtpError: smtpErrorMessage
  });
});

// API for listing requests to synchronize in frontend client
app.get('/api/requests', async (req, res) => {
  let combinedRequests = [...songRequests];
  let supabaseTablesMissing = false;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('healers_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const mappedRequests = data?.map(r => ({
        id: String(r.id),
        title: r.title,
        artist: r.artist || 'Unknown Artist',
        requesterEmail: r.requester_email,
        genre: r.genre || 'Any',
        notes: r.notes || '',
        youtubeUrl: r.youtube_url || '',
        status: r.status || 'pending',
        createdAt: r.created_at
      })) || [];

      // Merge Supabase requests with local requests.
      // We will map them by lowercased youtubeUrl if available, otherwise by id.
      const mergedMap = new Map<string, any>();

      // First, insert local requests
      songRequests.forEach(r => {
        const key = r.youtubeUrl ? r.youtubeUrl.trim().toLowerCase() : String(r.id);
        mergedMap.set(key, r);
      });

      // Second, overwrite/resolve with Supabase requests
      mappedRequests.forEach(r => {
        const key = r.youtubeUrl ? r.youtubeUrl.trim().toLowerCase() : String(r.id);
        // If a request was approved locally, or is marked live in Supabase, preserve 'added' status
        if (mergedMap.has(key)) {
          const localReq = mergedMap.get(key);
          const finalStatus = (localReq.status === 'added' || r.status === 'added') ? 'added' : 'pending';
          mergedMap.set(key, { ...r, id: localReq.id, status: finalStatus }); // keep local ID to avoid frontend key mismatch
        } else {
          mergedMap.set(key, r);
        }
      });

      combinedRequests = Array.from(mergedMap.values());
      // Sort combinedRequests by createdAt descending
      combinedRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({ requests: combinedRequests });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errCode = err?.code || 'Unknown';
      console.warn(`⚠️ Supabase fetch requests failed: ${errMsg} (code: ${errCode}). Falling back to local song_requests JSON.`);
      if (errCode === '42P01' || errCode === 'PGRST205') {
        console.warn('💡 Troubleshooting Hint: The table "healers_requests" does not exist in your Supabase database yet. Please run the SQL schema defined in "src/lib/supabase.ts" through your Supabase SQL editor to create it!');
        supabaseTablesMissing = true;
      }
    }
  }
  
  res.json({ requests: combinedRequests, supabaseTablesMissing });
});

// GET all curated songs from the server-side database
app.get('/api/songs', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('healers_songs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      // If table is entirely empty, we can seed it with curated_songs so there's initial data
      if (data && data.length === 0 && curatedSongs.length > 0) {
        console.log('Seeding Supabase healers_songs table with local curated songs...');
        const formattedSongs = curatedSongs.map(s => ({
          id: s.id,
          title: s.title,
          artist_id: s.artist_id || 'art-healers',
          album_id: s.album_id || null,
          audio_url: s.audio_url,
          cover_image: s.cover_image,
          duration_seconds: s.duration_seconds || 300,
          genre: s.genre,
          language: s.language,
          mood: Array.isArray(s.mood) ? s.mood : (s.mood ? [s.mood] : []),
          tags: Array.isArray(s.tags) ? s.tags : (s.tags ? [s.tags] : []),
          play_count: s.play_count || 0,
          like_count: s.like_count || 0,
          is_trending: s.is_trending || false,
          is_featured: s.is_featured || false,
          release_date: s.release_date || new Date().toISOString().split('T')[0],
          lyrics: s.lyrics || null,
          youtube_url: s.youtube_url || null,
          lyrics_synced: s.lyrics_synced || null,
          audio_duration: s.audio_duration || s.duration_seconds || null,
          created_at: s.created_at || new Date().toISOString()
        }));
        await supabase.from('healers_songs').upsert(formattedSongs);
        return res.json({ songs: curatedSongs });
      }
      
      // Map database names/arrays cleanly
      const mappedSongs = data?.map(s => ({
        ...s,
        mood: Array.isArray(s.mood) ? s.mood : (s.mood ? [s.mood] : []),
        tags: Array.isArray(s.tags) ? s.tags : (s.tags ? [s.tags] : [])
      })) || [];
      
      // Sync local curated_songs.json file cache with live Supabase database state
      if (mappedSongs.length > 0) {
        curatedSongs = mappedSongs;
        saveCuratedSongs(curatedSongs);
      }
      
      return res.json({ songs: mappedSongs });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errCode = err?.code || 'Unknown';
      console.warn(`⚠️ Supabase fetch songs failed: ${errMsg} (code: ${errCode}). Falling back to local curated_songs JSON.`);
      if (errCode === '42P01' || errCode === 'PGRST205') {
        console.warn('💡 Troubleshooting Hint: The table "healers_songs" does not exist in your Supabase database yet. Please run the SQL schema defined in "src/lib/supabase.ts" through your Supabase SQL editor to create it!');
        return res.json({ songs: curatedSongs, supabaseTablesMissing: true });
      }
    }
  }
  res.json({ songs: curatedSongs });
});

// POST to save/register a newly created or approved song in the server-side database
app.post('/api/songs', async (req, res) => {
  const song = req.body;
  if (!song || !song.id || !song.title) {
    return res.status(400).json({ error: 'Song must include ID and title.' });
  }

  // Check if song exists to update locally, else insert
  const idx = curatedSongs.findIndex(s => s.id === song.id);
  if (idx !== -1) {
    curatedSongs[idx] = { ...curatedSongs[idx], ...song };
  } else {
    curatedSongs.push(song);
  }

  saveCuratedSongs(curatedSongs);
  console.log(`✅ Saved curated song "${song.title}" with ID ${song.id} to local server JSON file.`);

  // Upsert to Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('healers_songs').upsert({
        id: song.id,
        title: song.title,
        artist_id: song.artist_id || 'art-healers',
        album_id: song.album_id || null,
        audio_url: song.audio_url,
        cover_image: song.cover_image,
        duration_seconds: song.duration_seconds || 300,
        genre: song.genre,
        language: song.language,
        mood: Array.isArray(song.mood) ? song.mood : (song.mood ? [song.mood] : []),
        tags: Array.isArray(song.tags) ? song.tags : (song.tags ? [song.tags] : []),
        play_count: song.play_count || 0,
        like_count: song.like_count || 0,
        is_trending: song.is_trending || false,
        is_featured: song.is_featured || false,
        release_date: song.release_date || new Date().toISOString().split('T')[0],
        lyrics: song.lyrics || null,
        youtube_url: song.youtube_url || null,
        lyrics_synced: song.lyrics_synced || null,
        audio_duration: song.audio_duration || song.duration_seconds || null,
        created_at: song.created_at || new Date().toISOString()
      });

      if (error) throw error;
      console.log(`✅ Saved curated song "${song.title}" with ID ${song.id} to Supabase Database.`);
    } catch (err) {
      console.error('❌ Failed to upsert song with Supabase database:', err);
    }
  }

  res.json({ success: true, song });
});

// DELETE a specific song by ID from the server-side database
app.delete('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  const originalLen = curatedSongs.length;
  curatedSongs = curatedSongs.filter(s => s.id !== id);
  
  if (curatedSongs.length < originalLen) {
    saveCuratedSongs(curatedSongs);
    console.log(`❌ Deleted curated song ID "${id}" from local file.`);
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('healers_songs').delete().eq('id', id);
      if (error) throw error;
      console.log(`❌ Deleted curated song ID "${id}" from Supabase.`);
    } catch (err) {
      console.error('❌ Failed to delete song from Supabase:', err);
    }
  }

  res.json({ success: true, message: 'Song deleted successfully.' });
});

// POST for bulk deletion of songs from the server-side database
app.post('/api/songs/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'List of IDs to delete is required.' });
  }

  curatedSongs = curatedSongs.filter(s => !ids.includes(s.id));
  saveCuratedSongs(curatedSongs);
  console.log(`❌ Bulk deleted ${ids.length} song IDs from local file.`);

  if (supabase) {
    try {
      const { error } = await supabase.from('healers_songs').delete().in('id', ids);
      if (error) throw error;
      console.log(`❌ Bulk deleted ${ids.length} songs from Supabase.`);
    } catch (err) {
      console.error('❌ Failed to bulk-delete songs from Supabase:', err);
    }
  }

  res.json({ success: true, message: 'Songs bulk-deleted successfully.' });
});

// Helper for mapping language ISO codes to Healers platform categories
function mapLanguageBadge(code: string): string {
  if (!code) return 'English';
  const norm = code.toLowerCase();
  if (norm.startsWith('bn') || norm.includes('bengali') || norm.includes('bangla')) return 'Bangla';
  if (norm.startsWith('en') || norm.includes('english')) return 'English';
  if (norm.startsWith('hi') || norm.includes('hindi') || norm.includes('samskrit') || norm.includes('sanskrit')) return 'Hindi';
  if (norm.startsWith('ko') || norm.includes('korean')) return 'Korean';
  return 'Others';
}

// AI-powered high-precision language detection helper
async function detectSongLanguageWithAI(title: string, lyrics: string, detectedLangCode?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // If no API key, use fallback local heuristics
    return mapLanguageBadge(detectedLangCode || "English");
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `You are an expert music systems neural linguist.
Based on the following track parameters:
1. Title: "${title}"
2. Lyrics or descriptive text excerpt: "${lyrics.slice(0, 400)}"
3. Whispered audio detection hint: "${detectedLangCode || 'unknown'}"

Determine which platform language category this song belongs to. Your response must be strictly and exclusively one of the following category strings:
- "Bangla"
- "English"
- "Hindi"
- "Korean"
- "Others"

CRITICAL: Return ONLY one of the exact strings "Bangla", "English", "Hindi", "Korean", or "Others". Do not write markdown blocks, explanations, punctuation, or multiple words.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const result = (response.text || "").trim().replace(/[Ww]ith/g, '').replace(/[Mm]y/g, '');
    const possibleLangs = ["Bangla", "English", "Hindi", "Korean", "Others"];
    for (const lang of possibleLangs) {
      if (result.toLowerCase().includes(lang.toLowerCase())) {
        return lang;
      }
    }
  } catch (err) {
    console.warn("⚠️ AI language detection threw an error, falling back:", err);
  }

  return mapLanguageBadge(detectedLangCode || "English");
}

// AI helper that transliterates all lyrics into English script (Roman characters) and corrects spelling/typos smoothly, keeping clean formatting with no emojis or icons
async function transliterateAndCorrectLyricsWithAI(rawLyrics: string, language?: string): Promise<string> {
  const stripEmojisAndSymbols = (str: string) => {
    if (!str) return str;
    return str
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .replace(/[🎨🎵✨🌸🌌💫🧘🏽‍♂️🧘🌿🍃🌀🌊🤍🤎🖤💜💙💚💛🧡❤️🔥💥💨🌨️☀️⭐🌟👁️👣👄👅👂🏽👃🏽💆🏽‍♀️🏋🏽‍♂️🏃🏽‍♂️🏽]/g, '')
      .trim();
  };

  if (!rawLyrics || !rawLyrics.trim()) {
    return "[Silent / Instrumental]";
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // If no API key, do a very basic local cleanup
    console.log("ℹ️ GEMINI_API_KEY is not configured for lyric processing. Operating local emoji filter.");
    return stripEmojisAndSymbols(rawLyrics);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `You are a professional lyric editor and systems translator/transliterator for Healers Care music platform.
Your task is to take the following raw lyrics and transform them according to these golden rules:
1. SCRIPT FOR LYRICS: All lyrics MUST be written/typed in high-quality standard Roman script/English characters only (Standard English script/Transliterated alphabet).
   - If the lyrics are in Bengali/Bangla, transliterate them phonetically to clean, readable English characters (e.g. "shonar bangla ami tomay bhalobashi" instead of "সোনার বাংলা আমি তোমায় ভালোবাসি").
   - If the lyrics are in Hindi, transliterate them phonetically into English letters (e.g. "tum hi ho" instead of "तुम ही हो" or "kabira" instead of "कबीरा").
   - If the lyrics are in Chinese, Korean, Spanish, Arabic, or other languages, transliterated phonetically into English letters.
   - If the lyrics are already in English/Roman script, keep them in English/Roman script.
2. SPELLING & GRAMMAR CORRECTION: Correct all typos, spelling errors, structural word mistakes, punctuation, and formatting errors in the lyrics. Ensure perfect phrasing and elegant lyrical spacing.
3. ABSOLUTELY NO EMOJIS, ICONS, OR DECORATIVE SYMBOLS: Under no circumstances should there be any emojis (such as 🎶, ✨, 🧘, 🌸) or descriptive icons.
4. Keep the original structure of lines and paragraphs (verses/chorus labels like "[Chorus]" can remain in English).

Raw lyrics to correct and transliterate into English script:
"""
${rawLyrics}
"""

Please respond with ONLY the final corrected and transliterated romanized lyric plain text. Do not add conversational intro or outro.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const txt = response.text || rawLyrics;
    return stripEmojisAndSymbols(txt);

  } catch (err) {
    console.warn("⚠️ Gemini raw lyric correction/transliteration threw error:", err);
    return stripEmojisAndSymbols(rawLyrics);
  }
}

async function transliterateAndCorrectSegmentsWithAI(segments: any[]): Promise<any[]> {
  if (!segments || segments.length === 0) return [];
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // Local fallback: just strip emoji-like patterns from the texts
    return segments.map(seg => ({
      ...seg,
      text: (seg.text || "").replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
    }));
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `You are a professional music systems curator. Below is a JSON array of synchronized lyric segments with "start" and "end" timestamps in seconds, and the corresponding "text".
Your goal is to transliterate and correct the "text" property of EVERY object following these strict rules:
1. All translated or transliterated texts MUST be written in English characters (Standard Roman letters only). Phonetically transcribe the text of languages like Bengali, Hindi, Korean, Chinese, etc. to standard English script (e.g., "shonar bangla" instead of "সোনার বাংলা" or "tum hi ho" instead of "तुम ही हो").
2. Correct spelling, grammar errors, word mistakes, typos, and styling issues in the English script.
3. Absolutely NO emojis or icons should ever exist in any texts.
4. Keep the timestamps ("start" and "end") EXACTLY unchanged.
5. Conform the output strictly to a JSON array of objects with start (number), end (number), and text (string) fields.

Segments JSON:
${JSON.stringify(segments, null, 2)}

Return strictly the output conformant JSON array only.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              text: { type: Type.STRING }
            },
            required: ["start", "end", "text"]
          }
        }
      }
    });

    const textOutput = response.text;
    if (textOutput) {
      return JSON.parse(textOutput.trim());
    }
  } catch (err) {
    console.warn("⚠️ Segment transliteration failed, returning original segments with basic strip:", err);
  }

  return segments.map(seg => ({
    ...seg,
    text: (seg.text || "").replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
  }));
}

// AI generator helper that uses Gemini with safety filters to beautify song titles & composers smoothly, free of emojis & icons
async function generateAiCompleteMetadata(rawTitle: string): Promise<{
  title: string;
  artist: string;
  lyricist: string;
  composer: string;
  genre: string;
  language: string;
  tags: string[];
  moods: string[];
  release_date: string;
  description: string;
}> {
  const stripEmojisAndIcons = (str: string) => {
    if (!str) return str;
    return str
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .replace(/[^\w\s\u0980-\u09FF\u0900-\u097F]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const clean = cleanSongLocal(rawTitle);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // Local fallback cleaner when API key is unprovided
    let cleanTitle = stripEmojisAndIcons(clean);
    let guessedArtist = "Devotional Healers";
    let guessedGenre = "Devotional";
    let guessedLanguage = "English";
    let guessedLyricist = "Traditional Composer";
    let guessedComposer = "Healers Collective";
    let guessedDescription = "A comforting, therapeutic melody created to ease minor stress and invite mental clarity.";

    const lower = rawTitle.toLowerCase();
    if (lower.includes('sitar')) {
      guessedArtist = "Acoustic Sitar Ensembles";
      guessedGenre = "Classical";
      guessedComposer = "Traditional Raga Maestro";
      guessedDescription = "An immersive sitar sound alignment calibrated with rich overtones for peaceful, mindful focus.";
    } else if (lower.includes('flute') || lower.includes('bansuri')) {
      guessedArtist = "Himalayan Flute Masters";
      guessedGenre = "Classical";
      guessedComposer = "Pandit Hariprasad Chaurasia";
      guessedDescription = "Calm bamboo flute performance carrying centuries of traditional breathing wisdom and tranquility.";
    } else if (lower.includes('raag') || lower.includes('raga')) {
      guessedArtist = "Vedic Swara Ensembles";
      guessedGenre = "Classical";
      guessedComposer = "Pandit Ravi Shankar";
      guessedDescription = "Spirited classical Hindustani Raga composition providing divine resonance and cellular alignment.";
    } else if (lower.includes('rabindra') || lower.includes('bengali') || lower.includes('bangla') || lower.includes('amar') || lower.includes('shonar')) {
      guessedArtist = "Surer Healer";
      guessedGenre = "Bangla";
      guessedLanguage = "Bangla";
      guessedLyricist = "Rabindranath Tagore";
      guessedComposer = "Rabindranath Tagore";
      guessedDescription = "Timeless Rabindra Sangeet composition evoking deep devotion, natural harmony, and emotional solace.";
    } else if (lower.includes('nazrul') || lower.includes('shyama')) {
      guessedArtist = "Surer Healer";
      guessedGenre = "Bangla";
      guessedLanguage = "Bangla";
      guessedLyricist = "Kazi Nazrul Islam";
      guessedComposer = "Kazi Nazrul Islam";
      guessedDescription = "Enchanting Shyama Sangeet or Nazrul Geeti offering beautiful spiritual empowerment.";
    } else if (lower.includes('lofi') || lower.includes('lo-fi')) {
      guessedGenre = "Lo-fi";
      guessedArtist = "Aura Focus";
      guessedDescription = "Productivity-inducing organic lo-fi track utilizing binaural beats for deep coding and studying focus.";
    }

    return {
      title: cleanTitle || "Therapeutic Soundscape",
      artist: guessedArtist,
      lyricist: guessedLyricist,
      composer: guessedComposer,
      genre: guessedGenre,
      language: guessedLanguage,
      tags: ['peace', 'calm', 'meditation', 'ambient'],
      moods: ['Chill', 'Spiritual'],
      release_date: "2026-05-25",
      description: guessedDescription
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        artist: { type: Type.STRING },
        lyricist: { type: Type.STRING },
        composer: { type: Type.STRING },
        genre: { type: Type.STRING },
        language: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        moods: { type: Type.ARRAY, items: { type: Type.STRING } },
        release_date: { type: Type.STRING },
        description: { type: Type.STRING }
      },
      required: ["title", "artist", "lyricist", "composer", "genre", "language", "tags", "moods", "release_date", "description"]
    };

    const prompt = `You are a professional music metadata curator for Healers Care, a premium, calm, and therapeutic music platform.
Analyze the following raw track or video title: "${rawTitle}".
Generate detailed metadata for this track conforming strictly to this specification:
1. "title": A beautiful, polished, and elegant title for the composition (e.g. "Sacred Flute of Varanasi" or "শীতল সুর"). Strip away all brackets, promotional text e.g. (Official Music Video), [Lyric Video], HQ, HD, etc.
2. "artist": A beautifully generated, classic, and professional composer, artist, or curator name (e.g. Pandit Hariprasad, Santoor Meditations Lounge, etc.). If no distinct artist exists, beautifully invent a fitting acoustic curator profile.
3. "lyricist": The lyricist/writer/poet of the song (e.g., "Rabindranath Tagore" for Rabindra Sangeet, "Kazi Nazrul Islam" for Nazrul Geeti, or "Traditional" / "Instrumental" if appropriate).
4. "composer": The composer/music maker (e.g. "Rabindranath Tagore", "Pandit Hariprasad Chaurasia" or "Traditional").
5. "genre": Must strictly be one of: 'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Classical', 'Jazz', 'Electronic', 'Lo-fi', 'Indie', 'Metal', 'Folk', 'Devotional', 'Bangla', 'Bollywood', 'K-Pop', 'Others'.
6. "language": Must strictly be one of: 'Bangla', 'English', 'Hindi', 'Korean', 'Others'.
7. "tags": 3 to 5 short descriptive tags.
8. "moods": List containing some of: 'Chill', 'Happy', 'Sad', 'Energetic', 'Romantic', 'Focus', 'Workout', 'Party', 'Sleepy', 'Spiritual'.
9. "release_date": Standard date (YYYY-MM-DD). Use "2026-05-25" or custom estimated date.
10. "description": A short, calm, and professional background explanation (1-2 sentences) about the healing properties, meaning, or history of this raga/track.

CRITICAL REQUIREMENT:
- Absolutely do NOT include any emojis (like 🧘, 🎵, ✨, 🌸, etc.) or icons or special decorative symbols in any of the textual fields.
- Respond with a strictly formatted JSON object matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const textOutput = response.text || "";
    const parsed = JSON.parse(textOutput.trim());
    
    // Validate genre
    const validGenres = ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Classical', 'Jazz', 'Electronic', 'Lo-fi', 'Indie', 'Metal', 'Folk', 'Devotional', 'Bangla', 'Bollywood', 'K-Pop', 'Others'];
    let finalGenre = parsed.genre || 'Devotional';
    if (!validGenres.includes(finalGenre)) {
      const matched = validGenres.find(g => g.toLowerCase() === finalGenre.toLowerCase());
      finalGenre = matched || 'Devotional';
    }

    // Validate language
    const validLangs = ['Bangla', 'English', 'Hindi', 'Korean', 'Others'];
    let finalLang = parsed.language || 'English';
    if (!validLangs.includes(finalLang)) {
      const matched = validLangs.find(l => l.toLowerCase() === finalLang.toLowerCase());
      finalLang = matched || 'Others';
    }

    return {
      title: stripEmojisAndIcons(parsed.title || rawTitle),
      artist: stripEmojisAndIcons(parsed.artist || "Devotional Healers"),
      lyricist: stripEmojisAndIcons(parsed.lyricist || "Traditional"),
      composer: stripEmojisAndIcons(parsed.composer || "Traditional"),
      genre: finalGenre,
      language: finalLang,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => stripEmojisAndIcons(t)) : ['peace', 'ambient'],
      moods: Array.isArray(parsed.moods) ? parsed.moods : ['Chill'],
      release_date: parsed.release_date || "2026-05-25",
      description: stripEmojisAndIcons(parsed.description || "Calming background ambience.")
    };

  } catch (err) {
    console.warn("⚠️ Error generating complete AI metadata in Gemini container:", err);
    return {
      title: stripEmojisAndIcons(clean) || "Therapeutic Soundscape",
      artist: "Devotional Healers",
      lyricist: "Traditional",
      composer: "Traditional",
      genre: "Devotional",
      language: "English",
      tags: ['peace', 'ambient'],
      moods: ['Chill'],
      release_date: "2026-05-25",
      description: "A calming soundscape on Healers platform."
    };
  }
}

function cleanSongLocal(title: string): string {
  if (!title) return title;
  let clean = title;
  const regexClutter = /[\(\[][^\)\]]*(official|music\s+video|video|audio|lyric|lyrics|mv|hq|hd|remix|cover|karaoke|studio|full\s+song|full\s+audio|lyrical|4k|1080p|720p)[^\)\]]*[\)\]]/gi;
  clean = clean.replace(regexClutter, '');
  const exactPatterns = [
    /[-|/\s]+official\s+(music\s+)?video\s*$/i,
    /[-|/\s]+official\s+audio\s*$/i,
    /[-|/\s]+official\s+lyric(s)?\s+video\s*$/i,
    /[-|/\s]+official\s+song\s*$/i,
    /[-|/\s]+official\s*$/i,
    /[-|/\s]+mv\s*$/i,
    /[-|/\s]+lyric(al)?\s+video\s*$/i,
    /[-|/\s]+lyrics\s*$/i,
    /[-|/\s]+audio\s*$/i,
    /[-|/\s]+video\s*$/i,
    /[-|/\s]+full\s+(audio|song)\s*$/i,
  ];
  for (const pattern of exactPatterns) {
    clean = clean.replace(pattern, '');
  }
  clean = clean.replace(/\s+/g, ' ');
  return clean.trim();
}

async function generateAiCleanTitleAndArtist(rawTitle: string): Promise<{ title: string; artist: string }> {
  const meta = await generateAiCompleteMetadata(rawTitle);
  return { title: meta.title, artist: meta.artist };
}

// Low-risk fallback simulator when API keys are unprovided or fail
async function getSimulatedYoutubeResult(youtubeUrl: string, youtubeVideoId: string, res: any) {
  const lowerUrl = youtubeUrl.toLowerCase();
  
  let mockYtTitle = "Therapeutic Curated YouTube Healing Melody";
  if (lowerUrl.includes('sitar')) {
    mockYtTitle = "Beautiful Sitar Meditations & Sacred Devotional Sitar Raga (Official Music Video)";
  } else if (lowerUrl.includes('flute') || lowerUrl.includes('bansuri')) {
    mockYtTitle = "Whispers of the Eternal Mountain Flute - Ambient Bansuri Raga HQ Solo";
  } else if (lowerUrl.includes('rabindra') || lowerUrl.includes('amar')) {
    mockYtTitle = "Amar Shonar Bangla - Rabindra Sangeet 🧘 [Traditional Bengalis Masterpiece]";
  }

  // Generate beautiful AI complete metadata
  const enhanced = await generateAiCompleteMetadata(mockYtTitle);

  const duration = 215; // 3 mins 35 secs
  const isBengali = lowerUrl.includes('bengali') || lowerUrl.includes('sangeet') || lowerUrl.includes('raga') || lowerUrl.includes('amar') || lowerUrl.includes('shanti');

  const lyricsPlain = isBengali
    ? "আমার সোনার বাংলা আমি তোমায় ভালোবাসি\nচিরদিন তোমার আকাশ তোমার বাতাস আমার প্রাণে বাজায় বাঁশি"
    : "Breathe in the ancient mountain light\nSlow down your busy mind loops\nLet the sound carry your soul away";

  // Generate high quality video cover thumbnail
  const thumbnail = `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`;

  const lyricsSynced = isBengali
    ? [
        { start: 0.0, end: 5.5, text: "[হৃদয়স্পর্শী সেতারের সুর সংগীত শুরু]" },
        { start: 5.5, end: 12.0, text: "আমার সোনার বাংলা আমি তোমায় ভালোবাসি" },
        { start: 12.0, end: 20.0, text: "চিরদিন তোমার আকাশ তোমার বাতাস" },
        { start: 20.0, end: 28.0, text: "আমার প্রাণে বাজায় বাঁশি ওমা আমার প্রাণে বাজায় বাঁশি" },
        { start: 28.0, end: 35.0, text: "সোনার বাংলা আমি তোমায় ভালোবাসি" }
      ]
    : [
        { start: 0.0, end: 6.0, text: "[Peaceful Devotional Ambient Flute Sounds]" },
        { start: 6.0, end: 13.0, text: "Breathe in the ancient mountain light" },
        { start: 13.0, end: 20.0, text: "Slow down your busy mind loops" },
        { start: 20.0, end: 27.0, text: "Let the sound carry your soul away" },
        { start: 27.0, end: 34.0, text: "[Ambient Chime Solo Outro]" }
      ];

  const audio_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3";

  return res.json({
    success: true,
    title: enhanced.title,
    artist: enhanced.artist,
    lyricist: enhanced.lyricist,
    composer: enhanced.composer,
    genre: enhanced.genre,
    language: enhanced.language,
    tags: enhanced.tags,
    moods: enhanced.moods,
    release_date: enhanced.release_date,
    description: enhanced.description,
    duration,
    thumbnail,
    lyrics: lyricsPlain,
    lyrics_synced: lyricsSynced,
    audio_url,
    youtube_url: youtubeUrl,
    is_simulated: true
  });
}

// AI-powered YouTube Mp3 fetch and Whisper transcription API
app.post('/api/admin/import-youtube', async (req, res) => {
  const { youtubeUrl } = req.body;
  if (!youtubeUrl) {
    return res.status(400).json({ error: "Please enter a valid YouTube Video URL." });
  }

  // Strip trailing punctuation (like english periods/commas, bengali dari '৷', spaces or trailing question marks)
  let cleanUrl = youtubeUrl.toString().trim();
  cleanUrl = cleanUrl.replace(/[৷\.\,\?\!\s]+$/, "");

  // Regex to extract 11-char YouTube ID
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = cleanUrl.match(regExp);
  const youtubeVideoId = (match && match[2].length === 11) ? match[2] : cleanUrl;

  if (!youtubeVideoId || youtubeVideoId.length !== 11) {
    return res.status(400).json({ error: "Could not extract an 11-character Video ID. Please check the URL syntax." });
  }

  const rapidKey = process.env.RAPIDAPI_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!rapidKey || !groqKey) {
    console.log("⚠️ RAPIDAPI_KEY or GROQ_API_KEY is not defined. Using Sandbox Simulator Mode.");
    // Simulate latency of processing
    await new Promise(r => setTimeout(r, 2200));
    return await getSimulatedYoutubeResult(youtubeUrl, youtubeVideoId, res);
  }

  try {
    // Stage 1: Get download link from RapidAPI
    const rapidUrl = `https://youtube-mp36.p.rapidapi.com/dl?id=${youtubeVideoId}`;
    let dlResponse = await axios.get(rapidUrl, {
      headers: {
        'X-RapidAPI-Key': rapidKey,
        'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
      }
    });

    if (dlResponse.data.status === 'processing') {
      console.log("⏱️ Video is queuing. Waiting 3.5 seconds to retry...");
      await new Promise(r => setTimeout(r, 3500));
      dlResponse = await axios.get(rapidUrl, {
        headers: {
          'X-RapidAPI-Key': rapidKey,
          'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
        }
      });
    }

    const apiData = dlResponse.data;
    if (!apiData || apiData.status === 'fail' || !apiData.link) {
      return res.status(400).json({ error: apiData.msg || "The requested YouTube video is not available or failed downloading on RapidAPI." });
    }

    const duration = apiData.duration || 0;
    if (duration > 600) {
      return res.status(400).json({ error: "The video exceeds our limit of 10 minutes. Please select a shorter healing track." });
    }

    const originalTitle = apiData.title || "YouTube Acoustic Import";
    const enhanced = await generateAiCompleteMetadata(originalTitle);
    const title = enhanced.title;
    const downloadLink = apiData.link;

    // Stage 2: Download MP3 and upload to Supabase Admin is available
    const mp3Response = await axios.get(downloadLink, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(mp3Response.data);

    let finalAudioUrl = downloadLink;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        
        // Ensure the public storage bucket 'songs' exists
        try {
          const { data: buckets } = await supabaseAdmin.storage.listBuckets();
          const bucketExists = buckets?.some(b => b.name === 'songs');
          if (!bucketExists) {
            console.log("Bucket 'songs' not found. Creating it...");
            await supabaseAdmin.storage.createBucket('songs', { public: true });
            console.log("Bucket 'songs' successfully created.");
          }
        } catch (bucketSetupErr) {
          console.warn("Attempted to check or create bucket 'songs' but failed (it might already exist or not be permitted):", bucketSetupErr);
        }

        const fileExt = "mp3";
        const filename = `songs/yt-${youtubeVideoId}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('songs')
          .upload(filename, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicData } = supabaseAdmin.storage
            .from('songs')
            .getPublicUrl(filename);
          finalAudioUrl = publicData.publicUrl;
        } else {
          console.error("Supabase write uploaded error:", uploadError);
        }
      } catch (stErr) {
        console.error("Supabase Storage admin bucket write failed:", stErr);
      }
    }

    // Stage 3: Whisper API Transcribe
    let lyrics = "";
    let lyricsSynced: any[] = [];
    let detectedLang = "en";

    try {
      const tempPath = path.join(os.tmpdir(), `${youtubeVideoId}-${Date.now()}.mp3`);
      fs.writeFileSync(tempPath, audioBuffer);

      const groq = new Groq({ apiKey: groqKey });
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-large-v3',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      }) as any;

      // Safe clean
      try { fs.unlinkSync(tempPath); } catch (_) {}

      lyrics = transcription.text || "";
      detectedLang = transcription.language || "en";

      if (transcription.segments && Array.isArray(transcription.segments)) {
        lyricsSynced = transcription.segments.map((seg: any) => ({
          start: parseFloat(seg.start),
          end: parseFloat(seg.end),
          text: (seg.text || "").trim()
        }));
      }

      // Modern AI: Romanize/Transliterate and edit/correct spelling issues in lyrics
      if (lyrics) {
        lyrics = await transliterateAndCorrectLyricsWithAI(lyrics, detectedLang);
      }
      if (lyricsSynced && lyricsSynced.length > 0) {
        lyricsSynced = await transliterateAndCorrectSegmentsWithAI(lyricsSynced);
      }
    } catch (whisperErr) {
      console.error("Whisper transcription failed, saving as blank plain lyrics:", whisperErr);
    }

    return res.json({
      success: true,
      title: enhanced.title,
      artist: enhanced.artist,
      lyricist: enhanced.lyricist,
      composer: enhanced.composer,
      genre: enhanced.genre,
      language: enhanced.language,
      tags: enhanced.tags,
      moods: enhanced.moods,
      release_date: enhanced.release_date,
      description: enhanced.description,
      duration,
      thumbnail: `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
      lyrics,
      lyrics_synced: lyricsSynced,
      audio_url: finalAudioUrl,
      youtube_url: youtubeUrl,
      is_simulated: false
    });

  } catch (err: any) {
    console.error("Real rapid API processing threw error. Falling back to sandbox simulation.", err);
    return await getSimulatedYoutubeResult(youtubeUrl, youtubeVideoId, res);
  }
});

// API for notifying requester via email when a song gets added by metadata curators
app.post('/api/notify-song-added', async (req, res) => {
  const { title, artist, requesterEmail, requestId } = req.body;

  if (!title || !requesterEmail) {
    return res.status(400).json({ error: 'Song title and requester email are required.' });
  }

  // Update internal tracked requests statuses
  songRequests = songRequests.map(r => {
    const matchesId = requestId && String(r.id) === String(requestId);
    const matchesTitleAndEmail = r.title.toLowerCase() === title.toLowerCase() && r.requesterEmail.toLowerCase() === requesterEmail.toLowerCase();
    if (matchesId || matchesTitleAndEmail) {
      return { ...r, status: 'added' as const };
    }
    return r;
  });
  saveSongRequests(songRequests);

  // Also add it as a curated song on the server if it doesn't already exist
  const reqObj = songRequests.find(r => {
    return (requestId && String(r.id) === String(requestId)) || 
           (r.title.toLowerCase() === title.toLowerCase() && r.requesterEmail.toLowerCase() === requesterEmail.toLowerCase());
  });

  const songExists = curatedSongs.some(s => s.title.toLowerCase() === title.toLowerCase());
  const generatedId = `sng-${requestId ? requestId.replace('req-', '') : Date.now()}`;
  const newSong = {
    id: generatedId,
    title: title,
    artist_id: 'art-healers',
    album_id: null,
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    cover_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop',
    duration_seconds: 300,
    genre: reqObj && reqObj.genre && reqObj.genre !== 'Any' ? reqObj.genre : 'Devotional',
    language: 'Bangla',
    lyricist: 'Traditional raga',
    composer: 'Healers Ensemble',
    description: reqObj && reqObj.notes ? reqObj.notes : 'A tranquil devotional composition shared by our subscriber community.',
    mood: ['Calm', 'Peaceful'],
    tags: ['raga', 'meditational', 'community'],
    is_trending: false,
    is_featured: false,
    release_date: new Date().toISOString().split('T')[0],
    lyrics: `[00:00] (Aromatic Acoustic Soundscape)\n[00:15] OM and deep breaths...\n[01:00] The cosmic raga expands beautifully through space.`
  };

  if (!songExists) {
    curatedSongs.push(newSong);
    saveCuratedSongs(curatedSongs);
    console.log(`✅ Automatically saved newly approved song request "${title}" to server DB.`);
  }

  if (supabase) {
    // 1. Update request status
    if (requestId) {
      const isNumeric = /^\d+$/.test(String(requestId));
      if (isNumeric) {
        supabase.from('healers_requests')
          .update({ status: 'added' })
          .eq('id', parseInt(String(requestId), 10))
          .then(({ error }) => {
            if (error) console.warn('⚠️ Fails to update request status in Supabase by numeric ID:', error);
            else console.log(`✅ Updated request status in Supabase to 'added' for numeric ID ${requestId}`);
          });
      } else {
        // Fallback for custom prefixed IDs - match by title and lowercased requester email
        supabase.from('healers_requests')
          .update({ status: 'added' })
          .eq('title', title)
          .eq('requester_email', requesterEmail)
          .then(({ error }) => {
            if (error) console.warn('⚠️ Fails to update request status in Supabase by title/email fallback:', error);
            else console.log(`✅ Updated request status in Supabase to 'added' using title "${title}" / email "${requesterEmail}" fallback`);
          });
      }
    }

    // 2. Upsert new song
    if (!songExists) {
      supabase.from('healers_songs')
        .upsert({
          id: newSong.id,
          title: newSong.title,
          artist_id: newSong.artist_id,
          album_id: newSong.album_id,
          audio_url: newSong.audio_url,
          cover_image: newSong.cover_image,
          duration_seconds: newSong.duration_seconds,
          genre: newSong.genre,
          language: newSong.language,
          mood: newSong.mood,
          tags: newSong.tags,
          is_trending: newSong.is_trending,
          is_featured: newSong.is_featured,
          release_date: newSong.release_date,
          lyrics: newSong.lyrics,
          created_at: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.error('❌ Failed to save auto-approved song to Supabase heaters_songs:', error);
          else console.log(`✅ Synced auto-approved song "${newSong.title}" to Supabase.`);
        });
    }
  }

  const transporter = getTransporter();
  const mailSender = process.env.SMTP_FROM || `Healers Care <${process.env.SMTP_USER || 'no-reply@healers.com'}>`;

  const emailSubject = `✨ [Healers Soundboard] Your Requested Raga "${title}" has been added!`;
  const emailBodyHtml = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 25px; border: 1px solid #e1e1e1; border-radius: 12px; background-color: #fafafa; text-align: center; color: #1f2937;">
      <div style="font-size: 48px; margin-bottom: 10px;">🌟</div>
      <h2 style="color: #6366f1; margin: 0 0 10px 0;">Your Requested Track Is Now Live!</h2>
      <p style="font-size: 15px; line-height: 1.5; color: #4b5563;">
        Peaceful Soul, we are absolutely delighted to let you know that our master curators have processed and added your requested composition:
      </p>
      
      <div style="padding: 16px; background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; display: inline-block; margin: 15px auto; min-width: 250px;">
        <strong style="font-size: 18px; color: #111827;">"${title}"</strong><br/>
        <span style="color: #4b5563; font-size: 14px;">by ${artist || 'Devotional Curators'}</span>
      </div>

      <p style="font-size: 14px; line-height: 1.5; text-align: left; color: #4b5563; margin-top: 20px;">
        Head over to the Healers Soundboard home hub to stream this calming sound. Let it cleanse your cosmic rhythm!
      </p>

      <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 11px; color: #9ca3af;">
        Calibrated therapeutic alignments platform. Keep spreading peaceful vibes! 🧘🏽‍♂️
      </div>
    </div>
  `;

  let emailStatus = 'simulated';
  let smtpErrorMessage = null;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: mailSender,
        to: requesterEmail,
        subject: emailSubject,
        html: emailBodyHtml,
      });
      console.log(`✅ Nodemailer - Alert email dispatched to subscriber (${requesterEmail}) for added song "${title}"`);
      emailStatus = 'sent';
    } catch (err: any) {
      smtpErrorMessage = err.message;
      console.error('❌ Failed to dispatch SMTP notice of added song. Falling back to simulated logger:', err.message);
      console.log(`\n========================================\n📧 [FALLBACK SIMULATED NODEMAILER TRANSMISSION due to SMTP Error]\nTo: ${requesterEmail}\nSubject: ${emailSubject}\nBody:\n${emailBodyHtml}\n========================================\n`);
    }
  } else {
    console.log(`\n========================================\n📧 [SIMULATED NODEMAILER TRANSMISSION]\nTo: ${requesterEmail}\nSubject: ${emailSubject}\nBody:\n${emailBodyHtml}\n========================================\n`);
  }

  return res.json({ 
    success: true, 
    message: smtpErrorMessage
      ? `Request updated successfully, but email dispatch failed (${smtpErrorMessage}). Notice has been simulated in the server console!`
      : transporter && emailStatus === 'sent'
        ? `Notification email dispatched to ${requesterEmail}.`
        : `Notification email simulated in server logs for ${requesterEmail}.`,
    emailStatus,
    smtpError: smtpErrorMessage
  });
});

// AI-powered URL analysis using Gemini 3.5-flash with Search Grounding
function getSimulatedUrlAnalysis(url: string) {
  const lowerUrl = url.toLowerCase();
  let parsedTitle = "Therapeutic Calming Sunset Melodies";
  
  if (lowerUrl.includes('sitar')) {
    parsedTitle = "Aura Sitar Focus Soundscape";
  } else if (lowerUrl.includes('flute') || lowerUrl.includes('bansuri')) {
    parsedTitle = "Whispers of the Eternal Mountain Flute";
  } else if (lowerUrl.includes('sleep') || lowerUrl.includes('night')) {
    parsedTitle = "Sacred Sleep Relaxation Sounds";
  } else if (lowerUrl.includes('watch?v=')) {
    const parts = url.split('v=');
    if (parts[1]) {
      parsedTitle = `YouTube Music Piece (${parts[1].slice(0, 11)})`;
    }
  }

  return {
    title: parsedTitle,
    artist: "Pranayam Devotionals",
    lyricist: "Traditional Poet",
    composer: "Vedic Flute Masters",
    description: "A restorative, peaceful vibration designed to help release anxiety and soothe the physical body.",
    genre: "Devotional",
    language: lowerUrl.includes('bengali') || lowerUrl.includes('bangla') ? "Bangla" : "English",
    tags: ["meditation", "calming", "peace", "anti-stress"],
    moods: ["Chill", "Spiritual"],
    release_date: "2026-05-25",
    lyrics: "✨ [Beautiful Instrumental Sitar & Flute Solo]\n\nBreathe in the tranquility of the current moment.\nSlow down your busy loops.\nLet the majestic, calming sounds carry you away into safe harbor.\n\nKeep inhaling... and deeply exhaling...",
    is_trending: true,
    is_featured: false
  };
}

app.post('/api/admin/analyze-url', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Please provide a valid music, video, or song link." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.log("⚠️ GEMINI_API_KEY is not defined or is placeholder. Using sandbox helper analysis.");
    return res.json({
      success: true,
      data: getSimulatedUrlAnalysis(url),
      is_simulated: true
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "The song/raga/album/track title. Keep it clean and elegant under 60 characters." },
        artist: { type: Type.STRING, description: "The creator, artist, composer, performer, or curator name." },
        lyricist: { type: Type.STRING, description: "The lyricist, songwriter, or writer of the track." },
        composer: { type: Type.STRING, description: "The musical composer of the composition." },
        description: { type: Type.STRING, description: "A beautifully written short calming background overview of this composition (1-2 sentences)." },
        genre: { type: Type.STRING, description: "Must strictly match one of: 'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Classical', 'Jazz', 'Electronic', 'Lo-fi', 'Indie', 'Metal', 'Folk', 'Devotional', 'Bangla', 'Bollywood', 'K-Pop', 'Others'" },
        language: { type: Type.STRING, description: "Must strictly match one of: 'Bangla', 'English', 'Hindi', 'Korean', 'Others'" },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "A list of 3-6 short tag keywords or categories describing the track."
        },
        moods: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Subset list containing some of: 'Chill', 'Happy', 'Sad', 'Energetic', 'Romantic', 'Focus', 'Workout', 'Party', 'Sleepy', 'Spiritual'."
        },
        release_date: { type: Type.STRING, description: "Standard ISO date format: YYYY-MM-DD. Estimate if unknown." },
        lyrics: { type: Type.STRING, description: "The actual vocal lyrics or poetic/breathing guidance." },
        is_trending: { type: Type.BOOLEAN, description: "Whether this song matches hot, highly-engaging trends." },
        is_featured: { type: Type.BOOLEAN, description: "Whether this composition deserves front page feature." }
      },
      required: ["title", "artist", "genre", "language", "tags", "moods", "release_date", "lyrics", "is_trending", "is_featured"]
    };

    const prompt = `Research the song or video from this URL: "${url}". Use Google Search grounding to retrieve authentic details like title, artist, release date, genre, and lyrics elements. Conform strictly to the given responseSchema.`;

    let response;
    let isSearchGroundingUsed = true;
    let isStandardModelParsing = false;

    try {
      // Tier 1: With Google Search Grounding for fresh, depth details
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    } catch (groundingErr: any) {
      const errStr = String(groundingErr?.message || groundingErr);
      const isQuotaExceeded = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
      
      if (isQuotaExceeded) {
        console.warn("⚠️ Google Search Grounding is unavailable on this free-tier API key (Quota Limit/429). Shifting cleanly to standard parse...");
      } else {
        console.warn("⚠️ Google Search Grounding call failed. Shifting to standard parse:", errStr.slice(0, 200));
      }
      
      isSearchGroundingUsed = false;
      isStandardModelParsing = true;

      // Tier 2: Standard structured modeling (keeps lower latency, ignores Google Search tool costs/quotas)
      const standardPrompt = `Review the following music or composition link: "${url}". Based on the URL text and your internal knowledge, extract or estimate the song title, artist, standard genre, language, tags, moods, release date (estimate current), and elegant calming breathing/listening guidance. Formulate the response strictly of responseSchema shape.`;
      
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: standardPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
    }

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response text returned from Gemini API.");
    }

    const cleanedJson = JSON.parse(textOutput.trim());
    if (cleanedJson.lyrics) {
      cleanedJson.lyrics = await transliterateAndCorrectLyricsWithAI(cleanedJson.lyrics, cleanedJson.language || "English");
    }
    return res.json({
      success: true,
      data: cleanedJson,
      is_simulated: false,
      is_grounded: isSearchGroundingUsed,
      is_standard_parse: isStandardModelParsing
    });

  } catch (err: any) {
    const errStr = String(err?.message || err);
    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota")) {
      console.warn("ℹ️ Gemini API key quota fully exhausted or rate-limited. Serving beautiful local heuristic analysis instead.");
    } else {
      console.warn("ℹ️ Gemini URL analysis pipeline fell back safely to local heuristic analysis: ", errStr.slice(0, 200));
    }
    return res.json({
      success: true,
      data: getSimulatedUrlAnalysis(url),
      is_simulated: true,
      is_grounded: false,
      is_standard_parse: false,
      error_msg: errStr.slice(0, 150)
    });
  }
});

// Endpoint for manual interactive lyric correction/transliteration using Gemini
app.post('/api/admin/correct-lyrics-ai', async (req, res) => {
  const { lyrics, language } = req.body;
  if (!lyrics) {
    return res.status(400).json({ error: "Please provide lyrics to clean and correct." });
  }

  try {
    const correctedLyrics = await transliterateAndCorrectLyricsWithAI(lyrics, language || "English");
    return res.json({
      success: true,
      correctedLyrics
    });
  } catch (err: any) {
    console.error("Manual AI lyric correction failed:", err);
    return res.status(500).json({ error: "Failed to process lyrics with AI. Please try again." });
  }
});

async function startServer() {
  // Vite dev server middleware mounting
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULL-STACK ACTIVE] Healers Server running on port ${PORT}`);
  });
}

startServer();
