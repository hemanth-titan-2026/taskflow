"use client";
import api from './api';

const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function startSessionMonitor() {
  if (refreshTimer) return;
  refreshTimer = setInterval(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) { stopSessionMonitor(); return; }
    try {
      const res = await api.post('/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', res.data.data.accessToken);
      localStorage.setItem('refreshToken', res.data.data.refreshToken);
    } catch {
      // Token expired, force logout
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentOrg');
      window.location.href = '/login';
    }
  }, TOKEN_REFRESH_INTERVAL);
}

export function stopSessionMonitor() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

export function getTokenExpiry(): Date | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return new Date(payload.exp * 1000);
  } catch { return null; }
}

export function isSessionValid(): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return false;
  return expiry.getTime() > Date.now();
}
