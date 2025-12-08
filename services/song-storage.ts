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
  deleteFile(path: string): Promise<void>;
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

  /**
   * Save song content to file system
   */
  async saveSong(filename: string, content: string): Promise<void> {
    const path = this.fileSystem.songsDirectory + filename;
    await this.fileSystem.writeFile(path, content);
  }

  /**
   * Read song content from file system
   */
  async readSong(filename: string): Promise<string> {
    const path = this.fileSystem.songsDirectory + filename;
    return await this.fileSystem.readFile(path);
  }

  /**
   * Delete a song file
   */
  async deleteSong(filename: string): Promise<void> {
    const path = this.fileSystem.songsDirectory + filename;
    await this.fileSystem.deleteFile(path);
  }

  /**
   * Extract title from ChordPro content
   */
  extractTitle(content: string): string | null {
    const match = content.match(/\{title:\s*([^}]+)\}/i);
    return match ? match[1].trim() : null;
  }

  /**
   * Generate unique filename from title
   * If title already exists, adds " 0001", " 0002", etc.
   */
  async generateUniqueFilename(title: string, excludeFilename?: string): Promise<string> {
    const baseFilename = `${title}.pro`;
    const files = await this.listSongFiles();
    const existingNames = new Set(
      files
        .map((f) => f.filename)
        .filter((name) => name !== excludeFilename)
    );

    // If base filename doesn't exist, use it
    if (!existingNames.has(baseFilename)) {
      return baseFilename;
    }

    // Find next available number
    let counter = 1;
    while (counter < 10000) {
      const numberedFilename = `${title} ${counter.toString().padStart(4, '0')}.pro`;
      if (!existingNames.has(numberedFilename)) {
        return numberedFilename;
      }
      counter++;
    }

    throw new Error('Unable to generate unique filename');
  }

  /**
   * Save song with automatic renaming based on title
   * Returns the new filename
   */
  async saveSongWithRename(
    currentFilename: string,
    content: string
  ): Promise<string> {
    const newTitle = this.extractTitle(content);
    
    // If no title, just save with current filename
    if (!newTitle) {
      await this.saveSong(currentFilename, content);
      return currentFilename;
    }

    // Generate filename from title
    const newFilename = await this.generateUniqueFilename(newTitle, currentFilename);

    // Save the new file
    await this.saveSong(newFilename, content);

    // Delete old file if name changed
    if (newFilename !== currentFilename) {
      try {
        await this.deleteSong(currentFilename);
      } catch {
        // Old file might not exist (new song case)
      }
    }

    return newFilename;
  }
}


