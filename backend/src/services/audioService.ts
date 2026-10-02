import axios from 'axios';

export type QuestionType = 'artist' | 'title';

export interface Track {
  id: string;
  deezerId?: number;
  title: string;
  artist: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  questionType: QuestionType;
  correctAnswer: string;
  options: string[];
}

export interface Genre {
  id: number;
  name: string;
}

// Deezer genre ids; 0 is the overall chart
export const GENRES: Genre[] = [
  { id: 0, name: 'All' },
  { id: 132, name: 'Pop' },
  { id: 152, name: 'Rock' },
  { id: 116, name: 'Rap/Hip Hop' },
  { id: 113, name: 'Dance' },
  { id: 165, name: 'R&B' },
  { id: 85, name: 'Alternative' },
  { id: 106, name: 'Electro' },
  { id: 464, name: 'Metal' },
  { id: 84, name: 'Country' },
  { id: 169, name: 'Soul & Funk' },
  { id: 144, name: 'Reggae' },
  { id: 129, name: 'Jazz' },
  { id: 197, name: 'Latin Music' }
];

// Used when Deezer can't be reached
const FALLBACK_TRACKS: Track[] = [
  { id: 'local-1', title: 'Bohemian Rhapsody', artist: 'Queen' },
  { id: 'local-2', title: 'Stairway to Heaven', artist: 'Led Zeppelin' },
  { id: 'local-3', title: 'Imagine', artist: 'John Lennon' },
  { id: 'local-4', title: 'Like a Rolling Stone', artist: 'Bob Dylan' },
  { id: 'local-5', title: 'Hotel California', artist: 'Eagles' },
  { id: 'local-6', title: 'Sweet Child O\' Mine', artist: 'Guns N\' Roses' },
  { id: 'local-7', title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
  { id: 'local-8', title: 'Blinding Lights', artist: 'The Weeknd' },
  { id: 'local-9', title: 'Levitating', artist: 'Dua Lipa' },
  { id: 'local-10', title: 'Bad Guy', artist: 'Billie Eilish' },
  { id: 'local-11', title: 'Shape of You', artist: 'Ed Sheeran' },
  { id: 'local-12', title: 'One Dance', artist: 'Drake' }
];

const POOL_CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 5000;

export class AudioService {
  private readonly DEEZER_API_BASE = 'https://api.deezer.com';
  private readonly ITUNES_API_BASE = 'https://itunes.apple.com';
  private poolCache: Map<number, { tracks: Track[]; fetchedAt: number }> = new Map();

  // Songs for a game, shuffled. Falls back to the built-in list if Deezer fails.
  async getSongPool(genreId: number): Promise<Track[]> {
    const cached = this.poolCache.get(genreId);
    if (cached && Date.now() - cached.fetchedAt < POOL_CACHE_TTL) {
      return this.shuffleArray([...cached.tracks]);
    }

    try {
      const response = await axios.get(`${this.DEEZER_API_BASE}/chart/${genreId}/tracks`, {
        params: { limit: 100 },
        timeout: REQUEST_TIMEOUT
      });
      const seen = new Set<string>();
      const tracks: Track[] = [];
      for (const t of response.data.data || []) {
        if (!t.preview || !t.artist?.name) continue;
        const title = this.cleanTitle(t.title_short || t.title);
        const key = `${t.artist.name}|${title}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tracks.push({ id: String(t.id), deezerId: t.id, title, artist: t.artist.name });
      }

      if (tracks.length >= 10) {
        this.poolCache.set(genreId, { tracks, fetchedAt: Date.now() });
        return this.shuffleArray([...tracks]);
      }
      console.warn(`Deezer chart for genre ${genreId} only had ${tracks.length} tracks, using fallback list`);
    } catch (err) {
      console.error('Deezer chart fetch failed, using fallback list:', err instanceof Error ? err.message : err);
    }

    return this.shuffleArray([...FALLBACK_TRACKS]);
  }

  // Deezer first, then iTunes. Looked up per round because Deezer preview URLs expire.
  async getPreviewUrl(track: Track): Promise<string | null> {
    return (await this.fetchDeezerPreview(track)) || (await this.fetchItunesPreview(track));
  }

  buildSong(track: Track, pool: Track[], questionType: QuestionType, audioUrl: string): Song {
    const correctAnswer = questionType === 'artist' ? track.artist : track.title;
    const distractors = this.pickDistractors(correctAnswer, pool, questionType);

    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      audioUrl,
      questionType,
      correctAnswer,
      options: this.shuffleArray([correctAnswer, ...distractors])
    };
  }

  private pickDistractors(correctAnswer: string, pool: Track[], questionType: QuestionType): string[] {
    const field = (t: Track) => (questionType === 'artist' ? t.artist : t.title);
    const used = new Set([correctAnswer.toLowerCase()]);
    const distractors: string[] = [];

    // Pad with the fallback list in case the pool has too few distinct values
    const candidates = [...this.shuffleArray([...pool]), ...this.shuffleArray([...FALLBACK_TRACKS])];
    for (const t of candidates) {
      const value = field(t);
      if (used.has(value.toLowerCase())) continue;
      used.add(value.toLowerCase());
      distractors.push(value);
      if (distractors.length === 3) break;
    }
    return distractors;
  }

  private async fetchDeezerPreview(track: Track): Promise<string | null> {
    try {
      if (track.deezerId) {
        const response = await axios.get(`${this.DEEZER_API_BASE}/track/${track.deezerId}`, {
          timeout: REQUEST_TIMEOUT
        });
        return response.data.preview || null;
      }

      const response = await axios.get(`${this.DEEZER_API_BASE}/search`, {
        params: { q: `${track.artist} ${track.title}`, limit: 10 },
        timeout: REQUEST_TIMEOUT
      });
      const results: any[] = response.data.data || [];
      const match = results.find(t => t.preview && this.sameArtist(t.artist?.name, track.artist))
        || results.find(t => t.preview);
      return match ? match.preview : null;
    } catch (err) {
      console.error('Deezer preview lookup failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  private async fetchItunesPreview(track: Track): Promise<string | null> {
    try {
      const response = await axios.get(`${this.ITUNES_API_BASE}/search`, {
        params: { term: `${track.artist} ${track.title}`, entity: 'song', limit: 10 },
        timeout: REQUEST_TIMEOUT
      });
      const results: any[] = response.data.results || [];
      const match = results.find(r => r.previewUrl && this.sameArtist(r.artistName, track.artist));
      return match ? match.previewUrl : null;
    } catch (err) {
      console.error('iTunes preview lookup failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  private sameArtist(a: string | undefined, b: string): boolean {
    if (!a) return false;
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x === y || x.includes(y) || y.includes(x);
  }

  // "Everywhere (2017 Remaster)" -> "Everywhere", "Song (feat. X)" -> "Song"
  private cleanTitle(title: string): string {
    const cleaned = title
      .replace(/\s*[([](feat\.?|ft\.?|with)\s[^)\]]*[)\]]/gi, '')
      .replace(/\s*[([][^)\]]*(remaster|version|edit|mix|live|mono|stereo)[^)\]]*[)\]]/gi, '')
      .replace(/\s+-\s+.*(remaster|version|edit|mix|live).*$/i, '')
      .trim();
    return cleaned || title;
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
