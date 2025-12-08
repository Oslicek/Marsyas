import { Asset } from 'expo-asset';
import { BundledAssetsAdapter, FileSystemAdapter } from './song-storage';

/**
 * Singleton memory storage - shared across all adapter instances
 */
const sharedMemoryStorage: Map<string, string> = new Map();

/**
 * Temporary in-memory implementation of FileSystemAdapter
 * Uses singleton storage to persist data across service instances
 * TODO: Migrate to expo-file-system new API (File/Directory classes)
 */
export class ExpoFileSystemAdapter implements FileSystemAdapter {
  public songsDirectory = 'memory://songs/';

  async ensureDirectoryExists(path: string): Promise<void> {
    // No-op for memory storage
  }

  async listFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    for (const key of sharedMemoryStorage.keys()) {
      if (key.startsWith(this.songsDirectory)) {
        files.push(key.replace(this.songsDirectory, ''));
      }
    }
    return files;
  }

  async fileExists(path: string): Promise<boolean> {
    return sharedMemoryStorage.has(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    sharedMemoryStorage.set(path, content);
  }

  async readFile(path: string): Promise<string> {
    const content = sharedMemoryStorage.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async deleteFile(path: string): Promise<void> {
    sharedMemoryStorage.delete(path);
  }
}

/**
 * Bundled song asset definition
 */
interface BundledSong {
  filename: string;
  asset: number;
}

/**
 * Registry of bundled songs
 */
const BUNDLED_SONGS: BundledSong[] = [
  {
    filename: 'Blowing In The Wind.pro',
    asset: require('../data/Blowing In The Wind.pro'),
  },
  {
    filename: "Knocking On Heaven's Door.pro",
    asset: require("../data/Knocking On Heaven's Door.pro"),
  },
  {
    filename: 'Kometa.pro',
    asset: require('../data/Kometa.pro'),
  },
];

/**
 * Runtime implementation of BundledAssetsAdapter using expo-asset
 */
export class ExpoBundledAssetsAdapter implements BundledAssetsAdapter {
  async getBundledSongFiles(): Promise<{ filename: string; content: string }[]> {
    const results: { filename: string; content: string }[] = [];

    for (const song of BUNDLED_SONGS) {
      try {
        const asset = Asset.fromModule(song.asset);
        await asset.downloadAsync();

        if (asset.localUri) {
          // Fetch the file content via HTTP since we can access localUri
          const response = await fetch(asset.localUri);
          const content = await response.text();
          results.push({ filename: song.filename, content });
        }
      } catch (error) {
        console.warn(`Failed to load bundled song: ${song.filename}`, error);
      }
    }

    return results;
  }
}

/**
 * Create a configured SongStorageService with runtime adapters
 */
export function createSongStorageService() {
  const { SongStorageService } = require('./song-storage');
  const fileSystem = new ExpoFileSystemAdapter();
  const service = new SongStorageService(
    fileSystem,
    new ExpoBundledAssetsAdapter()
  );
  // Expose fileSystem for direct file access
  return Object.assign(service, { fileSystem });
}
