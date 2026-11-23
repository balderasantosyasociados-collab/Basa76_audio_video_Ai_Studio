export type NavSection =
  | 'studio'
  | 'library'
  | 'playlists'
  | 'streams'
  | 'equalizer';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // seconds
  fileSize: number; // bytes
  mimeType: string;
  fileName: string;
  coverUrl?: string; // data URL or static asset path
  isFavorite: boolean;
  isJingle: boolean;
  isStarter?: boolean;
  playCount: number;
  addedAt: number;
  audioBlob?: Blob; // persisted in IndexedDB
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
}

export interface RadioStream {
  id: string;
  name: string;
  genre: string;
  url: string;
  country: string;
  bitrate?: string;
  isCustom?: boolean;
}

export interface EqBand {
  frequency: number;
  label: string;
  gain: number; // -12 to +12 dB
}

export interface StationConfig {
  stationName: string;
  slogan: string;
  frequencyLabel: string;
  crossfadeSeconds: number; // 0 to 8
  autoDjEnabled: boolean;
  shuffleEnabled: boolean;
  repeatMode: 'all' | 'one' | 'off';
  masterVolume: number; // 0 to 1
  eqBands: number[]; // 5 gains in dB
  eqPresetName: string;
  compressorEnabled: boolean;
}

export interface PlaybackState {
  mode: 'track' | 'stream';
  currentTrackId: string | null;
  currentStreamId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isCrossfading: boolean;
  micActive: boolean;
  micError: string | null;
  streamError: string | null;
  activeJingleId: string | null;
}
