import { AiGeneratedSong, Playlist, RadioStream, StationConfig, Track } from '../types/radio';

const DB_NAME = 'basa_radio_studio_db';
const DB_VERSION = 2;
const STORE_TRACKS = 'tracks';
const STORE_META = 'meta';
const STORE_AI_SONGS = 'ai_songs';

export const DEFAULT_CONFIG: StationConfig = {
  stationName: 'BASA Radio',
  slogan: 'Emisora Online & Estudio de Emisión',
  frequencyLabel: 'FM Digital · 104.5',
  crossfadeSeconds: 4,
  autoDjEnabled: true,
  shuffleEnabled: false,
  repeatMode: 'all',
  masterVolume: 0.85,
  eqBands: [1.5, 0.5, 0, 1.5, 2.0],
  eqPresetName: 'Radio Broadcast',
  compressorEnabled: true,
};

export const DEFAULT_STREAMS: RadioStream[] = [
  {
    id: 'stream-somafm-groove',
    name: 'SomaFM · Groove Salad',
    genre: 'Ambient / Downtempo',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
    country: 'Internacional',
    bitrate: '128 kbps MP3',
  },
  {
    id: 'stream-somafm-lush',
    name: 'SomaFM · Lush',
    genre: 'Electronic / Chillout',
    url: 'https://ice1.somafm.com/lush-128-mp3',
    country: 'Internacional',
    bitrate: '128 kbps MP3',
  },
  {
    id: 'stream-somafm-jazz',
    name: 'SomaFM · Sonic Universe',
    genre: 'Nu-Jazz / Experimental',
    url: 'https://ice1.somafm.com/sonicuniverse-128-mp3',
    country: 'Internacional',
    bitrate: '128 kbps MP3',
  },
  {
    id: 'stream-fip',
    name: 'FIP · Radio France',
    genre: 'Ecléctica / Soul / World',
    url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    country: 'Francia',
    bitrate: '128 kbps MP3',
  },
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_AI_SONGS)) {
        db.createObjectStore(STORE_AI_SONGS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAllTracks(): Promise<Track[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as Track[]) || [];
        items.sort((a, b) => b.addedAt - a.addedAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveTrack(track: Track): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).put(track);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveTracksBatch(tracks: Track[]): Promise<void> {
  if (tracks.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    for (const t of tracks) {
      store.put(t);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteTrackFromDb(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllAiSongs(): Promise<AiGeneratedSong[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AI_SONGS, 'readonly');
      const req = tx.objectStore(STORE_AI_SONGS).getAll();
      req.onsuccess = () => {
        const items = (req.result as AiGeneratedSong[]) || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveAiSong(song: AiGeneratedSong): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AI_SONGS, 'readwrite');
    tx.objectStore(STORE_AI_SONGS).put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAiSongFromDb(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AI_SONGS, 'readwrite');
    tx.objectStore(STORE_AI_SONGS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getMeta<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setMeta<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore storage errors
  }
}

export async function loadPlaylists(): Promise<Playlist[]> {
  const saved = await getMeta<Playlist[]>('playlists');
  return saved || [];
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  await setMeta('playlists', playlists);
}

export async function loadStreams(): Promise<RadioStream[]> {
  const saved = await getMeta<RadioStream[]>('streams');
  return saved || DEFAULT_STREAMS;
}

export async function saveStreams(streams: RadioStream[]): Promise<void> {
  await setMeta('streams', streams);
}

export async function loadConfig(): Promise<StationConfig> {
  const saved = await getMeta<StationConfig>('config');
  return saved ? { ...DEFAULT_CONFIG, ...saved } : DEFAULT_CONFIG;
}

export async function saveConfig(config: StationConfig): Promise<void> {
  await setMeta('config', config);
}

export async function isSeeded(): Promise<boolean> {
  const flag = await getMeta<boolean>('seeded_v1');
  return Boolean(flag);
}

export async function markSeeded(): Promise<void> {
  await setMeta('seeded_v1', true);
}
