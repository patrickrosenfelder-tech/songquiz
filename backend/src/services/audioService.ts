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
        audioUrl: 'https://example.com/bohemian-rhapsody.mp3',
        correctAnswer: 'Queen',
        options: ['The Beatles', 'Queen', 'Led Zeppelin', 'Pink Floyd']
      },
      {
        id: '2',
        title: 'Stairway to Heaven',
        artist: 'Led Zeppelin',
        audioUrl: 'https://example.com/stairway.mp3',
        correctAnswer: 'Led Zeppelin',
        options: ['Queen', 'Led Zeppelin', 'Pink Floyd', 'David Bowie']
      },
      {
        id: '3',
        title: 'Imagine',
        artist: 'John Lennon',
        audioUrl: 'https://example.com/imagine.mp3',
        correctAnswer: 'John Lennon',
        options: ['Paul McCartney', 'John Lennon', 'George Harrison', 'Ringo Starr']
      },
      {
        id: '4',
        title: 'Like a Rolling Stone',
        artist: 'Bob Dylan',
        audioUrl: 'https://example.com/rolling-stone.mp3',
        correctAnswer: 'Bob Dylan',
        options: ['The Doors', 'Bob Dylan', 'Jimi Hendrix', 'Janis Joplin']
      },
      {
        id: '5',
        title: 'Hotel California',
        artist: 'Eagles',
        audioUrl: 'https://example.com/hotel-california.mp3',
        correctAnswer: 'Eagles',
        options: ['Fleetwood Mac', 'Eagles', 'Lynyrd Skynyrd', 'The Allman Brothers Band']
      },
      {
        id: '6',
        title: 'Sweet Child O\' Mine',
        artist: 'Guns N\' Roses',
        audioUrl: 'https://example.com/sweet-child.mp3',
        correctAnswer: 'Guns N\' Roses',
        options: ['Metallica', 'Guns N\' Roses', 'AC/DC', 'Aerosmith']
      },
      {
        id: '7',
        title: 'Smells Like Teen Spirit',
        artist: 'Nirvana',
        audioUrl: 'https://example.com/smells-like-teen-spirit.mp3',
        correctAnswer: 'Nirvana',
        options: ['Pearl Jam', 'Nirvana', 'Soundgarden', 'Alice in Chains']
      },
      {
        id: '8',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        audioUrl: 'https://example.com/blinding-lights.mp3',
        correctAnswer: 'The Weeknd',
        options: ['Dua Lipa', 'The Weeknd', 'Post Malone', 'Travis Scott']
      },
      {
        id: '9',
        title: 'Levitating',
        artist: 'Dua Lipa',
        audioUrl: 'https://example.com/levitating.mp3',
        correctAnswer: 'Dua Lipa',
        options: ['Billie Eilish', 'Dua Lipa', 'Ariana Grande', 'Olivia Rodrigo']
      },
      {
        id: '10',
        title: 'Bad Guy',
        artist: 'Billie Eilish',
        audioUrl: 'https://example.com/bad-guy.mp3',
        correctAnswer: 'Billie Eilish',
        options: ['Finneas', 'Billie Eilish', 'Tyler, the Creator', 'Khalid']
      },
      {
        id: '11',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        audioUrl: 'https://example.com/shape-of-you.mp3',
        correctAnswer: 'Ed Sheeran',
        options: ['Sam Smith', 'Ed Sheeran', 'Bruno Mars', 'Shawn Mendes']
      },
      {
        id: '12',
        title: 'One Dance',
        artist: 'Drake',
        audioUrl: 'https://example.com/one-dance.mp3',
        correctAnswer: 'Drake',
        options: ['Kendrick Lamar', 'Drake', 'J. Cole', 'Nas']
      }
    ];
  }

  getRandomSongSync(): Song {
    const randomIndex = Math.floor(Math.random() * this.cache.length);
    const song = this.cache[randomIndex];
    return {
      ...song,
      options: this.shuffleArray([...song.options])
    };
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
