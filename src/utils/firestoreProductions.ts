import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CreativeProduction,
  DrumStyle,
  LicenseTier,
  ProductionCharacter,
  ProductionScene,
} from '../types/radio';

const ALLOWED_DRUM_STYLES: ReadonlySet<DrumStyle> = new Set([
  'reggaeton',
  'trap',
  'house',
  'lofi',
  'pop',
  'rock',
  'afrobeat',
  'synthwave',
]);

function normalizeDrumStyle(val: unknown): DrumStyle {
  const s = String(val || '').toLowerCase() as DrumStyle;
  return ALLOWED_DRUM_STYLES.has(s) ? s : 'pop';
}

function nonEmpty(val: unknown, fallback: string, maxLen: number): string {
  const s = String(val || '').trim();
  return (s.length > 0 ? s : fallback).slice(0, maxLen);
}

function tsToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  return Date.now();
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapFirestoreDocToProduction(
  docData: Record<string, unknown>
): CreativeProduction {
  return {
    id: String(docData.id || ''),
    ownerId: String(docData.ownerId || ''),
    ownerName: String(docData.ownerName || 'Creador'),
    format: (docData.format as CreativeProduction['format']) || 'series',
    sourceBasis: (docData.sourceBasis as CreativeProduction['sourceBasis']) || 'original',
    studioStyle: String(docData.studioStyle || 'BASA Studios'),
    targetPlatform: String(docData.targetPlatform || 'Netflix / YouTube'),
    resolution: (docData.resolution as CreativeProduction['resolution']) || '5K',
    promptInput: String(docData.promptInput || ''),
    title: String(docData.title || 'Sin título'),
    genre: String(docData.genre || 'Drama'),
    rating: String(docData.rating || '+13'),
    logline: String(docData.logline || ''),
    synopsis: String(docData.synopsis || ''),
    lyrics: String(docData.lyrics || ''),
    soundtrackPrompt: String(docData.soundtrackPrompt || ''),
    bpm: Number(docData.bpm || 100),
    drumStyle: normalizeDrumStyle(docData.drumStyle),
    chordProgression: safeJsonParse<number[][]>(docData.chordProgressionJson, [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 67],
      [52, 55, 59, 64],
    ]),
    bassNotes: safeJsonParse<number[]>(docData.bassNotesJson, [45, 45, 41, 41, 43, 43, 40, 40]),
    melodyNotes: safeJsonParse<number[]>(
      docData.melodyNotesJson,
      [69, 72, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 71, 69]
    ),
    characters: safeJsonParse<ProductionCharacter[]>(docData.charactersJson, []),
    scenes: safeJsonParse<ProductionScene[]>(docData.scenesJson, []),
    contractSigned: Boolean(docData.contractSigned),
    contractSignerName: docData.contractSignerName
      ? String(docData.contractSignerName)
      : undefined,
    contractDocumentId: docData.contractDocumentId
      ? String(docData.contractDocumentId)
      : undefined,
    contractHash: docData.contractHash ? String(docData.contractHash) : undefined,
    isPaid: Boolean(docData.isPaid),
    licenseTier: (docData.licenseTier as LicenseTier) || 'none',
    isPublicCatalog: Boolean(docData.isPublicCatalog),
    createdAtMs: tsToMs(docData.createdAt),
    updatedAtMs: tsToMs(docData.updatedAt),
  };
}

