"use client";

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SelectedFilesContext = createContext(null);

export function SelectedFilesProvider({ children }) {
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [activePath, setActivePath] = useState(null);

  // Load on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        // Get current project root
        const dirResponse = await fetch('/api/dir');
        const dirData = await dirResponse.json();
        const currentProjectRoot = dirData.cwd;
        
        // Check if saved data is from the same project
        const savedProjectRoot = localStorage.getItem('socratic:selectedFiles:projectRoot');
        
        // If project changed, clear all cached data
        if (savedProjectRoot && savedProjectRoot !== currentProjectRoot) {
          console.log('Project changed, clearing selected files cache');
          localStorage.removeItem('socratic:selectedPaths');
          localStorage.removeItem('socratic:activePath');
          localStorage.removeItem('socratic:selectedFiles:projectRoot');
        } else {
          // Load saved state if project is the same
          const saved = localStorage.getItem('socratic:selectedPaths');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setSelectedPaths(parsed);
          }
          const savedActive = localStorage.getItem('socratic:activePath');
          if (savedActive) setActivePath(savedActive);
        }
        
        // Store current project root
        localStorage.setItem('socratic:selectedFiles:projectRoot', currentProjectRoot);
      } catch (err) {
        console.log('Error loading selected files state:', err);
      }
    };
    
    loadState();
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


