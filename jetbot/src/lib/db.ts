// src/lib/db.ts — Minimal IndexedDB wrapper for session/skill/memory storage

/** Open a database at the given version for migrations (creation/upgrade only). */
function openDB(name: string, version: number, onUpgrade: (db: IDBDatabase, from: number) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      onUpgrade(db, ev.oldVersion);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Open a database at its current version (no upgrade).
 * Uses indexedDB.open(name) without version — connects to whatever version exists.
 */
function openCurrent(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // If DB doesn't exist at all, reject
      reject(req.error);
    };
  });
}

async function put<T>(dbName: string, storeName: string, value: T, key?: string): Promise<void> {
  const db = await openCurrent(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key ? store.put(value, key) : store.put(value);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function get<T>(dbName: string, storeName: string, key: string): Promise<T | undefined> {
  const db = await openCurrent(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAll<T>(dbName: string, storeName: string): Promise<T[]> {
  const db = await openCurrent(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function del(dbName: string, storeName: string, key: string): Promise<void> {
  const db = await openCurrent(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function clearStore(dbName: string, storeName: string): Promise<void> {
  const db = await openCurrent(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function ensureStore(dbName: string, version: number, storeName: string, keyPath: string, indices: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath });
        for (const idx of indices) {
          store.createIndex(idx, idx, { unique: false });
        }
      }
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = (ev) => {
      // Handle DB from future version: delete and recreate
      const err = (ev.target as IDBOpenDBRequest).error;
      if (err?.name === 'VersionError') {
        const delReq = indexedDB.deleteDatabase(dbName);
        delReq.onsuccess = () => {
          const retryReq = indexedDB.open(dbName, version);
          retryReq.onupgradeneeded = (uev) => {
            const db = (uev.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath });
              for (const idx of indices) {
                store.createIndex(idx, idx, { unique: false });
              }
            }
          };
          retryReq.onsuccess = () => { retryReq.result.close(); resolve(); };
          retryReq.onerror = () => reject(retryReq.error!);
        };
        delReq.onerror = () => reject(delReq.error!);
      } else {
        reject(req.error!);
      }
    };
  });
}

export { openDB, put, get, getAll, del, clearStore, ensureStore };
