"use client";
import { useRealtime } from './RealtimeProvider';

export default function ToastContainer() {
  const { toasts, dismissToast } = useRealtime();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-80">
      {toasts.map(toast => (
        <div key={toast.id}
          className={`p-4 rounded-xl border shadow-lg animate-in slide-in-from-right-5 transition-all ${
            toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' :
            toast.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400' :
            'bg-background border-border text-foreground'
          }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.body && <p className="text-xs mt-0.5 opacity-70">{toast.body}</p>}
            </div>
            <button onClick={() => dismissToast(toast.id)} className="text-muted-foreground hover:text-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
