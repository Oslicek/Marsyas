/**
 * Song file metadata (without parsed content)
 */
export interface SongFile {
  filename: string;
  path: string;
}

/**
 * Result of storage initialization
 */
export interface StorageInitResult {
  syncedFiles: string[];
  totalFiles: number;
}


