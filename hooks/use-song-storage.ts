import { useState, useEffect, useCallback } from 'react';
import { createSongStorageService } from '../services/song-storage-runtime';
import { SongFile, StorageInitResult } from '../services/types';

interface UseSongStorageResult {
  songs: SongFile[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initResult: StorageInitResult | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing song storage initialization and listing
 * Automatically initializes storage on mount and loads song list
 */
export function useSongStorage(): UseSongStorageResult {
  const [songs, setSongs] = useState<SongFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initResult, setInitResult] = useState<StorageInitResult | null>(null);

  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const service = createSongStorageService();
      
      // Initialize storage (sync bundled assets)
      const result = await service.initializeStorage();
      setInitResult(result);
      setIsInitialized(true);

      // Load song list
      const songFiles = await service.listSongFiles();
      setSongs(songFiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Failed to initialize song storage:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const service = createSongStorageService();
      const songFiles = await service.listSongFiles();
      setSongs(songFiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    songs,
    isLoading,
    isInitialized,
    error,
    initResult,
    refresh,
  };
}


