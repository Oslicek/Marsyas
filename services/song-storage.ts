import { SongFile, StorageInitResult } from './types';

/**
 * Adapter interface for file system operations
 * Allows mocking in tests
 */
export interface FileSystemAdapter {
  songsDirectory: string;
  ensureDirectoryExists(path: string): Promise<void>;
  listFiles(directory: string): Promise<string[]>;
  fileExists(path: string): Promise<boolean>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
}

/**
 * Adapter interface for accessing bundled assets
 * Allows mocking in tests
 */
export interface BundledAssetsAdapter {
  getBundledSongFiles(): Promise<{ filename: string; content: string }[]>;
}

/**
 * Service for managing song file storage
 * Handles syncing bundled assets to file system and listing songs
 */
export class SongStorageService {
  private fileSystem: FileSystemAdapter;
  private bundledAssets: BundledAssetsAdapter;

  constructor(
    fileSystem: FileSystemAdapter,
    bundledAssets: BundledAssetsAdapter
  ) {
    this.fileSystem = fileSystem;
    this.bundledAssets = bundledAssets;
  }

  /**
   * Initialize storage by syncing bundled assets to file system
   * Only copies files that don't already exist in file system
   */
  async initializeStorage(): Promise<StorageInitResult> {
    await this.fileSystem.ensureDirectoryExists(this.fileSystem.songsDirectory);

    const bundledFiles = await this.bundledAssets.getBundledSongFiles();
    const syncedFiles: string[] = [];

    for (const bundledFile of bundledFiles) {
      const targetPath = this.fileSystem.songsDirectory + bundledFile.filename;
      const exists = await this.fileSystem.fileExists(targetPath);

      if (!exists) {
        await this.fileSystem.writeFile(targetPath, bundledFile.content);
        syncedFiles.push(bundledFile.filename);
      }
    }

    const allFiles = await this.fileSystem.listFiles(
      this.fileSystem.songsDirectory
    );
    const proFiles = allFiles.filter((f) => f.endsWith('.pro'));

    return {
      syncedFiles,
      totalFiles: proFiles.length,
    };
  }

  /**
   * List all song files from file system storage
   */
  async listSongFiles(): Promise<SongFile[]> {
    const files = await this.fileSystem.listFiles(
      this.fileSystem.songsDirectory
    );

    return files
      .filter((filename) => filename.endsWith('.pro'))
      .map((filename) => ({
        filename,
        path: this.fileSystem.songsDirectory + filename,
      }));
  }
}


