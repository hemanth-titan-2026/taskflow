"use client";

export default function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    OWNER: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30',
    ADMIN: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30',
    MEMBER: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30',
    VIEWER: 'bg-muted text-muted-foreground border border-border',
  };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${styles[role] || styles.VIEWER}`}>
      {role}
    </span>
  );
}

export function canEdit(role: string): boolean { return ['OWNER', 'ADMIN', 'MEMBER'].includes(role); }
export function canAdmin(role: string): boolean { return ['OWNER', 'ADMIN'].includes(role); }
export function canOwner(role: string): boolean { return role === 'OWNER'; }
