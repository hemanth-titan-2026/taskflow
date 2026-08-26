"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { canOwner } from '@/components/RoleBadge';

export default function SettingsPage() {
  const { currentOrg } = useAuth();
  const router = useRouter();
  const role = currentOrg?.role || 'VIEWER';
  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!canOwner(role)) { router.push('/'); return; }
  }, [role, router]);

  useEffect(() => { setOrgName(currentOrg?.name || ''); }, [currentOrg]);

  async function updateOrg(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setSaved(false);
    try {
      await api.patch(`/organizations/${currentOrg?.slug}`, { name: orgName });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  if (!canOwner(role)) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Organization Settings</h1>
      <p className="text-gray-400 mb-8">Only the organization owner can access these settings.</p>

      {/* Org Settings */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">General</h2>
        <form onSubmit={updateOrg} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Organization Name</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span className="text-green-400 text-sm">Saved!</span>}
          </div>
        </form>
      </div>

      {/* Plan Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Billing & Plan</h2>
        <div className="flex items-center gap-4 p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
          <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">PRO</div>
          <div>
            <p className="text-white font-medium">Pro Plan</p>
            <p className="text-gray-400 text-sm">Unlimited projects, 50 members, priority support</p>
          </div>
          <button className="ml-auto px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg">Manage Billing</button>
        </div>
      </div>

      {/* Danger Zone - Owner only */}
      <div className="bg-gray-800 rounded-xl border border-red-900/50 p-6">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
            <div>
              <p className="text-white text-sm font-medium">Transfer Ownership</p>
              <p className="text-gray-400 text-xs">Transfer this org to another admin</p>
            </div>
            <button className="px-4 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 text-sm rounded-lg transition-colors">Transfer</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-red-900/10 border border-red-900/30 rounded-lg">
            <div>
              <p className="text-white text-sm font-medium">Delete Organization</p>
              <p className="text-gray-400 text-xs">Permanently delete this org and all data</p>
            </div>
            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">Delete Org</button>
          </div>
        </div>
      </div>
    </div>
  );
}
