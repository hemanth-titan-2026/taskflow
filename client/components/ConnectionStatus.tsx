"use client";
import { useRealtime } from './RealtimeProvider';

export default function ConnectionStatus() {
  const { connected } = useRealtime();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}
