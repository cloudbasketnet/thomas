// ============================================================================
// Where the offline copy of the dataset lives.
//
// It used to be localStorage, which was the right call when the app held a few
// hundred rows of text. It is the wrong one now, for two reasons that are not
// going away:
//
//   * Size. Safari gives an origin roughly five megabytes of localStorage, for
//     everything. Receipts, an activity log and a few photos reach that, and
//     when they do every write throws. IndexedDB is measured in hundreds of
//     megabytes on the same device.
//
//   * Blocking. localStorage is synchronous: the whole dataset is serialised
//     and written on the main thread, so the UI waits for it. IndexedDB writes
//     off the main thread, so typing stays smooth however much data there is.
//
// Anything already cached in localStorage is moved across the first time it is
// read, and the old copy deleted — which also hands back the space that was
// full. If IndexedDB cannot be opened at all (private windows, blocked storage)
// this falls back to localStorage and behaves exactly as it did before.
// ============================================================================

const DB = 'cloudbasket'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB, 1)
    } catch {
      return resolve(null)
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        if (!db) return resolve(null)
        let tx: IDBTransaction
        try {
          tx = db.transaction(STORE, mode)
        } catch {
          return resolve(null)
        }
        const req = work(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        // A failed write is handed back so the caller can tell a full disk from
        // a missing value; a failed read is simply "nothing cached".
        req.onerror = () => (mode === 'readwrite' ? reject(req.error) : resolve(null))
      }),
  )
}

const local = {
  get: (k: string) => {
    try { return localStorage.getItem(k) } catch { return null }
  },
  // Deliberately unguarded: a full store must reach the caller so it can be
  // reported, rather than failing silently the way a missing read can.
  set: (k: string, v: string) => localStorage.setItem(k, v),
  del: (k: string) => {
    try { localStorage.removeItem(k) } catch { /* nothing to undo */ }
  },
}

export const idb = {
  async get(key: string): Promise<string | null> {
    const db = await openDb()
    if (!db) return local.get(key)

    const stored = await run<string>('readonly', (s) => s.get(key) as IDBRequest<string>)
    if (typeof stored === 'string') return stored

    // Nothing here yet: bring across whatever localStorage still holds, then
    // let go of it. This is what frees an origin that has filled up.
    const legacy = local.get(key)
    if (legacy == null) return null
    try {
      await run('readwrite', (s) => s.put(legacy, key))
      local.del(key)
    } catch { /* keep the legacy copy if the move fails */ }
    return legacy
  },

  async set(key: string, value: string): Promise<void> {
    const db = await openDb()
    if (!db) return local.set(key, value)
    await run('readwrite', (s) => s.put(value, key))
  },

  async del(key: string): Promise<void> {
    const db = await openDb()
    if (!db) return local.del(key)
    await run('readwrite', (s) => s.delete(key))
    local.del(key)
  },
}

/** Did this failure mean "no room left", whichever store raised it? */
export function isQuotaError(e: unknown) {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)
  )
}
