// src/lib/db.ts — IndexedDB wrapper with centralized DB init

const DB_NAME = 'jetbot';
const DB_VERSION = 2;

/** All object stores. Keep in sync when adding new stores. */
const STORES = [
  { name: 'skills',         keyPath: 'name', indices: [] as string[] },
  { name: 'session_meta',   keyPath: 'id',   indices: [] as string[] },
  { name: 'session_turns',  keyPath: 'id',   indices: [] as string[] },
  { name: 'session_index',  keyPath: 'key',  indices: [] as string[] },
  { name: 'memory',         keyPath: 'id',   indices: [] as string[] },
];

let dbInitPromise: Promise<void> | null = null;

/** Initialize or upgrade the database. Idempotent — safe to call many times. */
function initDB(): Promise<void> {
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store.name)) {
          const os = db.createObjectStore(store.name, { keyPath: store.keyPath });
          for (const idx of store.indices) {
            os.createIndex(idx, idx, { unique: false });
          }
        }
      }
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = (ev) => {
      const err = (ev.target as IDBOpenDBRequest).error;
      if (err?.name === 'VersionError') {
        // DB was created by a future version — wipe and recreate
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => {
          dbInitPromise = null;
          initDB().then(resolve).catch(reject);
        };
        del.onerror = () => reject(err);
      } else {
        reject(err);
      }
    };
  });

  return dbInitPromise;
}

/** Open database at current version — caller must ensure initDB() completed. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put<T>(storeName: string, value: T, key?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key ? store.put(value, key) : store.put(value);
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
