"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import RoleBadge, { canAdmin, canOwner } from '@/components/RoleBadge';

export default function MembersPage() {
  const { currentOrg, user } = useAuth();
  const router = useRouter();
  const role = currentOrg?.role || 'VIEWER';
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    if (!canAdmin(role)) { router.push('/'); return; }
    loadMembers();
  }, [role, router]);

  async function loadMembers() {
    try {
      const res = await api.get(`/organizations/${currentOrg?.id}/members`);
      setMembers(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(''); setInviteSuccess('');
    try {
      await api.post(`/organizations/${currentOrg?.slug}/invite`, { email: inviteEmail, role: inviteRole });
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      loadMembers();
    } catch (err: any) {
      setInviteError(err.response?.data?.error?.message || 'Failed to invite');
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    try {
      await api.delete(`/organizations/${currentOrg?.slug}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.user.id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to remove member');
    }
  }

  if (!canAdmin(role)) return null;
  if (loading) return <div className="p-8 text-gray-400">Loading members...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Team Members</h1>
      <p className="text-gray-400 mb-8">{members.length} members in {currentOrg?.name}</p>

      {/* Invite Form */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Invite New Member</h2>
        {inviteError && <p className="text-red-400 text-sm mb-3">{inviteError}</p>}
        {inviteSuccess && <p className="text-green-400 text-sm mb-3">{inviteSuccess}</p>}
        <form onSubmit={inviteMember} className="flex gap-3">
          <input type="email" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="VIEWER">Viewer</option>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">Invite</button>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 border-b border-gray-700 text-xs font-semibold text-gray-500 uppercase">
          <span>User</span>
          <span>Role</span>
          <span>Actions</span>
        </div>
        {members.map((m) => (
          <div key={m.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-4 border-b border-gray-700/50 hover:bg-gray-700/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {m.user.firstName?.[0]}{m.user.lastName?.[0]}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{m.user.firstName} {m.user.lastName}</p>
                <p className="text-gray-400 text-xs">{m.user.email}</p>
              </div>
            </div>
            <RoleBadge role={m.role} />
            <div>
              {m.user.id !== user?.id && m.role !== 'OWNER' && canOwner(role) && (
                <button onClick={() => removeMember(m.user.id, `${m.user.firstName} ${m.user.lastName}`)}
                  className="px-3 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors">
                  Remove
                </button>
              )}
              {m.role === 'OWNER' && <span className="text-xs text-gray-500">—</span>}
              {m.user.id === user?.id && m.role !== 'OWNER' && <span className="text-xs text-gray-500">You</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