export function subscribeUserProductions(
  userId: string,
  onData: (items: CreativeProduction[]) => void
): () => void {
  const path = `users/${userId}/productions`;
  const q = query(
    collection(db, 'users', userId, 'productions'),
    where('ownerId', '==', userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapFirestoreDocToProduction(d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribePublicCatalog(
  onData: (items: CreativeProduction[]) => void
): () => void {
  const path = 'publicCatalog';
  const q = query(
    collection(db, 'publicCatalog'),
    where('isPublicCatalog', '==', true)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapFirestoreDocToProduction(d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createUserProduction(
  user: User,
  draft: Omit<
    CreativeProduction,
    | 'ownerId'
    | 'ownerName'
    | 'contractSigned'
    | 'isPaid'
    | 'licenseTier'
    | 'isPublicCatalog'
    | 'createdAtMs'
    | 'updatedAtMs'
  >
): Promise<void> {
  const cleanId = nonEmpty(draft.id.replace(/[^a-zA-Z0-9_\-]/g, '_'), `prod_${Date.now()}`, 128);
  const path = `users/${user.uid}/productions/${cleanId}`;
  const ref = doc(db, 'users', user.uid, 'productions', cleanId);

  const payload = {
    id: cleanId,
    ownerId: user.uid,
    ownerName: nonEmpty(user.displayName || user.email, 'Creador BASA', 120),
    format: draft.format,
    sourceBasis: draft.sourceBasis,
    studioStyle: nonEmpty(draft.studioStyle, 'BASA Studios', 100),
    targetPlatform: nonEmpty(draft.targetPlatform, 'Netflix & YouTube 5K', 60),
    resolution: draft.resolution,
    promptInput: nonEmpty(draft.promptInput, 'Obra creativa', 1500),
    title: nonEmpty(draft.title, 'Producción Original BASA', 160),
    genre: nonEmpty(draft.genre, 'Drama Cinematográfico', 100),
    rating: nonEmpty(draft.rating, '+13', 20),
    logline: nonEmpty(draft.logline, 'Una historia creada en BASA Espacio Creativo.', 500),
    synopsis: nonEmpty(draft.synopsis, draft.promptInput || 'Sinopsis generada en estudio.', 4000),
    lyrics: String(draft.lyrics || '').slice(0, 5000),
    soundtrackPrompt: String(draft.soundtrackPrompt || '').slice(0, 1000),
    bpm: Math.max(60, Math.min(200, Math.round(draft.bpm || 105))),
    drumStyle: normalizeDrumStyle(draft.drumStyle),
    chordProgressionJson: JSON.stringify(draft.chordProgression || []).slice(0, 1000),
    bassNotesJson: JSON.stringify(draft.bassNotes || []).slice(0, 500),
    melodyNotesJson: JSON.stringify(draft.melodyNotes || []).slice(0, 500),
    charactersJson: JSON.stringify(draft.characters || []).slice(0, 6000),
    scenesJson: JSON.stringify(draft.scenes || []).slice(0, 20000),
    contractSigned: false,
    isPaid: false,
    licenseTier: 'none',
    isPublicCatalog: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function signProductionContract(
  userId: string,
  production: CreativeProduction,
  signerName: string,
  documentId: string,
  contractHash: string
): Promise<void> {
  const path = `users/${userId}/productions/${production.id}`;
  const ref = doc(db, 'users', userId, 'productions', production.id);
  try {
    await updateDoc(ref, {
      contractSigned: true,
      contractSignerName: signerName.trim().slice(0, 140),
      contractDocumentId: documentId.trim().slice(0, 60) || 'DECLARACION-DIGITAL',
      contractHash: contractHash.slice(0, 120),
      updatedAt: serverTimestamp(),
    });
    if (production.isPublicCatalog) {
      await updateDoc(doc(db, 'publicCatalog', production.id), {
        contractSigned: true,
        contractSignerName: signerName.trim().slice(0, 140),
        contractDocumentId: documentId.trim().slice(0, 60) || 'DECLARACION-DIGITAL',
        contractHash: contractHash.slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function unlockProductionWithOrder(
  userId: string,
  production: CreativeProduction,
  licenseTier: Exclude<LicenseTier, 'none'>,
  amountUsd: number,
  paymentMethodLabel: string
): Promise<void> {
  const orderId = `ord_${production.id}`;
  const prodPath = `users/${userId}/productions/${production.id}`;

  const batch = writeBatch(db);
  const orderRef = doc(db, 'users', userId, 'orders', orderId);
  const prodRef = doc(db, 'users', userId, 'productions', production.id);

  batch.set(orderRef, {
    id: orderId,
    ownerId: userId,
    productionId: production.id,
    licenseTier,
    amountUsd,
    paymentMethodLabel: paymentMethodLabel.slice(0, 80),
    status: 'paid',
    createdAt: serverTimestamp(),
  });

  batch.update(prodRef, {
    isPaid: true,
    licenseTier,
    updatedAt: serverTimestamp(),
  });

  if (production.isPublicCatalog) {
    batch.update(doc(db, 'publicCatalog', production.id), {
      isPaid: true,
      licenseTier,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, prodPath);
  }
}

export async function togglePublicCatalogStatus(
  userId: string,
  production: CreativeProduction,
  makePublic: boolean
): Promise<void> {
  const privRef = doc(db, 'users', userId, 'productions', production.id);
  const pubRef = doc(db, 'publicCatalog', production.id);
  const path = `users/${userId}/productions/${production.id}`;

  try {
    await updateDoc(privRef, {
      isPublicCatalog: makePublic,
      updatedAt: serverTimestamp(),
    });

    if (makePublic) {
      await setDoc(pubRef, {
        id: production.id,
        ownerId: userId,
        ownerName: production.ownerName.slice(0, 120),
        format: production.format,
        sourceBasis: production.sourceBasis,
        studioStyle: production.studioStyle.slice(0, 100),
        targetPlatform: production.targetPlatform.slice(0, 60),
        resolution: production.resolution,
        promptInput: production.promptInput.slice(0, 1500),
        title: production.title.slice(0, 160),
        genre: production.genre.slice(0, 100),
        rating: (production.rating || '+13').slice(0, 20),
        logline: production.logline.slice(0, 500),
        synopsis: production.synopsis.slice(0, 4000),
        lyrics: (production.lyrics || '').slice(0, 5000),
        soundtrackPrompt: (production.soundtrackPrompt || '').slice(0, 1000),
        bpm: production.bpm,
        drumStyle: production.drumStyle,
        chordProgressionJson: JSON.stringify(production.chordProgression || []).slice(0, 1000),
        bassNotesJson: JSON.stringify(production.bassNotes || []).slice(0, 500),
        melodyNotesJson: JSON.stringify(production.melodyNotes || []).slice(0, 500),
        charactersJson: JSON.stringify(production.characters || []).slice(0, 6000),
        scenesJson: JSON.stringify(production.scenes || []).slice(0, 20000),
        contractSigned: production.contractSigned,
        ...(production.contractSignerName
          ? { contractSignerName: production.contractSignerName.slice(0, 140) }
          : {}),
        ...(production.contractDocumentId
          ? { contractDocumentId: production.contractDocumentId.slice(0, 60) }
          : {}),
        ...(production.contractHash
          ? { contractHash: production.contractHash.slice(0, 120) }
          : {}),
        isPaid: production.isPaid,
        licenseTier: production.licenseTier,
        isPublicCatalog: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(pubRef).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserProduction(
  userId: string,
  productionId: string
): Promise<void> {
  const path = `users/${userId}/productions/${productionId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'productions', productionId));
    await deleteDoc(doc(db, 'publicCatalog', productionId)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
