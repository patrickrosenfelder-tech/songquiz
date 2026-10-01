/**
 * Song catalog for TuneDuel
 *
 * Clip URLs use the 30-second iTunes/Apple Music preview links which are publicly
 * accessible CDN MP3s — no auth required at runtime.  They follow the pattern:
 *   https://audio-ssl.itunes.apple.com/itunes-assets/...
 * Each entry includes `aliases` for flexible matching (e.g. "queen" matches for
 * "Bohemian Rhapsody" → artist alt-answer).
 *
 * NOTE: In a real deployment you'd integrate the iTunes Search API at session-start
 * time to fetch fresh preview URLs.  The hardcoded URLs here are representative
 * and may expire; the game engine is designed to swap them out.
 */

import { Song } from './types';

export const SONG_CATALOG: Song[] = [
  {
    id: 'bohemian-rhapsody',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/5d/8f/43/5d8f4304-1a15-8ad0-e9c4-2d527327c8ef/mzaf_8986985993951015741.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a6/8e/31/a68e3149-a9e1-a78f-b42a-c9b5a8cbebd6/dj.jlmmtqnm.jpg/400x400bb.jpg',
    aliases: ['queen', 'bohemian rhapsody', 'bohemian'],
  },
  {
    id: 'billie-jean',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a4/6e/93/a46e935c-3d56-3c8a-8c7c-5a57fc0ef95e/mzaf_14613765756831682484.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b5/17/df/b517df3e-f0f7-2d54-29bd-bc59fcba10a9/dj.ymkuvhno.jpg/400x400bb.jpg',
    aliases: ['michael jackson', 'billie jean', 'mj'],
  },
  {
    id: 'smells-like-teen-spirit',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/00/45/24/00452489-1494-beb0-85c9-b9ebbd99ae64/mzaf_17940866823978568018.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/81/36/20/813620e7-3e38-2e2a-8e68-3d97a5daaefa/dj.swezftun.jpg/400x400bb.jpg',
    aliases: ['nirvana', 'smells like teen spirit', 'smells like', 'teen spirit'],
  },
  {
    id: 'hotel-california',
    title: 'Hotel California',
    artist: 'Eagles',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f2/e2/09/f2e20977-d2fc-2b72-a66e-1c2cd1b5ec3d/mzaf_13001566456027706.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/3d/e0/4e/3de04e44-b03a-e21f-57a9-8db91e13bb18/dj.gmjymjwk.jpg/400x400bb.jpg',
    aliases: ['eagles', 'hotel california', 'hotel'],
  },
  {
    id: 'imagine',
    title: 'Imagine',
    artist: 'John Lennon',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/16/d0/7e/16d07e6b-5be4-cccd-f05d-f3547fbd6cf8/mzaf_16694985754148413619.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4e/77/85/4e778583-f5ae-3093-fe31-f50c5ed875e9/dj.ffjxbfhb.jpg/400x400bb.jpg',
    aliases: ['john lennon', 'lennon', 'imagine', 'beatles'],
  },
  {
    id: 'purple-rain',
    title: 'Purple Rain',
    artist: 'Prince',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/55/19/28/55192829-ecfc-4e44-af08-a5ccbfbc5a5e/mzaf_16748753025027891076.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ca/4d/28/ca4d28a8-b7e4-a3bc-f44f-9c88ef54db1c/dj.pekqfqpu.jpg/400x400bb.jpg',
    aliases: ['prince', 'purple rain'],
  },
  {
    id: 'rolling-in-the-deep',
    title: 'Rolling in the Deep',
    artist: 'Adele',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/3c/ef/7a/3cef7a93-7a9e-0714-e81d-3f5b1748c32f/mzaf_13073268695989680893.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e0/f4/55/e0f45521-a6a1-7e1e-cef5-7e4bbd671e5b/dj.gmupcemb.jpg/400x400bb.jpg',
    aliases: ['adele', 'rolling in the deep', 'rolling deep'],
  },
  {
    id: 'shape-of-you',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/1c/3f/96/1c3f9638-9b6f-dc11-2c50-02f21219f09b/mzaf_16726890869804714680.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/db/f9/26/dbf926c1-fa54-a71a-bd0f-0e3c8a1bb8b3/dj.bvcyggpa.jpg/400x400bb.jpg',
    aliases: ['ed sheeran', 'shape of you', 'sheeran'],
  },
  {
    id: 'uptown-funk',
    title: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/3a/73/a3/3a73a33a-fc04-4e08-8bca-eab11d36524b/mzaf_5685847432547929022.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e1/31/30/e13130cb-7519-0df7-aa44-e9c21c92a4f7/dj.ksywpuwd.jpg/400x400bb.jpg',
    aliases: ['mark ronson', 'bruno mars', 'uptown funk', 'uptown', 'ronson'],
  },
  {
    id: 'blinding-lights',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/b1/b3/4d/b1b34d5e-1b5e-e7bb-4c64-9484d72db61a/mzaf_3501609340571091673.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/dc/5e/ce/dc5ece0e-b3e7-2dc3-c93a-7bdcab5c6891/dj.akxsmqhc.jpg/400x400bb.jpg',
    aliases: ['the weeknd', 'weeknd', 'blinding lights', 'blinding'],
  },
  {
    id: 'hey-jude',
    title: 'Hey Jude',
    artist: 'The Beatles',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f3/dd/4a/f3dd4a8a-0e78-6617-2e59-b9c3ff0ae9e4/mzaf_14476889977960716671.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/89/a0/94/89a0942f-cfdd-9dfe-6df5-fbc5dc7fbe46/dj.fdhkbrdp.jpg/400x400bb.jpg',
    aliases: ['beatles', 'the beatles', 'hey jude'],
  },
  {
    id: 'wonderwall',
    title: 'Wonderwall',
    artist: 'Oasis',
    clipUrl:
      'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a4/ac/27/a4ac2785-8617-ab4e-e5e7-66b3f09d5f1d/mzaf_4028481869777424.plus.aac.p.m4a',
    albumArtUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/14/03/1d/14031d81-6d8f-64e5-a3f2-b3fd92e7524b/dj.egylbkpw.jpg/400x400bb.jpg',
    aliases: ['oasis', 'wonderwall'],
  },
];

/** Pick `count` random songs from the catalog without repeating */
export function pickRandomSongs(count: number): Song[] {
  const shuffled = [...SONG_CATALOG].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Look up a song by ID */
export function getSongById(id: string): Song | undefined {
  return SONG_CATALOG.find((s) => s.id === id);
}
