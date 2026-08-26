"use client";
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (!token) throw new Error('No token for WebSocket');

  socket = io('http://localhost:3000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => console.log('[WS] Connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('[WS] Disconnected:', reason));
  socket.on('connect_error', (err) => console.log('[WS] Error:', err.message));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) { socket.disconnect(); socket = null; }
}

export function joinOrg(orgId: string) {
  socket?.emit('join:organization', orgId);
}

export function joinProject(projectId: string) {
  socket?.emit('join:project', projectId);
}

export function leaveProject(projectId: string) {
  socket?.emit('leave:project', projectId);
}
