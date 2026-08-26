"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import RoleBadge, { canAdmin, canEdit } from '@/components/RoleBadge';

export default function Dashboard() {
  const { user, currentOrg } = useAuth();
  const role = currentOrg?.role || 'VIEWER';
  const [stats, setStats] = useState({ totalProjects: 0, totalTasks: 0, inProgress: 0, done: 0, members: 0 });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, t] = await Promise.all([api.get('/projects'), api.get('/tasks?perPage=100')]);
        const tasks = t.data.data;
        setStats({ totalProjects: p.data.data.length, totalTasks: tasks.length, inProgress: tasks.filter((x: any) => x.status === 'IN_PROGRESS').length, done: tasks.filter((x: any) => x.status === 'DONE').length, members: 0 });
        setRecentTasks(tasks.slice(0, 5));
        if (canAdmin(role)) { try { const m = await api.get(`/organizations/${currentOrg?.id}/members`); setMembers(m.data.data); setStats(prev => ({ ...prev, members: m.data.data.length })); } catch {} }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    load();
  }, [role, currentOrg]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.firstName}!</h1>
        <RoleBadge role={role} />
      </div>
      <p className="text-muted-foreground mb-8">
        {role === 'OWNER' && "Full control over this organization."}
        {role === 'ADMIN' && "Manage projects, members, and settings."}
        {role === 'MEMBER' && "Create and manage tasks and comments."}
        {role === 'VIEWER' && "Read-only access to projects and tasks."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 bg-accent rounded-2xl border border-border"><p className="text-3xl font-bold text-foreground">{stats.totalProjects}</p><p className="text-sm text-muted-foreground mt-1">Projects</p></div>
        <div className="p-5 bg-accent rounded-2xl border border-border"><p className="text-3xl font-bold text-foreground">{stats.totalTasks}</p><p className="text-sm text-muted-foreground mt-1">Total Tasks</p></div>
        <div className="p-5 bg-accent rounded-2xl border border-border"><p className="text-3xl font-bold text-foreground">{stats.inProgress}</p><p className="text-sm text-muted-foreground mt-1">In Progress</p></div>
        <div className="p-5 bg-accent rounded-2xl border border-border"><p className="text-3xl font-bold text-foreground">{stats.done}</p><p className="text-sm text-muted-foreground mt-1">Completed</p></div>
      </div>

      <div className={`grid ${canAdmin(role) ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6`}>
        <div className="bg-accent rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Tasks</h2>
            <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          {recentTasks.length === 0 ? <p className="text-muted-foreground">No tasks yet.</p> : (
            <div className="space-y-2">
              {recentTasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${task.status === 'DONE' ? 'bg-green-500' : task.status === 'IN_PROGRESS' ? 'bg-yellow-500' : 'bg-muted-foreground'}`} />
                    <span className="text-foreground text-sm">{task.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{task.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {canAdmin(role) && (
          <div className="bg-accent rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Team Members</h2>
            <div className="space-y-2">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">{m.user.firstName?.[0]}{m.user.lastName?.[0]}</div>
                    <div><p className="text-foreground text-sm">{m.user.firstName} {m.user.lastName}</p><p className="text-muted-foreground text-xs">{m.user.email}</p></div>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {role === 'VIEWER' && (
        <div className="mt-6 p-4 bg-accent border border-border rounded-2xl">
          <p className="text-muted-foreground text-sm">🔒 Read-only access. Contact an admin to upgrade your role.</p>
        </div>
      )}

      {canEdit(role) && (
        <div className="mt-6 flex gap-3">
          <Link href="/projects" className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all">Go to Projects</Link>
          <Link href="/tasks" className="px-5 py-2.5 bg-accent border border-border text-foreground text-sm font-medium rounded-xl hover:bg-accent/80 transition-all">View My Tasks</Link>
        </div>
      )}
    </div>
  );
}
