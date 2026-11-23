export type NavSection =
  | 'studio'
  | 'ai-studio'
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
  isAiGenerated?: boolean;
  lyrics?: string;
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

export type DrumStyle =
  | 'reggaeton'
  | 'trap'
  | 'house'
  | 'lofi'
  | 'pop'
  | 'rock'
  | 'afrobeat'
  | 'synthwave';

export interface AiTrendItem {
  id: string;
  topic: string;
  sourcePlatform: string;
  suggestedGenre: string;
  mood: string;
  bpm: number;
  angle: string;
  musicPrompt: string;
}

export interface AiTrendSource {
  title: string;
  uri: string;
}

export interface AiSongBlueprint {
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  musicalKey: string;
  mood: string;
  drumStyle: DrumStyle;
  sunoPrompt: string;
  lyrics: string;
  vocalHookText: string;
  vocalStyle: string;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  socialCaption: string;
  chordProgression: number[][];
  bassNotes: number[];
  melodyNotes: number[];
}

export interface AiGeneratedSong extends AiSongBlueprint {
  id: string;
  promptUsed: string;
  trendTopic?: string;
  engineLabel: string;
  hasVocal: boolean;
  duration: number;
  fileSize: number;
  coverUrl: string;
  publishedTrackId?: string;
  createdAt: number;
  updatedAt: number;
  audioBlob: Blob;
}
