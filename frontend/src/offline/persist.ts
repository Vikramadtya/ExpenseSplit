import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

const CACHE_KEY = 'expensesplit-query-cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Must outlive the persisted copy, or restored data is garbage-collected immediately.
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
    },
    // Offline writes pause and resume automatically when the connection returns.
    mutations: { networkMode: 'online' },
  },
});

/** Stores the query cache in IndexedDB so the app opens instantly, even offline. */
export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get(key),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: CACHE_KEY,
});

/** Called on sign-out so the next person on this device never sees cached data. */
export async function clearPersistedCache() {
  queryClient.clear();
  try {
    await del(CACHE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
