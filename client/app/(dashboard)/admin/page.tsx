"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canAdmin } from '@/components/RoleBadge';

export default function AdminPanel() {
  const { currentOrg } = useAuth();
  const router = useRouter();
  const role = currentOrg?.role || 'VIEWER';
  const [stats, setStats] = useState({ members: 0, projects: 0, webhooks: 0, tasks: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAdmin(role)) { router.push('/'); return; }
    loadData();
  }, [role, router]);

  async function loadData() {
    try {
      const [mRes, pRes, wRes, tRes] = await Promise.all([
        api.get(`/organizations/${currentOrg?.id}/members`),
        api.get('/projects'),
        api.get('/webhooks').catch(() => ({ data: { data: [] } })),
        api.get('/tasks?perPage=1'),
      ]);
      setStats({ members: mRes.data.data.length, projects: pRes.data.data.length, webhooks: wRes.data.data.length, tasks: tRes.data.meta?.total || 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  if (!canAdmin(role)) return null;
  if (loading) return <div className="p-8 text-gray-400">Loading admin panel...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
      <p className="text-gray-400 mb-8">Manage your organization, members, and integrations.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/members" className="p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-purple-600/50 transition-colors">
          <p className="text-lg mb-1">👥</p>
          <p className="text-2xl font-bold text-white">{stats.members}</p>
          <p className="text-sm text-gray-400 mt-1">Members</p>
        </Link>
        <Link href="/projects" className="p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-600/50 transition-colors">
          <p className="text-lg mb-1">📁</p>
          <p className="text-2xl font-bold text-white">{stats.projects}</p>
          <p className="text-sm text-gray-400 mt-1">Projects</p>
        </Link>
        <Link href="/admin/webhooks" className="p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-green-600/50 transition-colors">
          <p className="text-lg mb-1">🔗</p>
          <p className="text-2xl font-bold text-white">{stats.webhooks}</p>
          <p className="text-sm text-gray-400 mt-1">Webhooks</p>
        </Link>
        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-lg mb-1">✅</p>
          <p className="text-2xl font-bold text-white">{stats.tasks}</p>
          <p className="text-sm text-gray-400 mt-1">Total Tasks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/admin/members" className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <span>👥</span>
              <div><p className="text-white text-sm font-medium">Manage Members</p><p className="text-gray-400 text-xs">Invite, remove, or change roles</p></div>
            </Link>
            <Link href="/admin/webhooks" className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <span>🔗</span>
              <div><p className="text-white text-sm font-medium">Manage Webhooks</p><p className="text-gray-400 text-xs">Configure event integrations</p></div>
            </Link>
            <Link href="/projects" className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <span>📁</span>
              <div><p className="text-white text-sm font-medium">Create Project</p><p className="text-gray-400 text-xs">Start a new project for your team</p></div>
            </Link>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Organization Info</h2>
          <div className="space-y-3">
            <InfoRow label="Name" value={currentOrg?.name || ''} />
            <InfoRow label="Slug" value={currentOrg?.slug || ''} mono />
            <InfoRow label="Your Role" value={role} />
            <InfoRow label="Plan" value="PRO" purple />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, purple }: { label: string; value: string; mono?: boolean; purple?: boolean }) {
  return (
    <div className="flex justify-between p-3 bg-gray-700/50 rounded-lg">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${purple ? 'text-purple-400' : 'text-white'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
