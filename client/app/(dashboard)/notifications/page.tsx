"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications?perPage=50').then(r => setNotifications(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await api.post('/notifications/mark-all-read');
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllRead} className="text-sm text-blue-400 hover:text-blue-300">Mark all as read</button>
        )}
      </div>
      {notifications.length === 0 ? <p className="text-gray-500 text-center py-12">No notifications yet</p> : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`p-4 rounded-lg border ${n.read ? 'bg-gray-800 border-gray-700' : 'bg-gray-800 border-blue-600/50'}`}>
              <div className="flex items-center gap-2">
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                <p className="text-white text-sm font-medium">{n.title}</p>
              </div>
              {n.body && <p className="text-gray-400 text-sm mt-1">{n.body}</p>}
              <p className="text-gray-500 text-xs mt-2">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
