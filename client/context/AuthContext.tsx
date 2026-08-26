"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string; email: string; firstName: string; lastName: string; avatarUrl?: string;
}
interface Organization {
  id: string; name: string; slug: string; role: string;
}
interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
  setCurrentOrg: (org: Organization) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) fetchUser();
    else setLoading(false);
  }, []);

  async function fetchUser() {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data.user);
      const orgs = res.data.data.organizations;
      setOrganizations(orgs);
      const saved = localStorage.getItem('currentOrg');
      const match = orgs.find((o: Organization) => o.slug === saved);
      if (match) setCurrentOrgState(match);
      else if (orgs.length > 0) { setCurrentOrgState(orgs[0]); localStorage.setItem('currentOrg', orgs[0].slug); }
    } catch {
      localStorage.removeItem('accessToken');
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    await fetchUser();
  }

  async function register(data: { email: string; password: string; firstName: string; lastName: string }) {
    const res = await api.post('/auth/register', data);
    const { accessToken, refreshToken } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    await fetchUser();
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('currentOrg');
    setUser(null);
    setOrganizations([]);
    setCurrentOrgState(null);
  }

  function setCurrentOrg(org: Organization) {
    setCurrentOrgState(org);
    localStorage.setItem('currentOrg', org.slug);
  }

  return (
    <AuthContext.Provider value={{ user, organizations, currentOrg, loading, login, register, logout, setCurrentOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
