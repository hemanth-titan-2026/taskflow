"use client";
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function OrgSwitcher() {
  const { organizations, currentOrg, setCurrentOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [error, setError] = useState('');

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/organizations', { name: newName, slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '') });
      const newOrg = res.data.data;
      setCurrentOrg({ id: newOrg.id, name: newOrg.name, slug: newOrg.slug, role: 'OWNER' });
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create');
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/50 hover:bg-accent text-foreground text-sm transition-all">
        <span className="w-6 h-6 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-xs font-bold">
          {currentOrg?.name?.[0]?.toUpperCase() || 'T'}
        </span>
        <span className="flex-1 text-left truncate">{currentOrg?.name || 'Select Organization'}</span>
        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-1">
            {organizations.map(org => (
              <button key={org.id} onClick={() => { setCurrentOrg(org); setOpen(false); window.location.reload(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${org.slug === currentOrg?.slug ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                <span className="w-5 h-5 bg-primary text-primary-foreground rounded flex items-center justify-center text-[10px] font-bold">{org.name[0].toUpperCase()}</span>
                <span className="flex-1 text-left truncate">{org.name}</span>
                {org.slug === currentOrg?.slug && <span className="text-[10px] text-muted-foreground">current</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button onClick={() => { setShowCreate(true); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
              <span className="w-5 h-5 border border-dashed border-muted-foreground rounded flex items-center justify-center text-xs">+</span>
              Create Organization
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-foreground mb-1">Create Organization</h2>
            <p className="text-sm text-muted-foreground mb-6">Set up a new workspace for your team.</p>
            {error && <p className="text-red-400 text-sm mb-3 bg-red-500/10 p-2 rounded-lg">{error}</p>}
            <form onSubmit={createOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Organization Name</label>
                <input value={newName} onChange={e => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')); }}
                  className="w-full px-4 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="My Company" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Slug</label>
                <input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full px-4 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm font-mono placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="my-company" required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all text-sm">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-accent border border-border text-foreground font-medium rounded-xl hover:bg-accent/80 transition-all text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
