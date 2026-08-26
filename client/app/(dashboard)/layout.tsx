"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { useEffect } from 'react';
import { startSessionMonitor, stopSessionMonitor } from '@/lib/session';
import RoleBadge, { canAdmin } from '@/components/RoleBadge';
import AIChatbot from '@/components/AIChatbot';
import OrgSwitcher from '@/components/OrgSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import ToastContainer from '@/components/ToastContainer';
import ConnectionStatus from '@/components/ConnectionStatus';

function Sidebar() {
  const { user, currentOrg, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const role = currentOrg?.role || 'VIEWER';

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);
  useEffect(() => { if (user) startSessionMonitor(); return () => stopSessionMonitor(); }, [user]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return null;

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊', minRole: 'VIEWER' },
    { href: '/projects', label: 'Projects', icon: '📁', minRole: 'VIEWER' },
    { href: '/tasks', label: 'My Tasks', icon: '✅', minRole: 'MEMBER' },
    { href: '/notifications', label: 'Notifications', icon: '🔔', minRole: 'VIEWER' },
    { href: '/admin', label: 'Admin Panel', icon: '⚙️', minRole: 'ADMIN' },
    { href: '/admin/members', label: 'Members', icon: '👥', minRole: 'ADMIN' },
    { href: '/admin/webhooks', label: 'Webhooks', icon: '🔗', minRole: 'ADMIN' },
    { href: '/admin/settings', label: 'Settings', icon: '🛠️', minRole: 'OWNER' },
  ];

  const roleHierarchy: Record<string, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };
  const userLevel = roleHierarchy[role] ?? 0;
  const visibleNav = navItems.filter(item => userLevel >= (roleHierarchy[item.minRole] ?? 0));

  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col h-screen sticky top-0">
      {/* Org Switcher */}
      <div className="p-3 border-b border-border">
        <OrgSwitcher />
      </div>

      {/* Role badge + Connection */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <RoleBadge role={role} />
        <ConnectionStatus />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleNav.filter(i => !i.href.startsWith('/admin')).map((item) => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              pathname === item.href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}>
            <span>{item.icon}</span>{item.label}
          </Link>
        ))}
        {canAdmin(role) && (
          <>
            <div className="pt-5 pb-2"><p className="px-3 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Administration</p></div>
            {visibleNav.filter(i => i.href.startsWith('/admin')).map((item) => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  pathname === item.href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-3 space-y-1">
        <ThemeToggle />
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <button onClick={() => { stopSessionMonitor(); logout(); router.push('/login'); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RealtimeProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-auto">{children}</main>
            <AIChatbot />
            <ToastContainer />
          </div>
        </RealtimeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
