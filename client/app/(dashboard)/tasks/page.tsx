"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.get('/tasks?perPage=100&sortBy=createdAt&sortOrder=desc').then(r => setTasks(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);

  if (loading) return <div className="p-8 text-white/40">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">All Tasks</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {['ALL','BACKLOG','TODO','IN PROGRESS','IN REVIEW','DONE'].map(s => {
          const val = s === 'ALL' ? 'ALL' : s.replace(' ', '_');
          return (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filter === val ? 'bg-white text-black' : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white'}`}>
              {s}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {filtered.map(task => (
          <div key={task.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] transition-all">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stColor(task.status)}`} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm">{task.title}</p>
              <p className="text-white/20 text-xs">#{task.number}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${prStyle(task.priority)}`}>{task.priority}</span>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusStyle(task.status)}`}>{task.status.replace('_',' ')}</span>
            <Link href={`/projects/${task.projectId}`} className="text-xs text-white/40 hover:text-white">Board →</Link>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-white/30 text-center py-8">No tasks match this filter</p>}
    </div>
  );
}

function stColor(s: string) { return { BACKLOG:'bg-white/20',TODO:'bg-white/60',IN_PROGRESS:'bg-white',IN_REVIEW:'bg-white/70',DONE:'bg-white' }[s]||'bg-white/20'; }
function prStyle(p: string) { return { URGENT:'text-white bg-white/10 border-white/20',HIGH:'text-white/80 bg-white/5 border-white/15',MEDIUM:'text-white/50 bg-white/5 border-white/10',LOW:'text-white/30 bg-white/5 border-white/10' }[p]||''; }
function statusStyle(s: string) { return { BACKLOG:'text-white/40 bg-white/5 border-white/10',TODO:'text-white/70 bg-white/5 border-white/15',IN_PROGRESS:'text-white bg-white/10 border-white/20',IN_REVIEW:'text-white/70 bg-white/5 border-white/15',DONE:'text-white bg-white/10 border-white/20' }[s]||''; }
