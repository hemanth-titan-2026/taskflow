"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Load theme for current org
    const currentOrg = localStorage.getItem('currentOrg') || 'default';
    const saved = localStorage.getItem(`theme_${currentOrg}`) as Theme | null;
    if (saved) setTheme(saved);
    else setTheme('dark');
  }, []);

  // Listen for org changes
  useEffect(() => {
    function handleStorage() {
      const currentOrg = localStorage.getItem('currentOrg') || 'default';
      const saved = localStorage.getItem(`theme_${currentOrg}`) as Theme | null;
      if (saved) setTheme(saved);
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  function toggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const currentOrg = localStorage.getItem('currentOrg') || 'default';
    localStorage.setItem(`theme_${currentOrg}`, newTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Call this when switching orgs to load that org's theme.
 * If the org has no saved theme, it flips to the opposite of current.
 */
export function switchOrgTheme(orgSlug: string, currentTheme: Theme) {
  const saved = localStorage.getItem(`theme_${orgSlug}`) as Theme | null;
  if (saved) return saved;
  // No saved theme for this org — use opposite
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(`theme_${orgSlug}`, newTheme);
  return newTheme;
}
