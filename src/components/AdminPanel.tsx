import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, Music, Disc, User, ShieldAlert, Sparkles, TrendingUp, Calendar, 
  Eye, Edit, Trash2, CheckCircle, Search, SlidersHorizontal, Plus, 
  EyeOff, FolderPlus, Info, Upload, Check, ChevronRight,
  Flame, Crown, Sunrise, Brain, Moon, Lightbulb,
  Link as LinkIcon, FileAudio, Globe, RefreshCw, Play, Pause, Loader2,
  Leaf, Smile, CloudRain, Zap, Heart, Compass, Inbox
} from 'lucide-react';
import { useHealersStore } from '../store';
import { toast } from 'sonner';
import { Song, Artist, Album, User as SystemUser } from '../types';
import { GENRES, MOODS } from '../data';
import { syncHelper } from '../lib/supabase';

const renderAdminMoodIcon = (emojiName: string, className = "w-3.5 h-3.5") => {
  switch (emojiName) {
    case 'Leaf': return <Leaf className={className} />;
    case 'Smile': return <Smile className={className} />;
    case 'CloudRain': return <CloudRain className={className} />;
    case 'Zap': return <Zap className={className} />;
    case 'Heart': return <Heart className={className} />;
    case 'Brain': return <Brain className={className} />;
    case 'Flame': return <Flame className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    case 'Moon': return <Moon className={className} />;
    case 'Compass': return <Compass className={className} />;
    default: return <Sparkles className={className} />;
  }
};

export function cleanSongTitle(title: string): string {
  if (!title) return title;
  
  let clean = title;
  
  // Remove content inside parentheses or square brackets that contains common youtube clutter keywords
  // e.g. (Official Music Video), [Official Audio Code], (Lyric Video), [MV], (HD), etc.
  const regexClutter = /[\(\[][^\)\]]*(official|music\s+video|video|audio|lyric|lyrics|mv|hq|hd|remix|cover|karaoke|studio|full\s+song|full\s+audio|lyrical|4k|1080p|720p)[^\)\]]*[\)\]]/gi;
  clean = clean.replace(regexClutter, '');
  
  // also clean up literal remaining loose clutter markers not in brackets (like " | Official Audio", " - Official Music Video", etc.)
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
  
  // Remove any double spaces, trailing spaces, trailing hyphens, vertical bars or slashes introduced by removals
  clean = clean.replace(/\s+/g, ' ');
  clean = clean.replace(/[-|/\s]+$/, '');
  clean = clean.replace(/^[-|/\s]+/, '');
  
  return clean.trim();
}

