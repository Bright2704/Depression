/**
 * เก็บเวกเตอร์และ PHQ-9 ในเครื่องเป็นค่าเริ่มต้น (ไม่ส่งเซิร์ฟเวอร์จนกว่าจะ opt-in)
 */

const DB_NAME = 'facepsy-wellness-v1';
const DB_VERSION = 1;
const STORE_VECTORS = 'vector_samples';
const STORE_PHQ9 = 'phq9_labels';

export interface LocalVectorRecord {
  id: string;
  createdAt: number;
  dim: number;
  vector: number[];
  timeEpoch?: string;
  sessionId?: string;
}

export interface LocalPhq9Record {
  id: string;
  createdAt: number;
  totalScore: number;
  answers?: number[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VECTORS)) {
        db.createObjectStore(STORE_VECTORS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PHQ9)) {
        db.createObjectStore(STORE_PHQ9, { keyPath: 'id' });
      }
    };
  });
}

function randomId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveLocalVectorSample(payload: Omit<LocalVectorRecord, 'id' | 'createdAt'>): Promise<LocalVectorRecord> {
  const db = await openDb();
  const rec: LocalVectorRecord = {
    id: randomId(),
    createdAt: Date.now(),
    ...payload,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VECTORS, 'readwrite');
    tx.objectStore(STORE_VECTORS).put(rec);
    tx.oncomplete = () => resolve(rec);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLocalPhq9Label(payload: Omit<LocalPhq9Record, 'id' | 'createdAt'>): Promise<LocalPhq9Record> {
  const db = await openDb();
  const rec: LocalPhq9Record = {
    id: randomId(),
    createdAt: Date.now(),
    ...payload,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHQ9, 'readwrite');
    tx.objectStore(STORE_PHQ9).put(rec);
    tx.oncomplete = () => resolve(rec);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllLocalVectors(): Promise<LocalVectorRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VECTORS, 'readonly');
    const req = tx.objectStore(STORE_VECTORS).getAll();
    req.onsuccess = () => resolve(req.result as LocalVectorRecord[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalPhq9(): Promise<LocalPhq9Record[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHQ9, 'readonly');
    const req = tx.objectStore(STORE_PHQ9).getAll();
    req.onsuccess = () => resolve(req.result as LocalPhq9Record[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearLocalVectors(ids: string[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VECTORS, 'readwrite');
    const store = tx.objectStore(STORE_VECTORS);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearLocalPhq9(ids: string[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PHQ9, 'readwrite');
    const store = tx.objectStore(STORE_PHQ9);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllWellnessData(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VECTORS, STORE_PHQ9], 'readwrite');
    tx.objectStore(STORE_VECTORS).clear();
    tx.objectStore(STORE_PHQ9).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
