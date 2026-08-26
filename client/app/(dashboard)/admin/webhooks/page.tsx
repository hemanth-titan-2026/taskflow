"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canAdmin } from '@/components/RoleBadge';

export default function WebhooksPage() {
  const { currentOrg } = useAuth();
  const router = useRouter();
  const role = currentOrg?.role || 'VIEWER';
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['task.created']);
  const [error, setError] = useState('');
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);

  const allEvents = ['task.created', 'task.updated', 'task.deleted', 'task.status_changed', 'comment.created', 'project.created', 'member.joined', 'member.removed'];

  useEffect(() => {
    if (!canAdmin(role)) { router.push('/'); return; }
    loadWebhooks();
  }, [role, router]);

  async function loadWebhooks() {
    try { const res = await api.get('/webhooks'); setWebhooks(res.data.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      await api.post('/webhooks', { url, events });
      setShowCreate(false); setUrl(''); setEvents(['task.created']);
      loadWebhooks();
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed'); }
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return;
    await api.delete(`/webhooks/${id}`);
    setWebhooks(prev => prev.filter(w => w.id !== id));
    if (selectedWebhook?.id === id) setSelectedWebhook(null);
  }

  async function toggleWebhook(id: string, active: boolean) {
    await api.patch(`/webhooks/${id}`, { active: !active });
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !active } : w));
  }

  async function viewDeliveries(webhook: any) {
    try {
      const res = await api.get(`/webhooks/${webhook.id}`);
      setSelectedWebhook(res.data.data);
    } catch (e) { console.error(e); }
  }

  if (!canAdmin(role)) return null;
  if (loading) return <div className="p-8 text-muted-foreground">Loading webhooks...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground text-sm">Events are dispatched when tasks are created, updated, deleted, or commented on.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all">+ Add Webhook</button>
      </div>

      {showCreate && (
        <div className="bg-accent rounded-2xl border border-border p-6 mb-6">
          <h3 className="text-foreground font-semibold mb-4">New Webhook</h3>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <form onSubmit={createWebhook} className="space-y-4">
            <input type="url" placeholder="https://your-service.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" required />
            <div>
              <p className="text-sm text-foreground mb-2">Events to subscribe:</p>
              <div className="flex flex-wrap gap-2">
                {allEvents.map(ev => (
                  <label key={ev} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all border ${events.includes(ev) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                    <input type="checkbox" className="hidden" checked={events.includes(ev)}
                      onChange={() => setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])} />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-accent border border-border text-foreground text-sm rounded-xl">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks list */}
      {webhooks.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">No webhooks configured</p>
          <p className="text-sm">Create a webhook to receive real-time events when actions happen in your organization.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {webhooks.map(w => (
            <div key={w.id} className="p-4 bg-accent border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${w.active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    <p className="text-foreground text-sm font-mono truncate">{w.url}</p>
                  </div>
                  <p className="text-muted-foreground text-xs">{w.events.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => viewDeliveries(w)} className="px-3 py-1 text-xs text-foreground bg-background border border-border rounded-lg hover:bg-accent transition-all">Deliveries</button>
                  <button onClick={() => toggleWebhook(w.id, w.active)} className={`px-3 py-1 text-xs rounded-lg ${w.active ? 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10' : 'text-green-600 dark:text-green-400 hover:bg-green-500/10'}`}>
                    {w.active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => deleteWebhook(w.id)} className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delivery Log */}
      {selectedWebhook && (
        <div className="bg-accent rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Delivery Log</h2>
            <button onClick={() => setSelectedWebhook(null)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
          </div>
          <p className="text-xs text-muted-foreground mb-4 font-mono">{selectedWebhook.url}</p>
          {selectedWebhook.deliveries?.length === 0 ? (
            <p className="text-muted-foreground text-sm">No deliveries yet. Create or update a task to trigger events.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedWebhook.deliveries?.map((d: any) => (
                <div key={d.id} className="p-3 bg-background border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${d.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm text-foreground font-medium">{d.event}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.responseStatus && <span className="text-xs text-muted-foreground">HTTP {d.responseStatus}</span>}
                      <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Attempts: {d.attempts}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