export const AdminPanel: React.FC<{ initialTab?: 'dashboard' | 'songs' | 'all-songs' | 'albums' | 'artists' | 'users' | 'analytics' | 'requests' }> = ({ initialTab }) => {
  const {
    songs, artists, albums, users, playHistory, bannedUserIds, currentUser,
    addSong, editSong, deleteSong, deleteSongsBulk,
    addAlbum, editAlbum, deleteAlbum,
    addArtist, editArtist, deleteArtist,
    updateUserRole, toggleBanUser, playTrack
  } = useHealersStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'songs' | 'all-songs' | 'albums' | 'artists' | 'users' | 'analytics' | 'requests'>(initialTab || 'dashboard');

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      if (data.requests) {
        setRequestsList(data.requests);
      }
    } catch (err) {
      console.error("Failed to fetch song requests:", err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab]);

  const handleLoadRequestForImport = (req: any) => {
    setYoutubeUrl(req.youtubeUrl || '');
    setNewSongTitle(req.title || '');
    setNewSongNotifierEmail(req.requesterEmail || '');
    setActiveRequestId(req.id || null);
    setUploadTab('import');
    setActiveTab('songs');
    toast.info(`Request for "${req.title}" loaded successfully!`, {
      description: `We populated the YouTube URL and the submit notifier with the requester's email (${req.requesterEmail}). Dynamic Whisper & Gemini curation pipeline is ready!`,
      duration: 5000
    });
  };

  const handleDirectApprove = async (req: any) => {
    try {
      // 1. Check if song already exists in local state catalog
      const exists = songs.some(s => s.title.toLowerCase() === req.title.toLowerCase());
      
      // 2. Submit status update and trigger Nodemailer
      const res = await fetch('/api/notify-song-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: req.title,
          artist: req.artist || 'Curated Healing Creator',
          requesterEmail: req.requesterEmail || 'guest@purpleheart.com',
          requestId: req.id
        })
      });

      if (!res.ok) {
        throw new Error('Failed to update request or send email notification.');
      }

      // 3. If track does not exist yet inside catalog, inject a valid mock composition so they can listen to it directly!
      if (!exists) {
        const generatedId = `sng-${Date.now()}`;
        const finalData = {
          id: generatedId,
          title: req.title,
          artist_id: 'art-healers', // associate with default "Healers" account
          album_id: null,
          audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // standard fallback meditational flow
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
          release_date: new Date().toISOString().split('T')[0],
          lyrics: `[00:00] (Aromatic Acoustic Soundscape)\n[00:15] OM and deep breaths...\n[01:00] The cosmic raga expands beautifully through space.`
        };

        addSong(finalData as any);
        await syncHelper.syncSong(finalData);
      }

      toast.success(`Request for "${req.title}" approved successfully!`);
      toast.info(`Nodemailer confirmation dispatched to ${req.requesterEmail}`);
      fetchRequests();
    } catch (err: any) {
      console.error("Direct approval error:", err);
      toast.error(`Approval action failed: ${err.message || err}`);
    }
  };

  // ==========================================
  // SHARED MOCK ANALYTICS DATA BUILDERS
  // ==========================================
  const totalPlays = useMemo(() => songs.reduce((acc, s) => acc + s.play_count, 0), [songs]);
  const totalLikes = useMemo(() => songs.reduce((acc, s) => acc + s.like_count, 0), [songs]);

  // Generates genre play share
  const genrePlayData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    songs.forEach(s => {
      counts[s.genre] = (counts[s.genre] || 0) + s.play_count;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [songs]);

  // Daily plays projection last 14 days
  const dailyPlaysData = useMemo(() => {
    return [
      { name: '05-12', plays: 1240 },
      { name: '05-13', plays: 1450 },
      { name: '05-14', plays: 1100 },
      { name: '05-15', plays: 1980 },
      { name: '05-16', plays: 2320 },
      { name: '05-17', plays: 2150 },
      { name: '05-18', plays: 2470 },
      { name: '05-19', plays: 3100 },
      { name: '05-20', plays: 2890 },
      { name: '05-21', plays: 3450 },
      { name: '05-22', plays: 4120 },
      { name: '05-23', plays: 3980 },
      { name: '05-24', plays: 4890 },
      { name: '05-25', plays: 5410 } // Today
    ];
  }, []);

  // Top 10 most played songs
  const topSongsData = useMemo(() => {
    return [...songs]
      .sort((a, b) => b.play_count - a.play_count)
      .slice(0, 8)
      .map(s => ({
        name: s.title.slice(0, 15) + (s.title.length > 15 ? '..' : ''),
        plays: s.play_count
      }));
  }, [songs]);

  const COLORS = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

  // ==========================================
  // VIEW HOOKS: SONGS CRUD & SEEDS
  // ==========================================
  const [songSearch, setSongSearch] = useState('');
  const [songGenreFilter, setSongGenreFilter] = useState('All');
  const [songArtistFilter, setSongArtistFilter] = useState('All');
  const [selectedBulkSongs, setSelectedBulkSongs] = useState<string[]>([]);
  
  // Create Song panel toggle
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);

  // New Song Fields State
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongAlbum, setNewSongAlbum] = useState('');
  const [newSongGenre, setNewSongGenre] = useState('Devotional');
  const [newSongLanguage, setNewSongLanguage] = useState('English');
  const [newSongMoods, setNewSongMoods] = useState<string[]>(['Chill']);
  const [newSongTags, setNewSongTags] = useState('');
  const [newSongReleaseDate, setNewSongReleaseDate] = useState('2026-05-25');
  const [newSongLyrics, setNewSongLyrics] = useState('');
  const [newSongLyricist, setNewSongLyricist] = useState('');
  const [newSongComposer, setNewSongComposer] = useState('');
  const [newSongDescription, setNewSongDescription] = useState('');
  const [newSongIsTrending, setNewSongIsTrending] = useState(false);
  const [newSongIsFeatured, setNewSongIsFeatured] = useState(false);
  const [newSongNotifierEmail, setNewSongNotifierEmail] = useState('');
  
  // Interactive Upload Dropzones Simulations
  const [audioUploadSuccess, setAudioUploadSuccess] = useState(false);
  const [coverUploadSuccess, setCoverUploadSuccess] = useState(false);
  const [simulatedAudioUrl, setSimulatedAudioUrl] = useState('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  const [simulatedCoverUrl, setSimulatedCoverUrl] = useState('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=55');

  // YouTube AI Import States
  const [uploadTab, setUploadTab] = useState<'import' | 'manual'>('import');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importLogs, setImportLogs] = useState<{ text: string; status: 'pending' | 'success' | 'error' }[]>([]);
  const [importedSongData, setImportedSongData] = useState<{
    title: string;
    artist?: string;
    lyricist?: string;
    composer?: string;
    genre?: string;
    language: string;
    tags?: string[];
    moods?: string[];
    release_date?: string;
    description?: string;
    duration: number;
    thumbnail: string;
    lyrics: string;
    lyrics_synced: any[];
    audio_url: string;
    youtube_url: string;
    is_simulated: boolean;
  } | null>(null);
  const [useYtThumbnail, setUseYtThumbnail] = useState(true);
  const [demoAudioPlaying, setDemoAudioPlaying] = useState(false);
  const [demoAudioEl, setDemoAudioEl] = useState<HTMLAudioElement | null>(null);

  // AI URL Auto-Fill States
  const [aiFillUrl, setAiFillUrl] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiFillError, setAiFillError] = useState<string | null>(null);
  const [aiFillSuccess, setAiFillSuccess] = useState(false);
  const [aiFillMode, setAiFillMode] = useState<'grounded' | 'standard' | 'simulated' | 'none'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [isCorrectingLyrics, setIsCorrectingLyrics] = useState(false);

  const handleCorrectLyricsWithAI = async () => {
    if (!newSongLyrics) return;
    setIsCorrectingLyrics(true);
    try {
      const res = await fetch('/api/admin/correct-lyrics-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lyrics: newSongLyrics,
          language: newSongLanguage
        })
      });
      const parsed = await res.json();
      if (parsed.success && parsed.correctedLyrics) {
        setNewSongLyrics(parsed.correctedLyrics);
        toast.success("Lyrics polished and transliterated by Gemini AI!");
      } else if (parsed.error) {
        toast.error(parsed.error);
      }
    } catch (err) {
      console.error("AI correction request failed:", err);
      toast.error("AI lyric correction currently offline or rates exhausted.");
    } finally {
      setIsCorrectingLyrics(false);
    }
  };

  // Custom confirmation modal state to bypass iframe window.confirm limitations!
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleAiAutoFill = async () => {
    if (!aiFillUrl) return;
    setIsAiFilling(true);
    setAiFillError(null);
    setAiFillSuccess(false);
    setAiFillMode('none');

    try {
      const response = await fetch('/api/admin/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: aiFillUrl })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to analyze link using AI.");
      }

      const resData = await response.json();
      if (resData.success && resData.data) {
        const item = resData.data;
        setNewSongTitle(cleanSongTitle(item.title || ''));
        setNewSongGenre(item.genre || 'Devotional');
        setNewSongLanguage(item.language || 'English');
        
        if (Array.isArray(item.tags)) {
          setNewSongTags(item.tags.join(', '));
        } else if (typeof item.tags === 'string') {
          setNewSongTags(item.tags);
        }

        if (Array.isArray(item.moods)) {
          setNewSongMoods(item.moods);
        }

        if (item.release_date) {
          setNewSongReleaseDate(item.release_date);
        }

        if (item.lyrics) {
          setNewSongLyrics(item.lyrics);
        }

        if (item.lyricist) setNewSongLyricist(item.lyricist);
        if (item.composer) setNewSongComposer(item.composer);
        if (item.description) setNewSongDescription(item.description);

        setNewSongIsTrending(!!item.is_trending);
        setNewSongIsFeatured(!!item.is_featured);

        // Try to fuzzy match artist name
        if (item.artist) {
          const matched = artists.find(a => 
            a.name.toLowerCase().includes(item.artist.toLowerCase()) || 
            item.artist.toLowerCase().includes(a.name.toLowerCase())
          );
          if (matched) {
            setNewSongArtist(matched.id);
          } else {
            // Auto register the artist profile so it exists in selection
            const generatedArtId = `art-${Date.now()}`;
            addArtist({
              name: item.artist,
              avatar_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=120&auto=format&fit=crop',
              cover_image: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=500&auto=format&fit=crop',
              bio: `Premium meditative curator with deep healing acoustic paths.`,
              verified: true
            });
            setNewSongArtist(generatedArtId);
          }
        } else if (artists.length > 0) {
          const standby = artists.find(a => a.id === 'art-healers') || artists[0];
          setNewSongArtist(standby.id);
        }

        // If it is a YouTube URL, populate the YouTube import field as well for visual asset sync
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        // Clean trailing punctuation from the url
        const cleanAiUrl = (aiFillUrl || "").trim().replace(/[৷\.\,\?\!\s]+$/, "");
        if (cleanAiUrl.match(regExp)) {
          setYoutubeUrl(cleanAiUrl);
        }

        // Set the success mode
        if (resData.is_simulated) {
          setAiFillMode('simulated');
        } else if (resData.is_grounded) {
          setAiFillMode('grounded');
        } else if (resData.is_standard_parse) {
          setAiFillMode('standard');
        } else {
          setAiFillMode('grounded');
        }

        setAiFillSuccess(true);
        // Do not clear the success indicator automatically too fast, so the user can easily read the quality/resource level
      } else {
        throw new Error(resData.error_msg || "Failed to parse link details with Gemini API.");
      }
    } catch (err: any) {
      console.error(err);
      setAiFillError(err.message || "An error occurred while analyzing with AI.");
    } finally {
      setIsAiFilling(false);
    }
  };

  // Filter songs lists
  const filteredSongs = useMemo(() => {
    return songs.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
                            (artists.find(a => a.id === s.artist_id)?.name || '').toLowerCase().includes(songSearch.toLowerCase());
      const matchesGenre = songGenreFilter === 'All' || s.genre === songGenreFilter;
      const matchesArtist = songArtistFilter === 'All' || s.artist_id === songArtistFilter;
      return matchesSearch && matchesGenre && matchesArtist;
    });
  }, [songs, artists, songSearch, songGenreFilter, songArtistFilter]);

  const toggleBulkSong = (id: string) => {
    if (selectedBulkSongs.includes(id)) {
      setSelectedBulkSongs(selectedBulkSongs.filter(item => item !== id));
    } else {
      setSelectedBulkSongs([...selectedBulkSongs, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedBulkSongs.length === 0) return;
    setConfirmDelete({
      isOpen: true,
      title: 'Bulk Delete Compositions',
      message: `Are you sure you want to bulk delete ${selectedBulkSongs.length} selected compositions from the database? This action is irreversible.`,
      onConfirm: () => {
        deleteSongsBulk(selectedBulkSongs);
        setSelectedBulkSongs([]);
      }
    });
  };

  const handleResetForm = () => {
    setNewSongTitle('');
    setNewSongArtist(artists[0]?.id || '');
    setNewSongAlbum('');
    setNewSongGenre('Devotional');
    setNewSongLanguage('English');
    setNewSongMoods(['Chill']);
    setNewSongTags('');
    setNewSongLyrics('');
    setNewSongLyricist('');
    setNewSongComposer('');
    setNewSongDescription('');
    setNewSongIsTrending(false);
    setNewSongIsFeatured(false);
    setAudioUploadSuccess(false);
    setCoverUploadSuccess(false);
    setEditingSongId(null);
    setNewSongNotifierEmail('');
    setActiveRequestId(null);

    if (demoAudioEl) {
      demoAudioEl.pause();
    }
    setDemoAudioPlaying(false);
    setDemoAudioEl(null);

    setUploadTab('import');
    setYoutubeUrl('');
    setImportStatus('idle');
    setImportLogs([]);
    setImportedSongData(null);
    setUseYtThumbnail(true);

    setAiFillUrl('');
    setAiFillError(null);
    setAiFillSuccess(false);
    setAiFillMode('none');
  };

  const handleFetchYoutubeImport = async () => {
    if (!youtubeUrl) return;
    
    setImportStatus('processing');
    setImportedSongData(null);
    setImportLogs([
      { text: "Fetching audio from YouTube...", status: 'pending' as const }
    ]);

    try {
      const res = await fetch('/api/admin/import-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed importing from YouTube URL.");
      }

      const info = await res.json();
      const cleanedTitle = cleanSongTitle(info.title || '');
      const assignedArtist = info.artist || 'Devotional Healers';

      await new Promise(r => setTimeout(r, 600));
      setImportLogs([
        { text: "Fetching audio from YouTube...", status: 'success' },
        { text: `Audio ready (${(info.duration / 60) | 0}:${(info.duration % 60).toString().padStart(2, '0')} mins)`, status: 'success' },
        { text: "Generating lyrics with AI Whisper model...", status: 'pending' }
      ]);

      await new Promise(r => setTimeout(r, 800));
      setImportLogs([
        { text: "Fetching audio from YouTube...", status: 'success' },
        { text: `Audio ready (${(info.duration / 60) | 0}:${(info.duration % 60).toString().padStart(2, '0')} mins)`, status: 'success' },
        { text: "Generating lyrics with AI Whisper model...", status: 'success' },
        { text: `Lyrics generated (${info.language} detected)`, status: 'success' },
        { text: `Beautifying track metadata with Gemini AI...`, status: 'pending' }
      ]);

      await new Promise(r => setTimeout(r, 800));
      setImportLogs([
        { text: "Fetching audio from YouTube...", status: 'success' },
        { text: `Audio ready (${(info.duration / 60) | 0}:${(info.duration % 60).toString().padStart(2, '0')} mins)`, status: 'success' },
        { text: "Generating lyrics with AI Whisper model...", status: 'success' },
        { text: `Lyrics generated (${info.language} detected)`, status: 'success' },
        { text: `AI cleansed track title: "${cleanedTitle}"`, status: 'success' },
        { text: `AI assigned artist profile: "${assignedArtist}"`, status: 'success' }
      ]);

      await new Promise(r => setTimeout(r, 400));
      
      setNewSongTitle(cleanedTitle);
      setNewSongLanguage(info.language || 'English');
      setNewSongLyrics(info.lyrics || '');
      setNewSongGenre(info.genre || 'Devotional');
      setNewSongTags(info.tags ? info.tags.join(', ') : '');
      setNewSongMoods(info.moods || ['Chill']);
      if (info.release_date) setNewSongReleaseDate(info.release_date);
      setNewSongLyricist(info.lyricist || '');
      setNewSongComposer(info.composer || '');
      setNewSongDescription(info.description || '');
      
      setImportedSongData({
        ...info,
        title: cleanedTitle
      });
      setImportStatus('success');

      // Try to fuzzy match artist name or dynamically register a verified profile
      if (info.artist) {
        const matched = artists.find(a => 
          a.name.toLowerCase().includes(info.artist.toLowerCase()) || 
          info.artist.toLowerCase().includes(a.name.toLowerCase())
        );
        if (matched) {
          setNewSongArtist(matched.id);
        } else {
          // Auto register the artist profile so it details beautifully on Purple Heart Soundboard
          const generatedArtId = `art-${Date.now()}`;
          addArtist({
            name: info.artist,
            avatar_url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=120&auto=format&fit=crop',
            cover_image: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=500&auto=format&fit=crop',
            bio: `Tranquil AI-curated sound therapist with pristine acoustic meditation guides.`,
            verified: true
          });
          setNewSongArtist(generatedArtId);
        }
      } else if (!newSongArtist && artists.length > 0) {
        const standby = artists.find(a => a.id === 'art-healers') || artists[0];
        setNewSongArtist(standby.id);
      }

      if (info.audio_url) {
        const audio = new Audio(info.audio_url);
        audio.addEventListener('ended', () => setDemoAudioPlaying(false));
        setDemoAudioEl(audio);
      }

    } catch (err: any) {
      console.error(err);
      setImportLogs(prev => [
        ...prev.map(l => l.status === 'pending' ? { ...l, status: 'error' as const, text: `${l.text} - Failed` } : l),
        { text: err.message || "Pipeline error during YouTube import.", status: 'error' }
      ]);
      setImportStatus('error');
    }
  };

  const handleCancelImport = () => {
    setImportStatus('idle');
    setImportLogs([]);
    setImportedSongData(null);
    if (demoAudioEl) {
      demoAudioEl.pause();
    }
    setDemoAudioPlaying(false);
    setDemoAudioEl(null);
  };

  const handleToggleDemoAudio = () => {
    if (!demoAudioEl) return;
    if (demoAudioPlaying) {
      demoAudioEl.pause();
      setDemoAudioPlaying(false);
    } else {
      demoAudioEl.play().catch(e => console.error("Preview playback context failed to launch:", e));
      setDemoAudioPlaying(true);
    }
  };

  const handleToggleAddMood = (moodName: string) => {
    if (newSongMoods.includes(moodName)) {
      setNewSongMoods(newSongMoods.filter(m => m !== moodName));
    } else {
      setNewSongMoods([...newSongMoods, moodName]);
    }
  };

  const handleSaveSongSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle || !newSongArtist) {
      toast.error('Song Title and Artist Selection are mandatory inputs.');
      return;
    }

    setIsSaving(true);
    try {
      const finalData = {
        title: newSongTitle,
        artist_id: newSongArtist,
        album_id: newSongAlbum || null,
        audio_url: uploadTab === 'import' && importedSongData ? importedSongData.audio_url : simulatedAudioUrl,
        cover_image: uploadTab === 'import' && importedSongData && useYtThumbnail ? importedSongData.thumbnail : simulatedCoverUrl,
        duration_seconds: uploadTab === 'import' && importedSongData ? importedSongData.duration : 320,
        genre: newSongGenre,
        language: newSongLanguage,
        lyricist: newSongLyricist,
        composer: newSongComposer,
        description: newSongDescription,
        mood: newSongMoods,
        tags: newSongTags.split(',').map(t => t.trim()).filter(t => t !== ''),
        is_trending: newSongIsTrending,
        is_featured: newSongIsFeatured,
        release_date: newSongReleaseDate,
        lyrics: newSongLyrics,
        youtube_url: uploadTab === 'import' && importedSongData ? importedSongData.youtube_url : undefined,
        lyrics_synced: uploadTab === 'import' && importedSongData ? importedSongData.lyrics_synced : undefined,
        audio_duration: uploadTab === 'import' && importedSongData ? importedSongData.duration : undefined
      };

      if (editingSongId) {
        editSong(editingSongId, finalData);
        
        // Async Sync to Supabase
        await syncHelper.syncSong({ id: editingSongId, ...finalData });
        
        toast.success('Tranquil song updated successfully.');
      } else {
        const generatedId = `sng-${Date.now()}`;
        addSong({ ...finalData, id: generatedId } as any);
        
        // Async Sync to Supabase
        await syncHelper.syncSong({ id: generatedId, ...finalData });

        if ((newSongNotifierEmail && newSongNotifierEmail.includes('@')) || activeRequestId) {
          const artistObj = artists.find(a => a.id === newSongArtist);
          const artistName = artistObj ? artistObj.name : 'Curated Healing Creator';
          const res = await fetch('/api/notify-song-added', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: newSongTitle,
              artist: artistName,
              requesterEmail: newSongNotifierEmail || 'guest@purpleheart.com',
              requestId: activeRequestId
            })
          });
          const resData = await res.json();
          console.log('Nodemailer dispatched alert:', resData);
          if (newSongNotifierEmail && newSongNotifierEmail.includes('@')) {
            toast.success(`Automated email notice sent to ${newSongNotifierEmail}!`);
          } else {
            toast.success('Song added and request status updated successfully!');
          }
        } else {
          toast.success('Song added successfully');
        }
      }

      handleResetForm();
      fetchRequests();
      setShowAddSongModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error('An error occurred while saving the composition: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerEdit = (song: Song) => {
    setEditingSongId(song.id);
    setNewSongTitle(song.title);
    setNewSongArtist(song.artist_id);
    setNewSongAlbum(song.album_id || '');
    setNewSongGenre(song.genre);
    setNewSongLanguage(song.language);
    setNewSongMoods(song.mood);
    setNewSongTags(song.tags.join(', '));
    setNewSongReleaseDate(song.release_date);
    setNewSongLyrics(song.lyrics || '');
    setNewSongLyricist((song as any).lyricist || '');
    setNewSongComposer((song as any).composer || '');
    setNewSongDescription((song as any).description || '');
    setNewSongIsTrending(song.is_trending);
    setNewSongIsFeatured(song.is_featured);
    setAudioUploadSuccess(true);
    setCoverUploadSuccess(true);
    setSimulatedAudioUrl(song.audio_url);
    setSimulatedCoverUrl(song.cover_image);
    setShowAddSongModal(true);
    setActiveTab('songs');
  };

  // ==========================================
  // VIEW HOOKS: ALBUMS MANAGEMENT
  // ==========================================
  const [showAddAlbumModal, setShowAddAlbumModal] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumArtist, setNewAlbumArtist] = useState('');
  const [newAlbumGenre, setNewAlbumGenre] = useState('Classical');
  const [newAlbumType, setNewAlbumType] = useState<'album' | 'ep' | 'single'>('album');
  const [newAlbumReleaseDate, setNewAlbumReleaseDate] = useState('2026-05-25');
  const [newAlbumCover, setNewAlbumCover] = useState('https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400');

  const handleSaveAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumTitle || !newAlbumArtist) return;

    const data = {
      title: newAlbumTitle,
      artist_id: newAlbumArtist,
      cover_image: newAlbumCover,
      release_date: newAlbumReleaseDate,
      genre: newAlbumGenre,
      type: newAlbumType
    };

    if (editingAlbumId) {
      editAlbum(editingAlbumId, data);
      toast.success('Album updated successfully.');
    } else {
      addAlbum(data);
      toast.success('New collaborative album prepped.');
    }

    setNewAlbumTitle('');
    setEditingAlbumId(null);
    setShowAddAlbumModal(false);
  };

  // ==========================================
  // VIEW HOOKS: ARTISTS MANAGEMENT
  // ==========================================
  const [showAddArtistModal, setShowAddArtistModal] = useState(false);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistBio, setNewArtistBio] = useState('');
  const [newArtistAvatar, setNewArtistAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400');
  const [newArtistCover, setNewArtistCover] = useState('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200');
  const [newArtistVerified, setNewArtistVerified] = useState(true);

  const handleSaveArtist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName) return;

    const data = {
      name: newArtistName,
      bio: newArtistBio,
      avatar_url: newArtistAvatar,
      cover_image: newArtistCover,
      verified: newArtistVerified
    };

    if (editingArtistId) {
      editArtist(editingArtistId, data);
      toast.success('Artist updated successfully.');
    } else {
      addArtist(data);
      toast.success('Artist added to platform directories.');
    }

    setNewArtistName('');
    setNewArtistBio('');
    setEditingArtistId(null);
    setShowAddArtistModal(false);
  };

  // ==========================================
  // VIEW HOOKS: USERS SELECTION LOGS
  // ==========================================
  const [userSearchText, setUserSearchText] = useState('');
  
  const filteredUsersList = useMemo(() => {
    return users.filter(u => 
      u.full_name.toLowerCase().includes(userSearchText.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchText.toLowerCase())
    );
  }, [users, userSearchText]);

  return (
    <div className="space-y-6 pb-26" id="admin-management-view">
      
      {/* Sidebar layout with headers */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Navigation panel */}
        <div className="lg:w-60 bg-brand-surface border border-gray-950 p-2 rounded-xl flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Sparkles },
            { id: 'songs', label: 'Upload & Import', icon: Upload },
            { id: 'requests', label: 'Song Requests', icon: Inbox },
            { id: 'all-songs', label: 'All Songs', icon: Music },
            { id: 'albums', label: 'Albums', icon: Disc },
            { id: 'artists', label: 'Artists', icon: User },
            { id: 'users', label: 'Users & Roles', icon: Users },
            { id: 'analytics', label: 'Analytics Insights', icon: TrendingUp }
          ].map(opt => {
            const Icon = opt.icon;
            const active = activeTab === opt.id;
            return (
              <button
                key={opt.id}
                id={`admin-nav-${opt.id}`}
                onClick={() => setActiveTab(opt.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-left text-xs font-bold font-mono transition-all flex-shrink-0 cursor-pointer ${
                  active 
                    ? 'bg-brand-primary text-white shadow shadow-brand-primary/20' 
                    : 'text-gray-400 hover:text-white hover:bg-brand-card/30'
                }`}
              >
                <Icon className="w-4 h-4" /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Inner Panel View screen content */}
        <div className="flex-1 bg-brand-surface/40 border border-gray-900 rounded-xl p-5 md:p-6 min-w-0">
          
          {/* ==========================================
              SUB-TAB 1: ANALYTICS OVERVIEW DASHBOARD
              ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in" id="admin-dashboard-overview-tab">
              
              {/* Quick Stat cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl flex items-center gap-3 shadow shadow-brand-secondary/5">
                  <div className="p-2.5 bg-brand-secondary/10 rounded-lg text-brand-secondary">
                    <Music className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 font-mono">Songs Catalog</p>
                    <p className="text-lg font-bold text-white mt-0.5">{songs.length}</p>
                  </div>
                </div>

                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl flex items-center gap-3 shadow">
                  <div className="p-2.5 bg-brand-primary/10 rounded-lg text-brand-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 font-mono">Members</p>
                    <p className="text-lg font-bold text-white mt-0.5">{users.length}</p>
                  </div>
                </div>

                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl flex items-center gap-3 shadow">
                  <div className="p-2.5 bg-brand-secondary/10 rounded-lg text-brand-secondary">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 font-mono">Total Plays</p>
                    <p className="text-lg font-bold text-white mt-0.5">{totalPlays.toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl flex items-center gap-3 shadow">
                  <div className="p-2.5 bg-brand-accent/10 rounded-lg text-brand-accent">
                    <ShieldAlert className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 font-mono">Banned</p>
                    <p className="text-lg font-bold text-brand-accent mt-0.5">{bannedUserIds.length}</p>
                  </div>
                </div>

              </div>

              {/* Grid 2: Charts Recharts widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Daily Plays Linechart */}
                <div className="p-4.5 bg-brand-surface border border-gray-900 rounded-xl space-y-4 shadow">
                  <h4 className="font-display font-medium text-xs tracking-widest text-gray-300 uppercase">Acoustic Flows (Daily plays)</h4>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyPlaysData}>
                        <XAxis dataKey="name" stroke="#525252" fontSize={10} fontClassName="font-mono" dy={5} />
                        <YAxis stroke="#525252" fontSize={10} fontClassName="font-mono" dx={-5} />
                        <Tooltip contentStyle={{ backgroundColor: '#12121A', borderColor: '#1F1F2F', borderRadius: '8px', fontSize: '11px' }} />
                        <Line type="monotone" dataKey="plays" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 1.5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Top Genres Pie share chart */}
                <div className="p-4.5 bg-brand-surface border border-gray-900 rounded-xl space-y-4 shadow">
                  <h4 className="font-display font-medium text-xs tracking-widest text-gray-300 uppercase">Streams By Vibe Genre</h4>
                  <div className="h-56 flex items-center justify-around flex-col sm:flex-row gap-4">
                    <div className="relative w-36 h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={genrePlayData} 
                            innerRadius={36} 
                            outerRadius={56} 
                            paddingAngle={4} 
                            dataKey="value"
                          >
                            {genrePlayData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {genrePlayData.map((g, idx) => (
                        <div key={g.name} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                          <span className="text-gray-300">{g.name}</span>
                          <span className="text-gray-500 font-mono text-[10px]">({(g.value).toLocaleString()})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==========================================
              SUB-TAB 2: SONGS UPLOAD & IMPORT FORM 
              ========================================== */}
          {activeTab === 'songs' && (
            <div className="space-y-6 animate-in fade-in" id="admin-upload-songs-tab">
              
              <div className="flex items-center justify-between pb-4 border-b border-gray-900">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-brand-primary" />
                  <h3 className="font-display font-semibold text-sm text-white">
                    {editingSongId ? 'Edit Calm Composition' : 'Upload / Import Calming Track'}
                  </h3>
                </div>
                {editingSongId && (
                  <button 
                    type="button" 
                    onClick={() => { handleResetForm(); setEditingSongId(null); }}
                    className="text-gray-500 hover:text-white cursor-pointer px-2.5 py-1 rounded bg-brand-bg/35 text-xs font-bold hover:bg-brand-bg/60 border border-gray-800 transition-colors"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>

              <form 
                id="admin-song-upload-form"
                onSubmit={handleSaveSongSubmit}
                className="p-5 bg-brand-surface border border-gray-800 rounded-xl space-y-4 text-xs select-none"
              >
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                    <h4 className="font-display font-bold text-sm text-white flex items-center gap-1.5 text-brand-secondary">
                      <FolderPlus className="w-4 h-4" /> {editingSongId ? 'Edit Calm Composition' : 'Upload Calm Composition'}
                    </h4>
                    
                    <button 
                      type="button" 
                      onClick={() => { handleResetForm(); setShowAddSongModal(false); }}
                      className="text-gray-500 hover:text-white cursor-pointer px-2.5 py-1 rounded bg-brand-bg/30 text-xs font-semibold hover:bg-brand-bg/60 border border-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {activeRequestId && (
                    <div className="p-3 bg-brand-primary/10 border border-brand-primary/25 rounded-xl flex items-center justify-between gap-3 text-brand-secondary animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-brand-secondary shrink-0 animate-pulse" />
                        <div>
                          <p className="font-bold text-gray-200">Active Request Mode Loaded</p>
                          <p className="text-[10px] text-gray-400">
                            Curating request ID <strong className="text-brand-secondary">{activeRequestId}</strong> for &ldquo;{newSongTitle}&rdquo;. Saving this composition will automatically mark the request as <span className="text-emerald-400 font-bold uppercase text-[9px]">Added & Live</span> and notify the subscriber ({newSongNotifierEmail}) via email.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRequestId(null);
                          setNewSongNotifierEmail('');
                          toast.info('Active request context cleared.');
                        }}
                        className="text-xs text-gray-400 hover:text-white hover:underline cursor-pointer font-mono shrink-0 px-2 py-1 bg-black/30 rounded border border-gray-800"
                      >
                        Clear Context
                      </button>
                    </div>
                  )}

                  {/* Tabs bar at the top of the Add Song section */}
                  {!editingSongId && (
                    <div className="flex border-b border-gray-800 pb-1">
                      <button
                        type="button"
                        onClick={() => setUploadTab('import')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                          uploadTab === 'import'
                            ? 'border-brand-secondary text-brand-secondary font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" /> Import from YouTube URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadTab('manual')}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                          uploadTab === 'manual'
                            ? 'border-brand-secondary text-brand-secondary font-semibold'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <FileAudio className="w-3.5 h-3.5" /> Upload Audio File (Manual)
                      </button>
                    </div>
                  )}

                  {/* YouTube Import Flow controls */}
                  {!editingSongId && uploadTab === 'import' && (
                    <div className="bg-brand-bg/40 border border-gray-805/80 p-4 rounded-xl space-y-4">
                      {/* Step 1: URL Input */}
                      <div>
                        <label className="block text-gray-400 mb-1.5 font-semibold flex items-center gap-1">
                          <LinkIcon className="w-3.5 h-3.5 text-brand-secondary" /> Paste YouTube URL *
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input 
                            type="text"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="e.g. https://www.youtube.com/watch?v=kY3NfP7aD4I"
                            className="flex-1 bg-brand-surface p-2.5 border border-gray-950 rounded-lg text-white min-w-0 w-full"
                            disabled={importStatus === 'processing'}
                          />
                          <button 
                            type="button"
                            onClick={handleFetchYoutubeImport}
                            disabled={!youtubeUrl || importStatus === 'processing'}
                            className="w-full sm:w-auto px-4 py-2.5 bg-brand-primary text-white font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer hover:bg-brand-primary/95 transition-all disabled:opacity-45 whitespace-nowrap"
                          >
                            {importStatus === 'processing' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Fetch Audio & Lyrics
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Processing Live Status Log */}
                      {importLogs.length > 0 && (
                        <div className="bg-brand-bg/60 p-4 border border-gray-800/50 rounded-lg space-y-2.5">
                          <h5 className="font-mono text-[10px] text-gray-500 uppercase tracking-widest font-bold">Import Processing Logs:</h5>
                          <div className="space-y-1.5">
                            {importLogs.map((log, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                                {log.status === 'pending' ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-brand-secondary" />
                                ) : log.status === 'success' ? (
                                  <span className="text-brand-secondary text-xs">●</span>
                                ) : (
                                  <span className="text-brand-accent text-xs">✕</span>
                                )}
                                <span className={
                                  log.status === 'pending' 
                                    ? 'text-gray-400 font-medium' 
                                    : log.status === 'error' 
                                    ? 'text-brand-accent font-semibold' 
                                    : 'text-gray-200'
                                }>
                                  {log.text}
                                </span>
                              </div>
                            ))}
                          </div>
                          {importStatus === 'processing' && (
                            <div className="flex justify-end pt-1">
                              <button 
                                type="button" 
                                onClick={handleCancelImport}
                                className="px-2.5 py-1 bg-brand-surface hover:bg-gray-800 text-gray-400 border border-gray-800 rounded font-mono text-[10px] cursor-pointer"
                              >
                                Cancel Import
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Step 3: Preview and Settings */}
                      {importStatus === 'success' && importedSongData && (
                        <div className="bg-brand-secondary/5 border border-brand-secondary/10 p-4 rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs uppercase tracking-wider text-brand-secondary flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> High Fidelity Audio Ready for Import
                            </span>
                            <span className="font-mono text-[10px] text-brand-secondary px-2 py-0.5 bg-brand-secondary/10 border border-brand-secondary/20 rounded-full font-bold">
                              Whisper Calibrated
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 items-center">
                            {/* YouTube Thumbnail Preview */}
                            <div className="relative w-32 aspect-video rounded-lg overflow-hidden border border-gray-800 bg-brand-surface flex-shrink-0">
                              <img 
                                src={importedSongData.thumbnail} 
                                alt="Fetched YouTube Preview"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>

                            {/* Details and Preview Player Button */}
                            <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                              <div className="font-semibold text-white truncate max-w-sm">{importedSongData.title}</div>
                              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3.5 text-gray-400 font-mono text-[11px]">
                                <span>Duration: <strong className="text-white">{(importedSongData.duration / 60) | 0}:{(importedSongData.duration % 60).toString().padStart(2, '0')}</strong></span>
                                <span className="flex items-center gap-1">
                                  Language Badge: 
                                  <span className="px-2 py-0.5 bg-brand-surface text-brand-secondary border border-gray-900 rounded-full font-bold">
                                    {importedSongData.language === 'Bangla' && "Bengali"}
                                    {importedSongData.language === 'English' && "English"}
                                    {importedSongData.language === 'Hindi' && "Hindi"}
                                    {importedSongData.language === 'Korean' && "Korean"}
                                    {importedSongData.language === 'Others' && "Other Language"}
                                  </span>
                                </span>
                              </div>

                              <div className="pt-1.5 flex justify-center sm:justify-start">
                                <button
                                  type="button"
                                  onClick={handleToggleDemoAudio}
                                  className="px-4 py-1.5 bg-brand-surface text-gray-200 border border-gray-800 rounded-lg flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-gray-800"
                                >
                                  {demoAudioPlaying ? <Pause className="w-3.5 h-3.5 text-brand-secondary animate-pulse" /> : <Play className="w-3.5 h-3.5" />}
                                  {demoAudioPlaying ? "Pause Sound Preview" : "Preview YouTube Audio Track"}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-gray-900">
                            <input 
                              type="checkbox" 
                              id="use-yt-cover" 
                              checked={useYtThumbnail}
                              onChange={(e) => setUseYtThumbnail(e.target.checked)}
                              className="accent-brand-primary cursor-pointer w-4 h-4"
                            />
                            <label htmlFor="use-yt-cover" className="text-gray-300 font-medium cursor-pointer">
                              Use this YouTube Thumbnail as the final cover image
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(editingSongId || uploadTab === 'manual') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Column 1 inputs */}
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-gray-400 mb-1 font-semibold">Song Title *</label>
                        <input 
                          id="form-song-title"
                          type="text"
                          required
                          value={newSongTitle}
                          onChange={(e) => setNewSongTitle(e.target.value)}
                          className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white"
                          placeholder="e.g. Calm Flute Evening Meditation"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Curator / Artist *</label>
                          <select 
                            id="form-song-artist"
                            value={newSongArtist}
                            onChange={(e) => setNewSongArtist(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white font-medium"
                          >
                            <option value="">-- Choose artist --</option>
                            {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Album Association</label>
                          <select 
                            id="form-song-album"
                            value={newSongAlbum}
                            onChange={(e) => setNewSongAlbum(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white"
                          >
                            <option value="">Standalone / Single Track</option>
                            {albums.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Genre *</label>
                          <select 
                            id="form-song-genre"
                            value={newSongGenre}
                            onChange={(e) => setNewSongGenre(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white"
                          >
                            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Language *</label>
                          <select 
                            id="form-song-language"
                            value={newSongLanguage}
                            onChange={(e) => setNewSongLanguage(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white"
                          >
                            <option value="Bangla">Bangla</option>
                            <option value="English">English</option>
                            <option value="Hindi">Hindi / Sanskrit</option>
                            <option value="Korean">Korean (K-Pop)</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1 font-semibold">Tags (comma-separated)</label>
                        <input 
                          id="form-song-tags"
                          type="text"
                          value={newSongTags}
                          onChange={(e) => setNewSongTags(e.target.value)}
                          className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white placeholder-gray-600"
                          placeholder="e.g. sitar, peace, evening, anti-stress"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Lyricist / Writer (গীতিকার)</label>
                          <input 
                            id="form-song-lyricist"
                            type="text"
                            value={newSongLyricist}
                            onChange={(e) => setNewSongLyricist(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white placeholder-gray-650"
                            placeholder="e.g. Rabindranath Tagore"
                          />
                        </div>

                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Composer / Tune (সুরকার)</label>
                          <input 
                            id="form-song-composer"
                            type="text"
                            value={newSongComposer}
                            onChange={(e) => setNewSongComposer(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white placeholder-gray-650"
                            placeholder="e.g. Traditional Folk Tune"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1 font-semibold">Track Description (বিবরণ)</label>
                        <textarea 
                          id="form-song-description"
                          value={newSongDescription}
                          onChange={(e) => setNewSongDescription(e.target.value)}
                          rows={2}
                          className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white placeholder-gray-650 resize-none"
                          placeholder="Provide a beautifully compiled soothing story, background, or listening guides about this healing vibration..."
                        />
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1.5 font-semibold">Select Associated Moods</label>
                        <div className="flex flex-wrap gap-1.5 font-sans">
                          {MOODS.map(m => {
                            const isChosen = newSongMoods.includes(m.name);
                            return (
                              <button
                                key={m.name}
                                type="button"
                                onClick={() => handleToggleAddMood(m.name)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                  isChosen ? 'bg-brand-primary text-white font-semibold' : 'bg-brand-bg text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  {renderAdminMoodIcon(m.emoji, "w-3 h-3")}
                                  {m.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Column 2 Uploads & Flags toggles */}
                    <div className="space-y-4">
                      
                      {/* Interactive Drag & Drop Simulated Upload Areas */}
                      <div>
                        {editingSongId || uploadTab === 'manual' ? (
                          <>
                            <label className="block text-gray-400 mb-1 font-semibold">Simulated Supabase Storage Buckets Uploads</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-1.5">
                              {/* Drop 1: Audio file (mp3) */}
                              <div 
                                onClick={() => { setAudioUploadSuccess(true); toast.success('Simulated uploading audio binary file output.'); }}
                                className={`border-2 border-dashed p-4.5 rounded-lg text-center cursor-pointer transition-all ${
                                  audioUploadSuccess ? 'bg-brand-secondary/10 border-brand-secondary/60 text-brand-secondary' : 'bg-brand-bg/60 border-gray-900 text-gray-400 hover:border-gray-800'
                                }`}
                              >
                                <Upload className="w-5 h-5 mx-auto mb-1 text-brand-secondary" />
                                <p className="font-bold text-[10px]">Audio Track Choice *</p>
                                <p className="text-[8px] text-gray-500 mt-1">Accepts MP3, WAV (Max 50MB)</p>
                                {audioUploadSuccess && <span className="inline-flex items-center gap-1 text-[9px] bg-brand-secondary/10 text-brand-secondary px-2 py-0.5 rounded-full font-bold mt-1.5"><Check className="w-3 h-3" /> Locked in</span>}
                              </div>

                              {/* Drop 2: Cover Art image */}
                              <div 
                                onClick={() => { setCoverUploadSuccess(true); toast.success('Cover image simulated upload completed.'); }}
                                className={`border-2 border-dashed p-4.5 rounded-lg text-center cursor-pointer transition-all ${
                                  coverUploadSuccess ? 'bg-brand-secondary/10 border-brand-secondary/60 text-brand-secondary' : 'bg-brand-bg/60 border-gray-900 text-gray-400 hover:border-gray-800'
                                }`}
                              >
                                <Upload className="w-5 h-5 mx-auto mb-1 text-brand-secondary" />
                                <p className="font-bold text-[10px]">Cover Thumbnail Image *</p>
                                <p className="text-[8px] text-gray-500 mt-1">Accepts JPG, PNG (Max 5MB)</p>
                                {coverUploadSuccess && <span className="inline-flex items-center gap-1 text-[9px] bg-brand-secondary/10 text-brand-secondary px-2 py-0.5 rounded-full font-bold mt-1.5"><Check className="w-3 h-3" /> Uploaded</span>}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-brand-secondary/5 border border-brand-secondary/10 p-3.5 rounded-lg space-y-1 text-xs select-none font-mono">
                            <span className="text-brand-secondary font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                              <Sparkles className="w-3 h-3 animate-pulse" /> Linked Asset Pipeline
                            </span>
                            <p className="text-gray-400 text-[11px] leading-relaxed">
                              Successfully fetched MP3 streaming audio and YouTube thumbnail high-resolution references.
                            </p>
                            <span className="inline-block text-[9px] text-gray-500">
                              (To override or upload local files, choose the manual tab)
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-gray-400 mb-1 font-semibold">Publish Release Date</label>
                          <input 
                            id="form-song-date"
                            type="date"
                            required
                            value={newSongReleaseDate}
                            onChange={(e) => setNewSongReleaseDate(e.target.value)}
                            className="w-full bg-brand-bg p-2 border border-gray-900 rounded-lg text-white font-mono"
                          />
                        </div>

                        {/* Flags toggling */}
                        <div className="flex flex-col justify-end gap-2.5">
                          <label className="flex items-center gap-2 text-gray-300 font-semibold cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newSongIsTrending} 
                              onChange={(e) => setNewSongIsTrending(e.target.checked)}
                              className="accent-brand-primary cursor-pointer w-4 h-4 rounded"
                            />
                            <Flame className="w-4 h-4 text-brand-accent shrink-0" /> Flare as Trending
                          </label>

                          <label className="flex items-center gap-2 text-gray-300 font-semibold cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newSongIsFeatured} 
                              onChange={(e) => setNewSongIsFeatured(e.target.checked)}
                              className="accent-brand-primary cursor-pointer w-4 h-4 rounded"
                            />
                            <Crown className="w-4 h-4 text-brand-secondary shrink-0" /> Flare as Featured banner
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1 font-semibold">Notify Requester Email (Optional - fires Nodemailer alert on submit)</label>
                        <input
                          id="form-song-notifier-email"
                          type="email"
                          value={newSongNotifierEmail}
                          onChange={(e) => setNewSongNotifierEmail(e.target.value)}
                          className="w-full bg-brand-bg p-2.5 text-xs border border-gray-900 focus:border-brand-primary rounded-lg text-white font-sans placeholder-gray-700"
                          placeholder="visitor@example.com (helps alert standard subscriber when song becomes live)"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-gray-400 font-semibold text-xs">
                            Lyrics (Standard English Script & Corrected AI Transliteration)
                          </label>
                          {newSongLyrics && (
                            <button
                              type="button"
                              onClick={handleCorrectLyricsWithAI}
                              disabled={isCorrectingLyrics}
                              className="px-2.5 py-1 text-[10px] font-bold bg-brand-primary/15 hover:bg-brand-primary/25 hover:scale-[1.02] active:scale-95 text-brand-primary rounded flex items-center gap-1 transition-all border border-brand-primary/30 cursor-pointer disabled:opacity-50"
                              title="Clean, transliterate to English script and correct errors using Gemini"
                            >
                              {isCorrectingLyrics ? (
                                <>
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  <span>AI Correcting...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-2.5 h-2.5 text-brand-primary animate-pulse" />
                                  <span>Correct & Romanize with AI</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        <textarea
                          id="form-song-lyrics"
                          value={newSongLyrics}
                          onChange={(e) => setNewSongLyrics(e.target.value)}
                          rows={5}
                          className="w-full bg-brand-bg p-2.5 text-[11px] border border-gray-900 rounded-lg text-white font-mono placeholder-gray-800 focus:outline-none focus:border-brand-primary/50"
                          placeholder="Type or paste lyrics in any language (Sanskrit, Bangla, English, Hindi, Korean, Chinese etc.). Use the AI button to automatically transliterate to standard English Roman script and fix spelling/grammar errors!"
                        ></textarea>
                      </div>

                    </div>

                  </div>
                )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-800/60 font-sans">
                    <button 
                      type="button" 
                      onClick={handleResetForm}
                      disabled={isAiFilling || importStatus === 'processing' || isSaving}
                      className="px-4 py-2 bg-brand-bg rounded-lg border border-gray-900 text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
                    >
                      Reset Slate
                    </button>
                    <button 
                      type="submit" 
                      disabled={isAiFilling || importStatus === 'processing' || isSaving || (!editingSongId && ((uploadTab === 'manual' && (!audioUploadSuccess || !coverUploadSuccess)) || (uploadTab === 'import' && !importedSongData)))}
                      className="px-5 py-2 bg-brand-primary text-white rounded-lg font-bold shadow shadow-brand-primary/15 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer"
                    >
                      {(isAiFilling || importStatus === 'processing' || isSaving) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      )}
                      {isSaving 
                        ? 'Publishing...' 
                        : (isAiFilling || importStatus === 'processing')
                        ? 'Waiting for AI / Loaders...'
                        : (!editingSongId && uploadTab === 'manual' && (!audioUploadSuccess || !coverUploadSuccess))
                        ? 'Upload Files to Enable'
                        : (!editingSongId && uploadTab === 'import' && !importedSongData)
                        ? 'Load URL to Enable'
                        : editingSongId 
                        ? 'Update Composition' 
                        : 'Save and Publish to Purple Heart'}
                    </button>
                  </div>
                </form>

            </div>
          )}

          {/* ==========================================
              SUB-TAB 2.5: ALL SONGS PLAYLISTS DATATABLE
              ========================================== */}
          {activeTab === 'all-songs' && (
            <div className="space-y-6 animate-in fade-in" id="admin-songs-tab">
              
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between pb-4 border-b border-gray-900">
                <div className="flex items-center gap-2">
                  <Music className="w-4.5 h-4.5 text-brand-secondary" />
                  <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-white">All Tracks Catalog</h3>
                  <span className="px-2 py-0.5 bg-brand-bg rounded-md border border-gray-900 font-mono text-[9px] text-gray-400 font-bold">
                    {filteredSongs.length} Titles
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-1 max-w-lg justify-end">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      id="admin-song-table-search"
                      type="text"
                      placeholder="Search tracks or healers..."
                      value={songSearch}
                      onChange={(e) => setSongSearch(e.target.value)}
                      className="w-full bg-brand-bg p-2 pl-9 text-xs border border-gray-900 rounded-lg text-white"
                    />
                  </div>

                  <select
                    value={songGenreFilter}
                    onChange={(e) => setSongGenreFilter(e.target.value)}
                    className="bg-brand-bg px-2.5 py-2 text-xs border border-gray-900 rounded-lg text-white font-semibold cursor-pointer max-h-10 outline-none focus:border-brand-primary"
                  >
                    <option value="All">All Vibe Genres</option>
                    {GENRES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>

                  <select
                    id="admin-song-artist-filter"
                    value={songArtistFilter}
                    onChange={(e) => setSongArtistFilter(e.target.value)}
                    className="bg-brand-bg px-2.5 py-2 text-xs border border-gray-900 rounded-lg text-white font-semibold cursor-pointer max-h-10 outline-none focus:border-brand-primary animate-all duration-250"
                  >
                    <option value="All">All Curators</option>
                    {artists.map(art => (
                      <option key={art.id} value={art.id}>{art.name}</option>
                    ))}
                  </select>

                  {/* High visibility toolbar Select All button for speedy curation */}
                  {filteredSongs.length > 0 && (
                    <div className="flex items-center gap-2 bg-brand-bg hover:bg-brand-surface/20 transition-all duration-200 px-3 py-2 rounded-lg border border-gray-900 text-xs">
                      <input 
                        type="checkbox" 
                        id="toolbar-select-all"
                        checked={selectedBulkSongs.length === filteredSongs.length && filteredSongs.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBulkSongs(filteredSongs.map(s => s.id));
                          } else {
                            setSelectedBulkSongs([]);
                          }
                        }}
                        className="accent-brand-primary cursor-pointer w-4 h-4 rounded transition-all duration-150 relative top-[0.5px]"
                      />
                      <label htmlFor="toolbar-select-all" className="cursor-pointer select-none font-sans font-bold text-gray-300 text-[11px] whitespace-nowrap">
                        Select All
                      </label>
                    </div>
                  )}

                  {selectedBulkSongs.length > 0 && (
                    <button 
                      id="admin-bulk-delete-btn"
                      onClick={handleBulkDelete}
                      className="px-3.5 py-2 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 text-xs font-bold font-mono rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap transition-all hover:bg-brand-accent/15 active:scale-95 duration-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Bulk Delete ({selectedBulkSongs.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Songs Datatable */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-900 text-gray-500 font-bold uppercase font-mono tracking-wider">
                      <th className="py-3 px-2 w-8">
                        <input 
                          type="checkbox" 
                          checked={selectedBulkSongs.length === filteredSongs.length && filteredSongs.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBulkSongs(filteredSongs.map(s => s.id));
                            } else {
                              setSelectedBulkSongs([]);
                            }
                          }}
                          className="accent-brand-primary cursor-pointer w-4 h-4"
                        />
                      </th>
                      <th className="py-3 px-2">Cover</th>
                      <th className="py-3 px-3">Title</th>
                      <th className="py-3 px-3">Curating Artist</th>
                      <th className="py-3 px-3">Genre</th>
                      <th className="py-3 px-2 text-center">Plays</th>
                      <th className="py-3 px-2 text-center">Featured</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900/60">
                    {filteredSongs.map(song => {
                      const isSelected = selectedBulkSongs.includes(song.id);
                      const artName = artists.find(a => a.id === song.artist_id)?.name || 'Curator';
                      return (
                        <tr key={song.id} className={`hover:bg-brand-surface/30 ${isSelected ? 'bg-brand-primary/5' : ''}`}>
                          <td className="py-3 px-2">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleBulkSong(song.id)}
                              className="accent-brand-primary cursor-pointer w-4 h-4"
                            />
                          </td>
                          <td className="py-3 px-2">
                            <img src={song.cover_image} alt="" className="w-8 h-8 rounded object-cover shadow" />
                          </td>
                          <td className="py-3 px-2.5 font-semibold text-white max-w-xs truncate">{song.title}</td>
                          <td className="py-3 px-3 text-gray-400">{artName}</td>
                          <td className="py-3 px-3 font-mono text-[10px] text-gray-400"><span className="px-1.5 py-0.5 bg-brand-bg rounded">{song.genre}</span></td>
                          <td className="py-3 px-2 text-center font-mono font-bold text-brand-secondary">{song.play_count.toLocaleString()}</td>
                          <td className="py-3 px-2 text-center">
                            {song.is_featured ? <span className="px-1.5 py-0.5 bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 rounded text-[9px] uppercase font-bold tracking-wider">Yes</span> : <span className="text-gray-600">-</span>}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex gap-2">
                              <button 
                                onClick={() => playTrack(song, songs)}
                                className="p-1 px-2.5 bg-brand-secondary/15 hover:bg-brand-secondary/35 text-brand-secondary rounded text-[10px]"
                              >
                                Play Test
                              </button>
                              <button 
                                onClick={() => handleTriggerEdit(song)}
                                className="p-1 bg-brand-bg hover:bg-brand-card rounded text-gray-400 hover:text-white"
                                title="Edit Calm details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setConfirmDelete({
                                  isOpen: true,
                                  title: 'Delete composition',
                                  message: `Are you sure you want to permanently delete "${song.title}" from the platform? This action is irreversible.`,
                                  onConfirm: () => deleteSong(song.id)
                                })}
                                className="p-1 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent rounded"
                                title="Delete from platform"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==========================================
              SUB-TAB 3: ALBUMS COHESIONS MANAGEMENT
              ========================================== */}
          {activeTab === 'albums' && (
            <div className="space-y-6 animate-in fade-in" id="admin-albums-tab">
              <div className="flex items-center justify-between pb-4 border-b border-gray-900">
                <h4 className="font-display font-medium text-xs tracking-widest text-gray-400 uppercase">Albums Management</h4>
                <button 
                  id="admin-add-album-toggle"
                  onClick={() => setShowAddAlbumModal(true)}
                  className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Album
                </button>
              </div>

              {/* Album forms */}
              {showAddAlbumModal && (
                <form onSubmit={handleSaveAlbum} className="p-4 bg-brand-surface border border-gray-800 rounded-xl space-y-3.5 text-xs">
                  <div className="flex items-center justify-between font-bold border-b border-gray-800 pb-2">
                    <span>{editingAlbumId ? 'Edit Album' : 'Create Cohesive Album'}</span>
                    <button type="button" onClick={() => setShowAddAlbumModal(false)} className="text-gray-500">Close</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Album Title *</label>
                      <input type="text" required value={newAlbumTitle} onChange={(e) => setNewAlbumTitle(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white" />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Curator Creator *</label>
                      <select value={newAlbumArtist} onChange={(e) => setNewAlbumArtist(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white min-h-8">
                        <option value="">-- Choose curator --</option>
                        {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Genre vibe</label>
                      <select value={newAlbumGenre} onChange={(e) => setNewAlbumGenre(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white">
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Type *</label>
                      <select value={newAlbumType} onChange={(e) => setNewAlbumType(e.target.value as any)} className="w-full bg-brand-bg p-2 rounded text-white">
                        <option value="album">Full Album</option>
                        <option value="ep">EP</option>
                        <option value="single">Single Record</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Release date</label>
                      <input type="date" value={newAlbumReleaseDate} onChange={(e) => setNewAlbumReleaseDate(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white font-mono" />
                    </div>
                  </div>
                  <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded font-bold">Save Album</button>
                </form>
              )}

              {/* Albums lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {albums.map(alb => {
                  const creatorName = artists.find(a => a.id === alb.artist_id)?.name || 'Curator';
                  const tracksCount = songs.filter(s => s.album_id === alb.id).length;
                  return (
                    <div key={alb.id} className="p-4 bg-brand-surface border border-gray-900 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <img src={alb.cover_image} alt="" className="w-12 h-12 object-cover rounded-md shadow border border-gray-950" />
                        <div>
                          <p className="text-xs font-bold text-white pr-2 leading-none">{alb.title}</p>
                          <p className="text-[10px] text-gray-500 mt-1 capitalize">{alb.type} • curate: <span className="text-brand-secondary font-semibold">{creatorName}</span></p>
                          <p className="text-[9px] text-gray-400 mt-1 font-mono">Contains {tracksCount} compositions</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setConfirmDelete({
                          isOpen: true,
                          title: 'Delete Album',
                          message: `Are you sure you want to permanently delete the album "${alb.title}"? Compositions in this album will lose their album grouping. This action is irreversible.`,
                          onConfirm: () => deleteAlbum(alb.id)
                        })}
                        className="text-brand-accent p-1.5 hover:bg-brand-accent/10 rounded border border-transparent hover:border-brand-accent/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ==========================================
              SUB-TAB 4: PREMIUM ACOUSTICS ARTISTS CRUD
              ========================================== */}
          {activeTab === 'artists' && (
            <div className="space-y-6 animate-in fade-in" id="admin-artists-tab">
              <div className="flex items-center justify-between pb-4 border-b border-gray-900">
                <h4 className="font-display font-medium text-xs tracking-widest text-gray-400 uppercase">Artists Directories</h4>
                <button 
                  id="admin-add-artist-toggle"
                  onClick={() => setShowAddArtistModal(true)}
                  className="px-3 py-1.5 bg-brand-primary text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Enlist Artist
                </button>
              </div>

              {/* Artist forms upload */}
              {showAddArtistModal && (
                <form onSubmit={handleSaveArtist} className="p-4 bg-brand-surface border border-gray-800 rounded-xl space-y-3 text-xs animate-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between font-bold border-b border-gray-800 pb-2">
                    <span>{editingArtistId ? 'Update Premium Curating Artist' : 'Add Premium Curating Artist'}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowAddArtistModal(false);
                        setEditingArtistId(null);
                        setNewArtistName('');
                        setNewArtistBio('');
                        setNewArtistAvatar('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400');
                        setNewArtistCover('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200');
                        setNewArtistVerified(true);
                      }} 
                      className="text-gray-500 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Artist Name *</label>
                      <input type="text" required value={newArtistName} onChange={(e) => setNewArtistName(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white border border-gray-800 focus:outline-none focus:border-brand-primary" />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1 font-semibold flex items-center gap-2 mt-4 cursor-pointer">
                        <input type="checkbox" checked={newArtistVerified} onChange={(e) => setNewArtistVerified(e.target.checked)} className="accent-brand-primary w-4 h-4 rounded" />
                        Verified Status Badge
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-400 mb-1">Avatar Image URL *</label>
                      <input type="text" required value={newArtistAvatar} onChange={(e) => setNewArtistAvatar(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white border border-gray-800 focus:outline-none focus:border-brand-primary" />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Cover Image URL *</label>
                      <input type="text" required value={newArtistCover} onChange={(e) => setNewArtistCover(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white border border-gray-800 focus:outline-none focus:border-brand-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">Biography *</label>
                    <textarea rows={3} required value={newArtistBio} onChange={(e) => setNewArtistBio(e.target.value)} className="w-full bg-brand-bg p-2 rounded text-white border border-gray-800 focus:outline-none focus:border-brand-primary whitespace-pre-wrap"></textarea>
                  </div>
                  <button type="submit" className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/80 transition-colors text-white rounded font-bold cursor-pointer">
                    {editingArtistId ? 'Update Curator Profile' : 'Incorporate Curator'}
                  </button>
                </form>
              )}

              {/* Artists directories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {artists.map(art => {
                  const artSongCount = songs.filter(s => s.artist_id === art.id).length;
                  return (
                    <div key={art.id} className="p-4 bg-brand-surface border border-gray-900 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <img src={art.avatar_url} alt="" className="w-12 h-12 object-cover rounded-full shadow border border-gray-900" />
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-bold text-white">{art.name}</p>
                            {art.verified && <CheckCircle className="w-3.5 h-3.5 text-brand-secondary fill-brand-bg" />}
                          </div>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{art.follower_count.toLocaleString()} devotees</p>
                          <p className="text-[9px] text-gray-400 mt-1">Sponsors {artSongCount} active compositions</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingArtistId(art.id);
                            setNewArtistName(art.name);
                            setNewArtistBio(art.bio);
                            setNewArtistAvatar(art.avatar_url);
                            setNewArtistCover(art.cover_image);
                            setNewArtistVerified(art.verified);
                            setShowAddArtistModal(true);
                          }}
                          className="text-gray-400 hover:text-brand-secondary p-1.5 hover:bg-brand-card/40 rounded border border-transparent hover:border-gray-800/50"
                          title="Edit Curator Profile"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete({
                            isOpen: true,
                            title: 'Delete Curator/Artist',
                            message: `Are you sure you want to permanently delete curator "${art.name}" from the system? This action is cascade-destructive and cannot be undone.`,
                            onConfirm: () => deleteArtist(art.id)
                          })}
                          className="text-brand-accent p-1.5 hover:bg-brand-accent/10 rounded border border-transparent hover:border-brand-accent/20"
                          title="Delete Artist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ==========================================
              SUB-TAB 5: USERS DIRECTORIES & BAN ACTIONS
              ========================================== */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in" id="admin-users-tab">
              <div className="flex items-center justify-between pb-4 border-b border-gray-900">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    id="admin-users-search"
                    type="text"
                    placeholder="Search users name, email..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="w-full bg-brand-bg p-2 pl-9 text-xs border border-gray-900 rounded-lg text-white"
                  />
                </div>
              </div>

              {/* Members Datatable list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-gray-900 text-gray-500 font-bold uppercase font-mono tracking-wider">
                      <th className="py-2.5 px-2">Member</th>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3 text-center">System Authority Role</th>
                      <th className="py-2.5 px-2 text-center">Banned Status</th>
                      <th className="py-2.5 px-3 text-right">Interactive modifier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900/40">
                    {filteredUsersList.map(item => {
                      const isBanned = bannedUserIds.includes(item.id);
                      return (
                        <tr key={item.id} className="hover:bg-brand-surface/30">
                          <td className="py-3 px-2 flex items-center gap-2.5">
                            <img src={item.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-800" />
                            <div>
                              <p className="font-semibold text-white leading-none">{item.full_name}</p>
                              <p className="text-[9px] text-gray-500 font-mono mt-1">Join: {item.created_at.slice(0, 10)}</p>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-300 font-mono text-[11px]">{item.email}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                              item.role === 'admin' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30' : 'bg-gray-800/65 text-gray-400'
                            }`}>
                              {item.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {isBanned ? (
                              <span className="px-1.5 py-0.5 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 rounded text-[9px] font-bold">Banned</span>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex gap-2.5">
                              {/* Change role buttons */}
                              <button
                                onClick={() => updateUserRole(item.id, item.role === 'admin' ? 'user' : 'admin')}
                                className="px-2 py-1 bg-brand-bg text-gray-400 hover:text-white border border-gray-900 hover:border-gray-800 rounded font-mono text-[10px]"
                                disabled={item.id === currentUser?.id} // avoid self locking
                              >
                                Toggle Role
                              </button>

                              {/* Ban/Unban toggle */}
                              <button
                                onClick={() => toggleBanUser(item.id)}
                                className={`px-2 py-1 transition-colors rounded font-mono text-[10px] uppercase font-bold border ${
                                  isBanned 
                                    ? 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20 hover:bg-brand-secondary/20' 
                                    : 'bg-brand-accent/10 text-brand-accent border-brand-accent/20 hover:bg-brand-accent/20'
                                }`}
                                disabled={item.id === currentUser?.id} // avoid self ban
                              >
                                {isBanned ? 'Reinstate' : 'Ban account'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==========================================
              SUB-TAB 6: ANALYTICS INSIGHTS & GRAPHS
              ========================================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-in fade-in" id="admin-analytics-tab">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Popular Compositions bar charts */}
                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl space-y-4">
                  <h4 className="font-display font-medium text-xs tracking-widest text-brand-secondary uppercase">Streaming Popularity (Plays)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSongsData}>
                        <XAxis dataKey="name" stroke="#525252" fontSize={10} angle={-25} textAnchor="end" height={50} />
                        <YAxis stroke="#525252" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#12121A', borderColor: '#1F1F2F', borderRadius: '8px', fontSize: '11px' }} />
                        <Bar dataKey="plays" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Additional analytics card */}
                <div className="p-5 bg-brand-surface border border-gray-900 rounded-xl flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-bold text-sm text-gray-200">System Demographics</h4>
                    <p className="text-xs text-gray-400 leading-relaxed mt-2">
                      Purple Heart aligns average listener frequencies. Based on aggregate monthly active logs:
                    </p>
                    <ul className="text-xs text-gray-400 space-y-2.5 mt-4 font-sans">
                      <li className="flex items-start gap-2">
                        <Sunrise className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
                        <span><b>Morning (37%)</b> represents maximum devotional, third-eye activation chanting.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Brain className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
                        <span><b>Focus/Noon (25%)</b> coders engaging binaural and lofi.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Moon className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                        <span><b>Sleepy/Night (38%)</b> classical rain and monsoons.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-3.5 bg-brand-bg border border-gray-950 rounded-lg text-xs leading-relaxed max-w-sm mt-4 flex items-start gap-2.5">
                    <Lightbulb className="w-5 h-5 text-brand-secondary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-brand-primary">Insights Calibration:</span> Calming compositions with Sitar drone show a 14% increase in play intervals when featured in banner modules.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ==========================================
              SUB-TAB 7: SUGGESTED SONG REQUESTS TRACKER
              ========================================== */}
          {activeTab === 'requests' && (
            <div className="space-y-6 animate-in fade-in" id="admin-requests-tab">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-display font-medium text-white flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-brand-primary shrink-0 animate-pulse" />
                    Suggested Songs Track & Monitor • গানের অনুরোধ মনিটরিং
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Keep track of missing classical sitars, devotional tunes and lofi ragas requested by users. Click "AI Import" to automatically parse via Whisper & build with Gemini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchRequests}
                  disabled={isLoadingRequests}
                  className="px-3 py-1.5 bg-brand-bg/60 border border-gray-800 hover:border-brand-primary text-xs font-semibold text-gray-300 hover:text-white rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-brand-secondary ${isLoadingRequests ? 'animate-spin' : ''}`} />
                  {isLoadingRequests ? 'Reloading...' : 'Refresh List'}
                </button>
              </div>

              {/* Grid of stats for requests */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider font-mono">Total Requests</span>
                  <p className="text-xl font-bold text-white">{requestsList.length}</p>
                </div>
                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl space-y-1">
                  <span className="text-[10px] text-yellow-500 uppercase font-bold tracking-wider font-mono font-sans">Pending Review</span>
                  <p className="text-xl font-bold text-yellow-500 font-sans">
                    {requestsList.filter(r => r.status === 'pending').length}
                  </p>
                </div>
                <div className="p-4 bg-brand-surface border border-gray-900 rounded-xl space-y-1">
                  <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider font-mono font-sans">Added & Live</span>
                  <p className="text-xl font-bold text-emerald-500 font-sans">
                    {requestsList.filter(r => r.status === 'added').length}
                  </p>
                </div>
              </div>

              {/* Table displaying the request details */}
              <div className="bg-brand-surface border border-gray-950 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-400 border-collapse">
                    <thead>
                      <tr className="bg-brand-bg/80 border-b border-gray-950 font-mono text-gray-500 font-bold uppercase tracking-wider">
                        <th className="py-3 px-4 font-bold">Request Info</th>
                        <th className="py-3 px-4 font-bold">Song Details</th>
                        <th className="py-3 px-4 font-bold font-sans">Suggested By</th>
                        <th className="py-3 px-4 font-bold">YouTube URL</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestsList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500 font-medium">
                            <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-2 animate-bounce-short" />
                            No song suggestions received yet. When users submit custom ragas, they will display here.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const sortedList = [...requestsList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                          return sortedList.map((req) => (
                            <tr key={req.id} className="border-b border-gray-950/40 hover:bg-brand-card/5 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-[10px] text-gray-500">
                                <span className="block text-gray-400 font-semibold">{req.id}</span>
                                <span className="block text-[9px] mt-0.5">{new Date(req.createdAt).toLocaleDateString()}</span>
                              </td>
                              <td className="py-3.5 px-4 font-sans text-xs">
                                <span className="block text-white font-bold text-sm tracking-wide">{req.title}</span>
                                <span className="block text-gray-400 text-[10px] mt-1">Artist: <b className="text-gray-300">{req.artist || 'Traditional'}</b></span>
                                {req.genre && <span className="inline-block mt-1 px-1.5 py-0.5 bg-brand-primary/10 text-brand-secondary text-[8px] font-bold uppercase tracking-wider rounded border border-brand-primary/10">Genre: {req.genre}</span>}
                              </td>
                              <td className="py-3.5 px-4 text-xs font-mono text-gray-300">
                                <a href={`mailto:${req.requesterEmail}`} className="hover:underline text-brand-primary font-semibold">{req.requesterEmail}</a>
                              </td>
                              <td className="py-3.5 px-4">
                                {req.youtubeUrl ? (
                                  <a 
                                    href={req.youtubeUrl} 
                                    target="_blank" 
                                    referrerPolicy="no-referrer"
                                    className="inline-flex items-center gap-1 text-brand-secondary hover:underline font-mono text-[10px] bg-brand-secondary/5 px-2 py-1 rounded border border-brand-secondary/15 font-semibold"
                                  >
                                    <LinkIcon className="w-3 h-3 shrink-0" />
                                    Watch Link
                                  </a>
                                ) : (
                                  <span className="text-gray-650 font-mono text-[10px]">None</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {req.status === 'added' ? (
                                  <span className="inline-flex items-[#10b981] gap-1 px-2.5 py-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/25 font-sans uppercase">
                                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" /> Live App
                                  </span>
                                ) : (
                                  <span className="inline-flex items-[#eab308] gap-1 px-2.5 py-1 text-[10px] font-bold bg-yellow-500/10 text-yellow-500 rounded-full border border-yellow-500/25 font-sans uppercase">
                                    Pending Review
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {req.status === 'pending' ? (
                                  <div className="flex items-center justify-end gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleLoadRequestForImport(req)}
                                      className="px-2.5 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-lg cursor-pointer transition-all text-[11px] font-display hover:scale-[1.02] shadow shadow-brand-primary/10 whitespace-nowrap"
                                      title="Prefill fields, download and transcribe using Whisper & Gemini"
                                    >
                                      AI Import & Fetch
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDirectApprove(req)}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer transition-all text-[11px] font-display hover:scale-[1.02] shadow shadow-emerald-600/10 whitespace-nowrap"
                                      title="Instantly deploy song to application and send SMTP confirmation to user"
                                    >
                                      Approve & Notify
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-emerald-500 text-[10px] font-bold font-mono uppercase pr-2">Published</span>
                                )}
                              </td>
                            </tr>
                          ));
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Elegant confirmation modal to replace window.confirm */}
      {confirmDelete.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-250">
          <div className="w-full max-w-sm bg-brand-surface border border-gray-900 bg-[#0f0e13] rounded-xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-display font-bold text-white uppercase tracking-wider">{confirmDelete.title}</h4>
            <p className="text-xs text-gray-400 mt-2.5 leading-relaxed">{confirmDelete.message}</p>
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                onClick={() => setConfirmDelete({ ...confirmDelete, isOpen: false })}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-brand-bg rounded-lg border border-transparent transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDelete.onConfirm();
                  setConfirmDelete({ ...confirmDelete, isOpen: false });
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-accent text-white hover:bg-brand-accent/90 rounded-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
