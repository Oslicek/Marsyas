import {
  BundledAssetsAdapter,
  FileSystemAdapter,
  SongStorageService,
} from '../song-storage';

/**
 * Mock implementation of FileSystemAdapter for testing
 */
class MockFileSystemAdapter implements FileSystemAdapter {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();
  public songsDirectory = 'mock://documents/songs/';
  public ensureDirectoryExistsCalls: string[] = [];

  async ensureDirectoryExists(path: string): Promise<void> {
    this.ensureDirectoryExistsCalls.push(path);
    // Simulate real behavior: only create if not exists
    if (!this.directories.has(path)) {
      this.directories.add(path);
    }
  }

  directoryExists(path: string): boolean {
    return this.directories.has(path);
  }

  _setDirectoryExists(path: string): void {
    this.directories.add(path);
  }

  async listFiles(directory: string): Promise<string[]> {
    const filesInDir: string[] = [];
    for (const [filePath] of this.files) {
      if (filePath.startsWith(directory)) {
        const filename = filePath.replace(directory, '');
        if (!filename.includes('/')) {
          filesInDir.push(filename);
        }
      }
    }
    return filesInDir;
  }

  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  // Test helpers
  _setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  _getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  _clear(): void {
    this.files.clear();
  }
}

/**
 * Mock implementation of BundledAssetsAdapter for testing
 */
class MockBundledAssetsAdapter implements BundledAssetsAdapter {
  private assets: Map<string, string> = new Map();

  async getBundledSongFiles(): Promise<{ filename: string; content: string }[]> {
    const result: { filename: string; content: string }[] = [];
    for (const [filename, content] of this.assets) {
      result.push({ filename, content });
    }
    return result;
  }

  // Test helpers
  _addAsset(filename: string, content: string): void {
    this.assets.set(filename, content);
  }

  _clear(): void {
    this.assets.clear();
  }
}

describe('SongStorageService', () => {
  let fileSystem: MockFileSystemAdapter;
  let bundledAssets: MockBundledAssetsAdapter;
  let service: SongStorageService;

  beforeEach(() => {
    fileSystem = new MockFileSystemAdapter();
    bundledAssets = new MockBundledAssetsAdapter();
    service = new SongStorageService(fileSystem, bundledAssets);
  });

  describe('initializeStorage', () => {
    it('should create songs directory if it does not exist', async () => {
      const result = await service.initializeStorage();

      expect(result).toBeDefined();
      expect(result.totalFiles).toBe(0);
      expect(result.syncedFiles).toEqual([]);
    });

    it('should copy bundled song to file system when file system is empty', async () => {
      const songContent = '{title: Test Song}\n[C]Hello [G]World';
      bundledAssets._addAsset('Test Song.pro', songContent);

      const result = await service.initializeStorage();

      expect(result.syncedFiles).toEqual(['Test Song.pro']);
      expect(result.totalFiles).toBe(1);
      
      const copiedContent = fileSystem._getFile(
        fileSystem.songsDirectory + 'Test Song.pro'
      );
      expect(copiedContent).toBe(songContent);
    });

    it('should copy multiple bundled songs to file system', async () => {
      bundledAssets._addAsset('Song1.pro', '{title: Song 1}');
      bundledAssets._addAsset('Song2.pro', '{title: Song 2}');
      bundledAssets._addAsset('Song3.pro', '{title: Song 3}');

      const result = await service.initializeStorage();

      expect(result.syncedFiles).toHaveLength(3);
      expect(result.totalFiles).toBe(3);
    });

    it('should not overwrite existing files in file system', async () => {
      const originalContent = '{title: Original}';
      const bundledContent = '{title: Bundled}';
      
      fileSystem._setFile(
        fileSystem.songsDirectory + 'Song.pro',
        originalContent
      );
      bundledAssets._addAsset('Song.pro', bundledContent);

      const result = await service.initializeStorage();

      expect(result.syncedFiles).toEqual([]);
      expect(result.totalFiles).toBe(1);
      
      const fileContent = fileSystem._getFile(
        fileSystem.songsDirectory + 'Song.pro'
      );
      expect(fileContent).toBe(originalContent);
    });

    it('should only copy missing files', async () => {
      fileSystem._setFile(
        fileSystem.songsDirectory + 'Existing.pro',
        '{title: Existing}'
      );
      bundledAssets._addAsset('Existing.pro', '{title: Existing Bundled}');
      bundledAssets._addAsset('New.pro', '{title: New}');

      const result = await service.initializeStorage();

      expect(result.syncedFiles).toEqual(['New.pro']);
      expect(result.totalFiles).toBe(2);
    });

    it('should not fail when songs directory already exists', async () => {
      // Pre-create the directory
      fileSystem._setDirectoryExists(fileSystem.songsDirectory);
      fileSystem._setFile(
        fileSystem.songsDirectory + 'Existing.pro',
        '{title: Existing}'
      );

      // Should not throw
      const result = await service.initializeStorage();

      expect(result).toBeDefined();
      expect(result.totalFiles).toBe(1);
      // ensureDirectoryExists should still be called
      expect(fileSystem.ensureDirectoryExistsCalls).toContain(
        fileSystem.songsDirectory
      );
    });
  });

  describe('listSongFiles', () => {
    it('should return empty array when no songs exist', async () => {
      const songs = await service.listSongFiles();

      expect(songs).toEqual([]);
    });

    it('should return list of song files from file system', async () => {
      fileSystem._setFile(
        fileSystem.songsDirectory + 'Song1.pro',
        '{title: Song 1}'
      );
      fileSystem._setFile(
        fileSystem.songsDirectory + 'Song2.pro',
        '{title: Song 2}'
      );

      const songs = await service.listSongFiles();

      expect(songs).toHaveLength(2);
      expect(songs).toContainEqual({
        filename: 'Song1.pro',
        path: fileSystem.songsDirectory + 'Song1.pro',
      });
      expect(songs).toContainEqual({
        filename: 'Song2.pro',
        path: fileSystem.songsDirectory + 'Song2.pro',
      });
    });

    it('should only return .pro files', async () => {
      fileSystem._setFile(
        fileSystem.songsDirectory + 'Song.pro',
        '{title: Song}'
      );
      fileSystem._setFile(
        fileSystem.songsDirectory + 'readme.txt',
        'Some text'
      );

      const songs = await service.listSongFiles();

      expect(songs).toHaveLength(1);
      expect(songs[0].filename).toBe('Song.pro');
    });
  });
});

