import { Artist, Album, Song } from './types';

export const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Classical', 'Jazz', 'Electronic', 'Lo-fi', 
  'Indie', 'Metal', 'Folk', 'Devotional', 'Bangla', 'Bollywood', 'K-Pop', 'Others'
];

export const MOODS = [
  { name: 'Chill', emoji: 'Leaf', gradient: 'from-brand-secondary/40 to-brand-primary/40' },
  { name: 'Happy', emoji: 'Smile', gradient: 'from-brand-primary/40 to-brand-secondary/40' },
  { name: 'Sad', emoji: 'CloudRain', gradient: 'from-brand-primary/40 to-brand-accent/40' },
  { name: 'Energetic', emoji: 'Zap', gradient: 'from-brand-accent/40 to-brand-primary/40' },
  { name: 'Romantic', emoji: 'Heart', gradient: 'from-brand-accent/40 to-brand-secondary/40' },
  { name: 'Focus', emoji: 'Brain', gradient: 'from-brand-secondary/40 to-brand-accent/40' },
  { name: 'Workout', emoji: 'Flame', gradient: 'from-brand-accent/40 to-brand-secondary/40' },
  { name: 'Party', emoji: 'Sparkles', gradient: 'from-brand-primary/45 to-brand-accent/45' },
  { name: 'Sleepy', emoji: 'Moon', gradient: 'from-brand-bg to-brand-primary/40' },
  { name: 'Spiritual', emoji: 'Compass', gradient: 'from-brand-secondary/40 to-brand-primary/45' }
];

export const LISTENING_TIMES = [
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
  { label: 'Night', value: 'night' },
  { label: 'Anytime', value: 'anytime' }
];

export const INITIAL_ARTISTS: Artist[] = [
  {
    id: 'art-1',
    name: 'Sitar Symphony',
    bio: 'Pioneering ambient Hindustani music, Sitar Symphony blends traditional instruments with organic cosmic synths to induce deep meditative states.',
    avatar_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=60',
    cover_image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&auto=format&fit=crop&q=80',
    verified: true,
    follower_count: 142050,
    created_at: '2026-01-10T12:00:00Z'
  },
  {
    id: 'art-2',
    name: 'Luna Ambient',
    bio: 'Icelandic sound designer creating expansive soundscapes using modular synthesizers, acoustic piano echoes, and field recordings of wind and sea.',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60',
    cover_image: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=1200&auto=format&fit=crop&q=80',
    verified: true,
    follower_count: 89310,
    created_at: '2026-02-15T15:30:00Z'
  },
  {
    id: 'art-3',
    name: 'Sleep Whispers',
    bio: 'Specifically tuned binaural sleep induction soundscapes and gentle spoken affirmations recorded in native stereo to cure insomnia naturally.',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=60',
    cover_image: 'https://images.unsplash.com/photo-1511295742364-92767fa62d9f?w=1200&auto=format&fit=crop&q=80',
    verified: false,
    follower_count: 55400,
    created_at: '2026-03-01T08:00:00Z'
  },
  {
    id: 'art-4',
    name: 'Pranayam Devotionals',
    bio: 'Curated sacred mantra experiences and high-fidelity flute performances focusing on pranayama flow, chanting, and third-eye alignment.',
    avatar_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&auto=format&fit=crop&q=60',
    cover_image: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=1200&auto=format&fit=crop&q=80',
    verified: true,
    follower_count: 198300,
    created_at: '2026-01-20T10:15:00Z'
  },
  {
    id: 'art-5',
    name: 'Aura Focus',
    bio: 'Beta-wave and Alpha-wave binaural beat engineers crafting pure productivity-inducing lo-fi drums and synth layers, ideal for coders and creators.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=60',
    cover_image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop&q=80',
    verified: true,
    follower_count: 320140,
    created_at: '2026-02-10T14:45:00Z'
  }
];

export const INITIAL_ALBUMS: Album[] = [
  {
    id: 'alb-1',
    title: 'Ethereal Echoes',
    artist_id: 'art-1',
    cover_image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=60',
    release_date: '2026-04-12',
    genre: 'Devotional',
    type: 'album',
    created_at: '2026-04-12T00:00:00Z'
  },
  {
    id: 'alb-2',
    title: 'Rainforest Ragas',
    artist_id: 'art-1',
    cover_image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&auto=format&fit=crop&q=60',
    release_date: '2026-05-01',
    genre: 'Classical',
    type: 'ep',
    created_at: '2026-05-01T00:00:00Z'
  },
  {
    id: 'alb-3',
    title: 'Deep Midnight Meditation',
    artist_id: 'art-2',
    cover_image: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=60',
    release_date: '2026-03-24',
    genre: 'Electronic',
    type: 'album',
    created_at: '2026-03-24T00:00:00Z'
  },
  {
    id: 'alb-4',
    title: 'Focus States (Alpha Beats)',
    artist_id: 'art-5',
    cover_image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&auto=format&fit=crop&q=60',
    release_date: '2026-05-10',
    genre: 'Lo-fi',
    type: 'single',
    created_at: '2026-05-10T00:00:00Z'
  }
];

export const INITIAL_SONGS: Song[] = [];
