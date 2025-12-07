import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useSelectedSong } from '@/hooks/use-selected-song';
import { useSongStorage } from '@/hooks/use-song-storage';
import { parseChordPro } from '@/services/chordpro-parser';
import { createSongStorageService } from '@/services/song-storage-runtime';
import { SongFile } from '@/services/types';

export default function SongsScreen() {
  const { songs, isLoading, error, initResult } = useSongStorage();
  const { selectSong } = useSelectedSong();
  const router = useRouter();

  const handleSongPress = async (songFile: SongFile) => {
    try {
      // Load song content
      const service = createSongStorageService();
      const content = await service.fileSystem.readFile(songFile.path);
      
      // Parse the song
      const parsedSong = parseChordPro(content);
      
      // Select and navigate
      selectSong(parsedSong, content);
      router.push('/two');
    } catch (err) {
      console.error('Failed to load song:', err);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading songs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Marsyas Songbook</Text>
      
      {initResult && initResult.syncedFiles.length > 0 && (
        <Text style={styles.syncInfo}>
          Synced {initResult.syncedFiles.length} new song(s)
        </Text>
      )}
      
      <Text style={styles.subtitle}>
        {songs.length} song{songs.length !== 1 ? 's' : ''} in library
      </Text>
      
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <FlatList
        style={styles.list}
        data={songs}
        keyExtractor={(item) => item.filename}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.songItem,
              pressed && styles.songItemPressed,
            ]}
            onPress={() => handleSongPress(item)}
          >
            <Text style={styles.songTitle}>
              {item.filename.replace('.pro', '')}
            </Text>
            <Text style={styles.songArrow}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No songs in library</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  syncInfo: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 4,
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
  },
  list: {
    width: '100%',
    paddingHorizontal: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    backgroundColor: 'transparent',
  },
  songItemPressed: {
    opacity: 0.6,
  },
  songTitle: {
    fontSize: 16,
    flex: 1,
  },
  songArrow: {
    fontSize: 24,
    opacity: 0.4,
    marginLeft: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    opacity: 0.7,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.5,
    marginTop: 20,
  },
});
