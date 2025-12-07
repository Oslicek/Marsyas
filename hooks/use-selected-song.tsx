import React, { createContext, useContext, useState, useCallback } from 'react';
import { ParsedSong } from '@/services/chordpro-types';

interface SelectedSongContextType {
  selectedSong: ParsedSong | null;
  songContent: string | null;
  selectSong: (song: ParsedSong, content: string) => void;
  clearSelection: () => void;
}

const SelectedSongContext = createContext<SelectedSongContextType | undefined>(
  undefined
);

export function SelectedSongProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedSong, setSelectedSong] = useState<ParsedSong | null>(null);
  const [songContent, setSongContent] = useState<string | null>(null);

  const selectSong = useCallback((song: ParsedSong, content: string) => {
    setSelectedSong(song);
    setSongContent(content);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSong(null);
    setSongContent(null);
  }, []);

  return (
    <SelectedSongContext.Provider
      value={{ selectedSong, songContent, selectSong, clearSelection }}
    >
      {children}
    </SelectedSongContext.Provider>
  );
}

export function useSelectedSong() {
  const context = useContext(SelectedSongContext);
  if (context === undefined) {
    throw new Error('useSelectedSong must be used within a SelectedSongProvider');
  }
  return context;
}

