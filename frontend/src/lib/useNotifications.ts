import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken } from './api';
import type { Notification } from './types';

export function useNotifications() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);

  const refresh = useCallback(() => {
    api.get<Notification[]>('/notifications').then((d) => {
      setNotifs(d);
      setUnread(d.filter((n) => !n.read).length);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    } catch {
      return;
    }
    es.addEventListener('notification', (e) => {
      try {
        const { notification, unread: u } = JSON.parse((e as MessageEvent).data);
        setUnread(u);
        if (notification && typeof notification.id === 'number') {
          setNotifs((prev) => {
            const merged = [notification, ...prev].filter((n) => n && typeof n.id === 'number');
            const seen = new Set<number>();
            return merged.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true))).slice(0, 50);
          });
        }
      } catch { /* noop */ }
    });
    es.addEventListener('connected', (e) => {
      try {
        const { unread: u } = JSON.parse((e as MessageEvent).data);
        if (typeof u === 'number') setUnread(u);
      } catch { /* noop */ }
      liveRef.current = true;
      setLive(true);
    });
    es.addEventListener('sync', () => { refresh(); });
    es.onerror = () => { liveRef.current = false; setLive(false); };
    return () => {
      es?.close();
      liveRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
    const iv = setInterval(() => {
      if (!liveRef.current) refresh();
    }, 20000);
    return () => clearInterval(iv);
  }, [refresh]);

  const markOne = useCallback(async (id: number) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.put(`/notifications/${id}/read`); } catch { refresh(); }
  }, [refresh]);

  const markAll = useCallback(async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await api.put('/notifications/read-all'); } catch { refresh(); }
  }, [refresh]);

  return { notifs, unread, live, refresh, markOne, markAll };
}
