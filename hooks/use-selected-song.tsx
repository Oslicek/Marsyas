import { ParsedSong } from '@/services/chordpro-types';
import React, { createContext, useCallback, useContext, useState } from 'react';

interface SelectedSongContextType {
  selectedSong: ParsedSong | null;
  songContent: string | null;
  songFilename: string | null;
  isNewSong: boolean;
  selectSong: (song: ParsedSong, content: string, filename: string) => void;
  selectNewSong: (song: ParsedSong, content: string, filename: string) => void;
  updateSong: (song: ParsedSong, content: string, filename?: string) => void;
  clearSelection: () => void;
  clearNewSongFlag: () => void;
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
  const [isNewSong, setIsNewSong] = useState(false);

  const selectSong = useCallback((song: ParsedSong, content: string, filename: string) => {
    setSelectedSong(song);
    setSongContent(content);
    setSongFilename(filename);
    setIsNewSong(false);
  }, []);

  const selectNewSong = useCallback((song: ParsedSong, content: string, filename: string) => {
    setSelectedSong(song);
    setSongContent(content);
    setSongFilename(filename);
    setIsNewSong(true);
  }, []);

  const updateSong = useCallback((song: ParsedSong, content: string, filename?: string) => {
    setSelectedSong(song);
    setSongContent(content);
    if (filename) {
      setSongFilename(filename);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSong(null);
    setSongContent(null);
    setSongFilename(null);
    setIsNewSong(false);
  }, []);

  const clearNewSongFlag = useCallback(() => {
    setIsNewSong(false);
  }, []);

  return (
    <SelectedSongContext.Provider
      value={{
        selectedSong,
        songContent,
        songFilename,
        isNewSong,
        selectSong,
        selectNewSong,
        updateSong,
        clearSelection,
        clearNewSongFlag,
      }}
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
