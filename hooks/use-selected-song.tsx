import { ParsedSong } from '@/services/chordpro-types';
import React, { createContext, useCallback, useContext, useState } from 'react';

interface SelectedSongContextType {
  selectedSong: ParsedSong | null;
  songContent: string | null;
  songFilename: string | null;
  selectSong: (song: ParsedSong, content: string, filename: string) => void;
  updateSong: (song: ParsedSong, content: string) => void;
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
  const [songFilename, setSongFilename] = useState<string | null>(null);

  const selectSong = useCallback((song: ParsedSong, content: string, filename: string) => {
    setSelectedSong(song);
    setSongContent(content);
    setSongFilename(filename);
  }, []);

  const updateSong = useCallback((song: ParsedSong, content: string) => {
    setSelectedSong(song);
    setSongContent(content);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSong(null);
    setSongContent(null);
    setSongFilename(null);
  }, []);

  return (
    <SelectedSongContext.Provider
      value={{ selectedSong, songContent, songFilename, selectSong, updateSong, clearSelection }}
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
