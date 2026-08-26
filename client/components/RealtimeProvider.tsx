"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { connectSocket, disconnectSocket, getSocket, joinOrg } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';
import { Socket } from 'socket.io-client';

interface Toast {
  id: string;
  title: string;
  body?: string;
  type: 'info' | 'success' | 'warning';
}

interface RealtimeContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: string[];
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  socket: null,
  connected: false,
  onlineUsers: [],
  toasts: [],
  dismissToast: () => {},
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, currentOrg } = useAuth();
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user || !currentOrg) return;

    try {
      const s = connectSocket();
      setSocketInstance(s);

      s.on('connect', () => {
        setConnected(true);
        joinOrg(currentOrg.id);
        s.emit('presence:active');
      });

      s.on('disconnect', () => setConnected(false));

      // Real-time notifications
      s.on('notification', (data: any) => {
        addToast({ title: data.title || 'New notification', body: data.body, type: 'info' });
      });

      // Task events
      s.on('task.created', (data: any) => {
        addToast({ title: 'Task created', body: data.data?.task?.title || '', type: 'success' });
      });

      s.on('task.updated', (data: any) => {
        const changes = data.data?.changes;
        if (changes?.status) {
          addToast({ title: 'Task status changed', body: `${data.data?.task?.title}: ${changes.status.from} → ${changes.status.to}`, type: 'info' });
        }
      });

      s.on('comment.created', (data: any) => {
        addToast({ title: 'New comment', body: data.data?.comment?.content?.slice(0, 60) || '', type: 'info' });
      });

      // Presence
      s.on('presence:online', (data: { userId: string }) => {
        setOnlineUsers(prev => [...new Set([...prev, data.userId])]);
      });

      s.on('presence:offline', (data: { userId: string }) => {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      });

      return () => { disconnectSocket(); setConnected(false); setSocketInstance(null); };
    } catch (e) {
      console.log('[WS] Failed to connect:', e);
    }
  }, [user, currentOrg]);

  function addToast(toast: Omit<Toast, 'id'>) {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    // Auto-dismiss after 5s
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }

  function dismissToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return (
    <RealtimeContext.Provider value={{ socket: socketInstance, connected, onlineUsers, toasts, dismissToast }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
