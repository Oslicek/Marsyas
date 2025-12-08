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

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
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

  describe('saveSong', () => {
    it('should save song content to file system', async () => {
      const filename = 'Test Song.pro';
      const content = '{title: Test Song}\n[C]Hello [G]World';

      await service.saveSong(filename, content);

      const savedContent = fileSystem._getFile(
        fileSystem.songsDirectory + filename
      );
      expect(savedContent).toBe(content);
    });

    it('should overwrite existing song content', async () => {
      const filename = 'Test Song.pro';
      const originalContent = '{title: Original}';
      const updatedContent = '{title: Updated}\n[Am]New lyrics';

      fileSystem._setFile(fileSystem.songsDirectory + filename, originalContent);

      await service.saveSong(filename, updatedContent);

      const savedContent = fileSystem._getFile(
        fileSystem.songsDirectory + filename
      );
      expect(savedContent).toBe(updatedContent);
    });

    it('should create file if it does not exist', async () => {
      const filename = 'New Song.pro';
      const content = '{title: New Song}';

      const existsBefore = await fileSystem.fileExists(
        fileSystem.songsDirectory + filename
      );
      expect(existsBefore).toBe(false);

      await service.saveSong(filename, content);

      const existsAfter = await fileSystem.fileExists(
        fileSystem.songsDirectory + filename
      );
      expect(existsAfter).toBe(true);
    });
  });

  describe('readSong', () => {
    it('should read song content from file system', async () => {
      const filename = 'Test Song.pro';
      const content = '{title: Test Song}\n[C]Hello [G]World';
      fileSystem._setFile(fileSystem.songsDirectory + filename, content);

      const result = await service.readSong(filename);

      expect(result).toBe(content);
    });

    it('should throw error if song does not exist', async () => {
      await expect(service.readSong('NonExistent.pro')).rejects.toThrow();
    });
  });

  describe('deleteSong', () => {
    it('should delete song from file system', async () => {
      const filename = 'Test Song.pro';
      fileSystem._setFile(fileSystem.songsDirectory + filename, '{title: Test}');

      await service.deleteSong(filename);

      const exists = await fileSystem.fileExists(fileSystem.songsDirectory + filename);
      expect(exists).toBe(false);
    });
  });

  describe('extractTitle', () => {
    it('should extract title from ChordPro content', () => {
      const content = '{title: My Song}\n[C]Hello';
      expect(service.extractTitle(content)).toBe('My Song');
    });

    it('should handle title with extra whitespace', () => {
      const content = '{title:   Spaced Title   }\n[C]Hello';
      expect(service.extractTitle(content)).toBe('Spaced Title');
    });

    it('should return null if no title found', () => {
      const content = '[C]Just chords';
      expect(service.extractTitle(content)).toBeNull();
    });

    it('should be case insensitive', () => {
      const content = '{TITLE: Uppercase}\n[C]Hello';
      expect(service.extractTitle(content)).toBe('Uppercase');
    });
  });

  describe('generateUniqueFilename', () => {
    it('should return base filename if not exists', async () => {
      const result = await service.generateUniqueFilename('New Song');
      expect(result).toBe('New Song.pro');
    });

    it('should add number suffix if filename exists', async () => {
      fileSystem._setFile(fileSystem.songsDirectory + 'My Song.pro', '{title: My Song}');

      const result = await service.generateUniqueFilename('My Song');
      expect(result).toBe('My Song 0001.pro');
    });

    it('should increment number for multiple duplicates', async () => {
      fileSystem._setFile(fileSystem.songsDirectory + 'Song.pro', '{title: Song}');
      fileSystem._setFile(fileSystem.songsDirectory + 'Song 0001.pro', '{title: Song}');
      fileSystem._setFile(fileSystem.songsDirectory + 'Song 0002.pro', '{title: Song}');

      const result = await service.generateUniqueFilename('Song');
      expect(result).toBe('Song 0003.pro');
    });

    it('should exclude current filename from check', async () => {
      fileSystem._setFile(fileSystem.songsDirectory + 'My Song.pro', '{title: My Song}');

      const result = await service.generateUniqueFilename('My Song', 'My Song.pro');
      expect(result).toBe('My Song.pro');
    });
  });

  describe('saveSongWithRename', () => {
    it('should save and rename based on title', async () => {
      const oldFilename = 'Old Name.pro';
      const content = '{title: New Title}\n[C]Hello';
      fileSystem._setFile(fileSystem.songsDirectory + oldFilename, '{title: Old Name}');

      const newFilename = await service.saveSongWithRename(oldFilename, content);

      expect(newFilename).toBe('New Title.pro');
      expect(fileSystem._getFile(fileSystem.songsDirectory + 'New Title.pro')).toBe(content);
      expect(await fileSystem.fileExists(fileSystem.songsDirectory + oldFilename)).toBe(false);
    });

    it('should not rename if title unchanged', async () => {
      const filename = 'Same Title.pro';
      const content = '{title: Same Title}\n[C]Hello';
      fileSystem._setFile(fileSystem.songsDirectory + filename, '{title: Same Title}\n[Am]Old');

      const newFilename = await service.saveSongWithRename(filename, content);

      expect(newFilename).toBe('Same Title.pro');
      expect(fileSystem._getFile(fileSystem.songsDirectory + filename)).toBe(content);
    });

    it('should add number if new title conflicts with existing', async () => {
      const oldFilename = 'Old.pro';
      const content = '{title: Existing}\n[C]Hello';
      fileSystem._setFile(fileSystem.songsDirectory + oldFilename, '{title: Old}');
      fileSystem._setFile(fileSystem.songsDirectory + 'Existing.pro', '{title: Existing}');

      const newFilename = await service.saveSongWithRename(oldFilename, content);

      expect(newFilename).toBe('Existing 0001.pro');
    });

    it('should use current filename if no title in content', async () => {
      const filename = 'No Title.pro';
      const content = '[C]Just chords';

      const newFilename = await service.saveSongWithRename(filename, content);

      expect(newFilename).toBe('No Title.pro');
    });
  });
});

