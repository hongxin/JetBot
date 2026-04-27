// src/lib/db.ts — Minimal IndexedDB wrapper for session/skill/memory storage

type Migrations = Record<number, (db: IDBDatabase) => void>;

function openDB(name: string, version: number, migrations: Migrations): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      const from = ev.oldVersion;
      for (let v = from + 1; v <= version; v++) {
        if (migrations[v]) migrations[v](db);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put<T>(dbName: string, storeName: string, value: T, key?: string): Promise<void> {
  const db = await openDB(dbName, 1, {});
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key ? store.put(value, key) : store.put(value);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function get<T>(dbName: string, storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB(dbName, 1, {});
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAll<T>(dbName: string, storeName: string): Promise<T[]> {
  const db = await openDB(dbName, 1, {});
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function del(dbName: string, storeName: string, key: string): Promise<void> {
  const db = await openDB(dbName, 1, {});
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function clearStore(dbName: string, storeName: string): Promise<void> {
  const db = await openDB(dbName, 1, {});
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
    req.onerror = () => reject(req.error);
  });
}

export { openDB, put, get, getAll, del, clearStore, ensureStore };
