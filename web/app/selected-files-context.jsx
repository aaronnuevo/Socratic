"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SelectedFilesContext = createContext(null);

export function SelectedFilesProvider({ children }) {
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [activePath, setActivePath] = useState(null);

  // Load on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('socratic:selectedPaths');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setSelectedPaths(parsed);
      }
      const savedActive = localStorage.getItem('socratic:activePath');
      if (savedActive) setActivePath(savedActive);
    } catch {}
  }, []);

  // Persist when changed
  useEffect(() => {
    try {
      localStorage.setItem('socratic:selectedPaths', JSON.stringify(selectedPaths));
    } catch {}
  }, [selectedPaths]);

  useEffect(() => {
    try {
      if (activePath) localStorage.setItem('socratic:activePath', activePath);
      else localStorage.removeItem('socratic:activePath');
    } catch {}
  }, [activePath]);

  const value = useMemo(() => ({ selectedPaths, setSelectedPaths, activePath, setActivePath }), [selectedPaths, activePath]);

  return (
    <SelectedFilesContext.Provider value={value}>{children}</SelectedFilesContext.Provider>
  );
}

export function useSelectedFiles() {
  const ctx = useContext(SelectedFilesContext);
  if (!ctx) throw new Error('useSelectedFiles must be used within SelectedFilesProvider');
  return ctx;
}


