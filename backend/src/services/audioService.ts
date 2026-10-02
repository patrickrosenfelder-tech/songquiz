import axios from 'axios';

export interface Song {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  correctAnswer: string;
  options: string[];
}

export class AudioService {
  private readonly DEEZER_API_BASE = 'https://api.deezer.com';
  private readonly APPLE_MUSIC_API_BASE = 'https://api.music.apple.com/v1';
  private cache: Song[] = [];

  constructor() {
    this.initializeSongs();
  }

  private initializeSongs(): void {
    this.cache = [
      {
        id: '1',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        audioUrl: '',
        correctAnswer: 'Queen',
        options: ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd']
      },
      {
        id: '2',
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        audioUrl: '',
        correctAnswer: 'Led Zeppelin',
        options: ['Queen', 'Led Zeppelin', 'Pink Floyd', 'David Bowie']
      },
      {
        id: '3',
        title: 'Imagine',
        artist: 'John Lennon',
        audioUrl: '',
        correctAnswer: 'John Lennon',
        options: ['Paul McCartney', 'John Lennon', 'George Harrison', 'Ringo Starr']
      },
      {
        id: '4',
        title: 'Like a Rolling Stone',
        artist: 'Bob Dylan',
        audioUrl: '',
        correctAnswer: 'Bob Dylan',
        options: ['The Doors', 'Bob Dylan', 'Jimi Hendrix', 'Janis Joplin']
      },
      {
        id: '5',
        title: 'Hotel California',
        artist: 'Eagles',
        audioUrl: '',
        correctAnswer: 'Eagles',
        options: ['Fleetwood Mac', 'Eagles', 'Lynyrd Skynyrd', 'The Allman Brothers Band']
      },
      {
        id: '6',
        title: 'Sweet Child O\' Mine',
        artist: 'Guns N\' Roses',
        audioUrl: '',
        correctAnswer: 'Guns N\' Roses',
        options: ['Metallica', 'Guns N\' Roses', 'AC/DC', 'Aerosmith']
      },
      {
        id: '7',
        title: 'Smells Like Teen Spirit',
        artist: 'Nirvana',
        audioUrl: '',
        correctAnswer: 'Nirvana',
        options: ['Pearl Jam', 'Nirvana', 'Soundgarden', 'Alice in Chains']
      },
      {
        id: '8',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        audioUrl: '',
        correctAnswer: 'The Weeknd',
        options: ['Dua Lipa', 'The Weeknd', 'Post Malone', 'Travis Scott']
      },
      {
        id: '9',
        title: 'Levitating',
        artist: 'Dua Lipa',
        audioUrl: '',
        correctAnswer: 'Dua Lipa',
        options: ['Billie Eilish', 'Dua Lipa', 'Ariana Grande', 'Olivia Rodrigo']
      },
      {
        id: '10',
        title: 'Bad Guy',
        artist: 'Billie Eilish',
        audioUrl: '',
        correctAnswer: 'Billie Eilish',
        options: ['Finneas', 'Billie Eilish', 'Tyler, the Creator', 'Khalid']
      },
      {
        id: '11',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        audioUrl: '',
        correctAnswer: 'Ed Sheeran',
        options: ['Sam Smith', 'Ed Sheeran', 'Bruno Mars', 'Shawn Mendes']
      },
      {
        id: '12',
        title: 'One Dance',
        artist: 'Drake',
        audioUrl: '',
        correctAnswer: 'Drake',
        options: ['Kendrick Lamar', 'Drake', 'J. Cole', 'Nas']
      }
    ];
  }

  getRandomSongSync(excludeIds: string[] = []): Song {
    const available = this.cache.filter(s => !excludeIds.includes(s.id));
    const pool = available.length > 0 ? available : this.cache;
    const song = pool[Math.floor(Math.random() * pool.length)];
    return {
      ...song,
      options: this.shuffleArray([...song.options])
    };
  }

  // Deezer preview URLs expire, so look one up fresh for each round
  async getRandomSong(excludeIds: string[] = []): Promise<Song> {
    const song = this.getRandomSongSync(excludeIds);
    const audioUrl = await this.fetchPreviewUrl(song.artist, song.title);
    return { ...song, audioUrl: audioUrl || song.audioUrl };
  }

  private async fetchPreviewUrl(artist: string, title: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.DEEZER_API_BASE}/search`, {
        params: { q: `${artist} ${title}`, limit: 10 },
        timeout: 5000
      });
      const tracks: any[] = response.data.data || [];
      const match = tracks.find(t => t.preview && t.artist?.name?.toLowerCase() === artist.toLowerCase())
        || tracks.find(t => t.preview);
      return match ? match.preview : null;
    } catch (err) {
      console.error('Deezer preview lookup failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  async fetchFromDeezer(query: string): Promise<Song | null> {
    try {
      const response = await axios.get(`${this.DEEZER_API_BASE}/search/track`, {
        params: { q: query }
      });

      if (response.data.data && response.data.data.length > 0) {
        const track = response.data.data[0];
        return {
          id: track.id,
          title: track.title,
          artist: track.artist.name,
          audioUrl: track.preview,
          correctAnswer: track.artist.name,
          options: [track.artist.name, 'Unknown', 'Various', 'Compilation']
        };
      }
    } catch (err) {
      console.error('Deezer API error:', err);
    }
    return null;
  }

  async fetchFromAppleMusic(query: string, token: string): Promise<Song | null> {
    try {
      const response = await axios.get(`${this.APPLE_MUSIC_API_BASE}/catalog/us/search`, {
        params: { term: query, types: 'songs', limit: 1 },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.results.songs?.data && response.data.results.songs.data.length > 0) {
        const track = response.data.results.songs.data[0];
        return {
          id: track.id,
          title: track.attributes.name,
          artist: track.attributes.artistName,
          audioUrl: track.attributes.previews?.[0]?.url || '',
          correctAnswer: track.attributes.artistName,
          options: [track.attributes.artistName, 'Unknown', 'Various', 'Compilation']
        };
      }
    } catch (err) {
      console.error('Apple Music API error:', err);
    }
    return null;
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
