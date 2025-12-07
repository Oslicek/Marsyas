import { Asset } from 'expo-asset';
import { BundledAssetsAdapter, FileSystemAdapter } from './song-storage';

/**
 * Temporary in-memory implementation of FileSystemAdapter
 * TODO: Migrate to expo-file-system new API (File/Directory classes)
 */
export class ExpoFileSystemAdapter implements FileSystemAdapter {
  private memoryStorage: Map<string, string> = new Map();
  public songsDirectory = 'memory://songs/';

  async ensureDirectoryExists(path: string): Promise<void> {
    // No-op for memory storage
  }

  async listFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    for (const key of this.memoryStorage.keys()) {
      if (key.startsWith(this.songsDirectory)) {
        files.push(key.replace(this.songsDirectory, ''));
      }
    }
    return files;
  }

  async fileExists(path: string): Promise<boolean> {
    return this.memoryStorage.has(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.memoryStorage.set(path, content);
  }

  async readFile(path: string): Promise<string> {
    const content = this.memoryStorage.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
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
  return new SongStorageService(
    new ExpoFileSystemAdapter(),
    new ExpoBundledAssetsAdapter()
  );
}
