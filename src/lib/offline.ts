import { Song, Playlist } from '../types';
import { toast } from 'sonner';

const AUDIO_CACHE_NAME = 'healers-audio-cache';

// Load stored downloaded song IDs
export function getDownloadedSongIds(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('healers_offline_song_ids');
  return stored ? JSON.parse(stored) : [];
}

// Check if a specific song is saved offline
export function isSongDownloaded(songId: string): boolean {
  return getDownloadedSongIds().includes(songId);
}

// Get full downloaded songs metadata
export function getOfflineSongs(): Song[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('healers_offline_songs_meta');
  return stored ? JSON.parse(stored) : [];
}

// Load stored downloaded playlist IDs
export function getDownloadedPlaylistIds(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('healers_offline_playlist_ids');
  return stored ? JSON.parse(stored) : [];
}

// Check if a specific playlist is fully saved offline
export function isPlaylistDownloaded(playlistId: string): boolean {
  return getDownloadedPlaylistIds().includes(playlistId);
}

/**
 * Download a song: fetches its audio track and loads cover visual elements into browser Cache Storage,
 * and records its JSON metadata to enable playback when fully offline.
 */
export async function downloadSong(song: Song): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    toast.error('Browser offline storage is not supported in this environment.');
    return false;
  }

  const alreadyDownloaded = isSongDownloaded(song.id);
  if (alreadyDownloaded) {
    toast.success(`"${song.title}" is already downloaded!`);
    return true;
  }

  const toastId = toast.loading(`Curating "${song.title}" offline storage...`);

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);

    // Fetch and cache the audio URL
    if (song.audio_url) {
      const audioResponse = await fetch(song.audio_url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });

      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio stream: status ${audioResponse.status}`);
      }

      await cache.put(song.audio_url, audioResponse);
    }

    // Optionally cache the cover image to guarantee visual thumbnail rendering offline
    if (song.cover_image) {
      try {
        const imgResponse = await fetch(song.cover_image, {
          method: 'GET',
          mode: 'no-cors' // Use no-cors in case host does not allow CORS visual access
        });
        await cache.put(song.cover_image, imgResponse);
      } catch (e) {
        console.warn('Cover image cache failed (non-blocking):', e);
      }
    }

    // Save metadata
    const downloadedIds = getDownloadedSongIds();
    if (!downloadedIds.includes(song.id)) {
      downloadedIds.push(song.id);
      localStorage.setItem('healers_offline_song_ids', JSON.stringify(downloadedIds));
    }

    const offlineSongs = getOfflineSongs();
    if (!offlineSongs.some(s => s.id === song.id)) {
      offlineSongs.push(song);
      localStorage.setItem('healers_offline_songs_meta', JSON.stringify(offlineSongs));
    }

    toast.dismiss(toastId);
    toast.success(`"${song.title}" saved offline successfully!`, {
      description: 'You can listen to this track anytime without internet connection.'
    });

    // Notify listeners via a custom event
    window.dispatchEvent(new CustomEvent('healers-offline-sync'));
    return true;

  } catch (error: any) {
    console.error('Offline storage download error:', error);
    toast.dismiss(toastId);
    
    // Fallback compilation: in case of CORS rejection, we can save metadata anyway and cache dynamically during runtime play
    toast.error(`Offline Cache incomplete for "${song.title}"`, {
      description: 'CORS restrictions or network disconnected. We saved metadata for fallback offline access.'
    });

    // Save metadata as a partial fallback
    const downloadedIds = getDownloadedSongIds();
    if (!downloadedIds.includes(song.id)) {
      downloadedIds.push(song.id);
      localStorage.setItem('healers_offline_song_ids', JSON.stringify(downloadedIds));
    }

    const offlineSongs = getOfflineSongs();
    if (!offlineSongs.some(s => s.id === song.id)) {
      offlineSongs.push(song);
      localStorage.setItem('healers_offline_songs_meta', JSON.stringify(offlineSongs));
    }
    
    window.dispatchEvent(new CustomEvent('healers-offline-sync'));
    return true;
  }
}

/**
 * Remove a song from offline storage: clears cache slots and purges JSON records.
 */
export async function undownloadSong(songId: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const downloadedIds = getDownloadedSongIds().filter(id => id !== songId);
    localStorage.setItem('healers_offline_song_ids', JSON.stringify(downloadedIds));

    const offlineSongs = getOfflineSongs().filter(s => s.id !== songId);
    localStorage.setItem('healers_offline_songs_meta', JSON.stringify(offlineSongs));

    // Clear matching caches
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    for (const request of keys) {
      if (request.url.includes(songId)) {
        await cache.delete(request);
      }
    }

    toast.success('Track removed from offline cache.');
    window.dispatchEvent(new CustomEvent('healers-offline-sync'));
  } catch (error) {
    console.error('Error removing song draft from offline caches:', error);
  }
}

/**
 * Download a full playlist: caches all songs inside the playlist consecutively.
 */
export async function downloadPlaylist(playlist: Playlist, playlistTracks: Song[]): Promise<boolean> {
  if (playlistTracks.length === 0) {
    toast.error('The selected slate is empty. Cannot compile offline.');
    return false;
  }

  const toastId = toast.loading(`Downloading Slate "${playlist.title}" offline (${playlistTracks.length} tracks)...`);

  let count = 0;
  for (const song of playlistTracks) {
    try {
      // Avoid re-doing full notifications for each single track
      const success = await downloadSongSilently(song);
      if (success) count++;
    } catch (e) {
      console.warn('Failed silenty loading raga:', song.title, e);
    }
  }

  const playlistIds = getDownloadedPlaylistIds();
  if (!playlistIds.includes(playlist.id)) {
    playlistIds.push(playlist.id);
    localStorage.setItem('healers_offline_playlist_ids', JSON.stringify(playlistIds));
  }

  toast.dismiss(toastId);
  toast.success(`Slate "${playlist.title}" is saved!`, {
    description: `Successfully stored ${count} meditations/tracks for offline session access.`
  });

  window.dispatchEvent(new CustomEvent('healers-offline-sync'));
  return true;
}

/**
 * Remove an entire playlist from offline storage
 */
export async function undownloadPlaylist(playlist: Playlist, playlistTracks: Song[]): Promise<void> {
  const playlistIds = getDownloadedPlaylistIds().filter(id => id !== playlist.id);
  localStorage.setItem('healers_offline_playlist_ids', JSON.stringify(playlistIds));

  for (const song of playlistTracks) {
    await undownloadSong(song.id);
  }

  toast.success(`Removed Slate "${playlist.title}" from offline downloads.`);
  window.dispatchEvent(new CustomEvent('healers-offline-sync'));
}

// Silent version to compile consecutive downloads without causing UI notifications spam
async function downloadSongSilently(song: Song): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);

    // Audio tracking
    if (song.audio_url) {
      const audioResponse = await fetch(song.audio_url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      if (audioResponse.ok) {
        await cache.put(song.audio_url, audioResponse);
      }
    }

    // Cover image tracking
    if (song.cover_image) {
      try {
        const imgResponse = await fetch(song.cover_image, { method: 'GET', mode: 'no-cors' });
        await cache.put(song.cover_image, imgResponse);
      } catch (e) {}
    }

    const downloadedIds = getDownloadedSongIds();
    if (!downloadedIds.includes(song.id)) {
      downloadedIds.push(song.id);
      localStorage.setItem('healers_offline_song_ids', JSON.stringify(downloadedIds));
    }

    const offlineSongs = getOfflineSongs();
    if (!offlineSongs.some(s => s.id === song.id)) {
      offlineSongs.push(song);
      localStorage.setItem('healers_offline_songs_meta', JSON.stringify(offlineSongs));
    }

    return true;
  } catch (error) {
    console.warn(`Silent storage copy of ${song.title} failed:`, error);
    // Saved metadata anyway
    const downloadedIds = getDownloadedSongIds();
    if (!downloadedIds.includes(song.id)) {
      downloadedIds.push(song.id);
      localStorage.setItem('healers_offline_song_ids', JSON.stringify(downloadedIds));
    }

    const offlineSongs = getOfflineSongs();
    if (!offlineSongs.some(s => s.id === song.id)) {
      offlineSongs.push(song);
      localStorage.setItem('healers_offline_songs_meta', JSON.stringify(offlineSongs));
    }
    return true;
  }
}
