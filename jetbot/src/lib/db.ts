// src/lib/db.ts — IndexedDB wrapper with centralized DB init

const DB_NAME = 'jetbot';
// Bump this when adding new stores or fixing broken DB state
const DB_VERSION = 4;

/** All object stores. Keep in sync when adding new stores. */
const STORES = [
  { name: 'skills',         keyPath: 'name', indices: [] as string[] },
  { name: 'session_meta',   keyPath: 'id',   indices: [] as string[] },
  { name: 'session_turns',  keyPath: 'id',   indices: [] as string[] },
  { name: 'session_index',  keyPath: 'key',  indices: [] as string[] },
  { name: 'memory',         keyPath: 'id',   indices: [] as string[] },
];

let dbInitPromise: Promise<void> | null = null;
let dbVersion: number | null = null; // Actual opened version

function allStoresPresent(db: IDBDatabase): boolean {
  return STORES.every(s => db.objectStoreNames.contains(s.name));
}

function createMissingStores(db: IDBDatabase): void {
  for (const store of STORES) {
    if (!db.objectStoreNames.contains(store.name)) {
      const os = db.createObjectStore(store.name, { keyPath: store.keyPath });
      for (const idx of store.indices) {
        os.createIndex(idx, idx, { unique: false });
      }
    }
  }
}

/** Open the database and ensure ALL stores exist — retries with version bump if needed. */
function initDB(): Promise<void> {
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const version = DB_VERSION + attempt;
      try {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, version);
          req.onupgradeneeded = (ev) => {
            const db = (ev.target as IDBOpenDBRequest).result;
            createMissingStores(db);
          };
          req.onsuccess = () => {
            const db = req.result;
            if (allStoresPresent(db)) {
              dbVersion = db.version;
              db.close();
              resolve();
            } else {
              // Stores still missing — close and try higher version
              db.close();
              resolve(); // let the loop try next version
            }
          };
          req.onerror = () => reject(req.error);
          req.onblocked = () => {
            // Another connection is blocking the upgrade
            console.warn('[db] blocked by another connection, retrying...');
            // Close and reject to retry
            reject(new Error('Blocked'));
          };
        });
        // If we get here successfully, we're done
        if (dbVersion !== null || attempt >= 4) return;
      } catch (err: any) {
        // If blocked or other transient error, retry
        if (attempt >= 4) throw err;
      }
    }
  })();

  return dbInitPromise;
}

/** Open the database for read/write. Assumes initDB() has completed. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function get<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function del(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export { DB_NAME, DB_VERSION, STORES, initDB, put, get, getAll, del, clearStore };
