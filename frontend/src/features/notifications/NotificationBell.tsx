import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getPushPublicKeyOptions,
  listNotificationsOptions,
  listNotificationsQueryKey,
  markAllNotificationsReadMutation,
  markNotificationReadMutation,
  subscribePushMutation,
  unsubscribePushMutation,
} from '../../api/@tanstack/react-query.gen';
import { currentSubscription, pushSupported, subscribeToPush } from './push';

const timeAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (24 * 60))}d ago`;
};

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const { data } = useQuery(listNotificationsOptions());
  const { data: key } = useQuery({ ...getPushPublicKeyOptions(), staleTime: Infinity });
  const refresh = () => queryClient.invalidateQueries({ queryKey: listNotificationsQueryKey() });

  const markOne = useMutation({ ...markNotificationReadMutation(), onSuccess: refresh });
  const markAll = useMutation({ ...markAllNotificationsReadMutation(), onSuccess: refresh });
  const subscribe = useMutation(subscribePushMutation());
  const unsubscribe = useMutation(unsubscribePushMutation());

  useEffect(() => {
    void currentSubscription().then((s) => setPushOn(Boolean(s)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const togglePush = async () => {
    try {
      if (pushOn) {
        const sub = await currentSubscription();
        if (sub) {
          await unsubscribe.mutateAsync({ body: { endpoint: sub.endpoint } });
          await sub.unsubscribe();
        }
        setPushOn(false);
      } else if (key?.publicKey) {
        const sub = await subscribeToPush(key.publicKey);
        if (!sub) return toast.error('Notifications are blocked in this browser');
        const json = sub.toJSON();
        await subscribe.mutateAsync({
          body: {
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
          },
        });
        setPushOn(true);
      }
    } catch {
      toast.error('Could not change push notifications');
    }
  };

  const unread = data?.unreadCount ?? 0;
  const canPush = pushSupported() && Boolean(key?.publicKey);

  return (
    <div className="relative" ref={panel}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative p-2 rounded-full text-text-muted hover:text-text-main hover:bg-surface transition-colors"
      >
        {unread > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] glass-panel rounded-xl shadow-lg border border-border z-30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm text-text-main">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate({})}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-border">
            {(data?.items ?? []).length === 0 && (
              <li className="px-4 py-6 text-sm text-center text-text-muted">Nothing yet</li>
            )}
            {(data?.items ?? []).map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => !n.readAt && markOne.mutate({ path: { id: n.id } })}
                  className={`w-full text-left px-4 py-3 hover:bg-surface/60 transition-colors ${n.readAt ? 'opacity-60' : ''}`}
                >
                  <p className="text-sm font-medium text-text-main">{n.message.title}</p>
                  {n.message.body && (
                    <p className="text-xs text-text-muted mt-0.5">{n.message.body}</p>
                  )}
                  <p className="text-[11px] text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
          {canPush && (
            <label className="flex items-center justify-between px-4 py-3 border-t border-border text-sm text-text-muted cursor-pointer">
              Push notifications
              <input type="checkbox" checked={pushOn} onChange={togglePush} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
