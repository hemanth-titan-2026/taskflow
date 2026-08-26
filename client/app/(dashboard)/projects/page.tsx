"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canAdmin } from '@/components/RoleBadge';

export default function Projects() {
  const { currentOrg } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState('');
  const isAdmin = currentOrg ? canAdmin(currentOrg.role) : false;

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try { const res = await api.get('/projects'); setProjects(res.data.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/projects', { name, key: key.toUpperCase(), description: desc });
      setShowCreate(false); setName(''); setKey(''); setDesc('');
      fetchProjects();
    } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed'); }
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        {isAdmin && <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">+ New Project</button>}
      </div>
      {showCreate && (
        <form onSubmit={createProject} className="mb-6 p-5 bg-gray-800 border border-gray-700 rounded-xl space-y-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            <input placeholder="KEY" value={key} onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={10}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Create</button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancel</button>
          </div>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="p-5 bg-gray-800 border border-gray-700 rounded-xl hover:border-blue-600/50 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-1 bg-blue-900/50 text-blue-400 text-xs font-mono rounded">{p.key}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{p.status}</span>
            </div>
            <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors">{p.name}</h3>
            {p.description && <p className="text-gray-400 text-sm mt-1 line-clamp-2">{p.description}</p>}
            <p className="text-gray-500 text-xs mt-3">{p._count.tasks} tasks</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
