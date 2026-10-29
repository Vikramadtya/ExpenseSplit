import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '../api/client.gen';
import { getFreshAccessToken } from '../auth/session';

const REFRESH_DEBOUNCE_MS = 250;
const MAX_BACKOFF_MS = 30_000;

/**
 * Keeps the open workspace live: other members' changes arrive as server-sent events and
 * trigger a refetch. Uses fetch (not EventSource) so the Authorization header can be sent.
 */
export function useWorkspaceEvents(workspaceId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    const abort = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => queryClient.invalidateQueries(), REFRESH_DEBOUNCE_MS);
    };

    async function connect() {
      while (!abort.signal.aborted) {
        try {
          const token = await getFreshAccessToken();
          const res = await fetch(
            `${client.getConfig().baseUrl}/workspaces/${workspaceId}/events`,
            {
              headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
              signal: abort.signal,
            },
          );
          if (!res.ok || !res.body) throw new Error(`events ${res.status}`);

          // Anything missed while disconnected is picked up by one refetch on (re)connect.
          if (attempt > 0) scheduleRefresh();
          attempt = 0;

          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const frames = buffer.split('\n\n');
            buffer = frames.pop() ?? '';
            if (frames.some((f) => f.includes('event:'))) scheduleRefresh();
          }
        } catch {
          if (abort.signal.aborted) return;
        }
        attempt += 1;
        const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    void connect();
    return () => {
      abort.abort();
      clearTimeout(refreshTimer);
    };
  }, [workspaceId, queryClient]);
}
