import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useSelectedSong } from '@/hooks/use-selected-song';
import { useSongStorage } from '@/hooks/use-song-storage';
import { parseChordPro } from '@/services/chordpro-parser';
import { createSongStorageService } from '@/services/song-storage-runtime';
import { SongFile } from '@/services/types';

// Template for new songs
const NEW_SONG_TEMPLATE = `{title: New Song}
{artist: }

[C] 
`;

export default function SongsScreen() {
  const { songs, isLoading, error, initResult, refresh } = useSongStorage();
  const { selectSong, selectNewSong, songFilename, clearSelection } = useSelectedSong();
  const router = useRouter();

  // Refresh song list when tab becomes focused (catches renames from Tab 2)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleSongPress = async (songFile: SongFile) => {
    try {
      // Load song content
      const service = createSongStorageService();
      const content = await service.fileSystem.readFile(songFile.path);
      
      // Parse the song
      const parsedSong = parseChordPro(content);
      
      // Select and navigate (include filename for saving)
      selectSong(parsedSong, content, songFile.filename);
      router.push('/two');
    } catch (err) {
      console.error('Failed to load song:', err);
    }
  };

  const handleNewSong = async () => {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `New Song ${timestamp}.pro`;
      
      // Save new song to storage
      const service = createSongStorageService();
      await service.saveSong(filename, NEW_SONG_TEMPLATE);
      
      // Parse and select as new song (will open in edit mode)
      const parsedSong = parseChordPro(NEW_SONG_TEMPLATE);
      selectNewSong(parsedSong, NEW_SONG_TEMPLATE, filename);
      
      // Refresh song list
      refresh();
      
      // Navigate to Song tab
      router.push('/two');
    } catch (err) {
      console.error('Failed to create new song:', err);
    }
  };

  const handleDeleteSong = (songFile: SongFile) => {
    const songName = songFile.filename.replace('.pro', '');
    
    Alert.alert(
      'Delete Song',
      `Are you sure you want to delete "${songName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const service = createSongStorageService();
              await service.deleteSong(songFile.filename);
              
              // Clear selection if deleted song was selected
              if (songFilename === songFile.filename) {
                clearSelection();
              }
              
              // Refresh the list
              refresh();
            } catch (err) {
              console.error('Failed to delete song:', err);
            }
          },
        },
      ]
    );
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

      {/* New Song button */}
      <Pressable
        style={({ pressed }) => [
          styles.newSongButton,
          pressed && styles.newSongButtonPressed,
        ]}
        onPress={handleNewSong}
      >
        <Text style={styles.newSongButtonText}>+ New Song</Text>
      </Pressable>
      
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <FlatList
        style={styles.list}
        data={songs}
        keyExtractor={(item) => item.filename}
        renderItem={({ item }) => (
          <View style={styles.songRow}>
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
            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
              onPress={() => handleDeleteSong(item)}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </Pressable>
          </View>
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
  newSongButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  newSongButtonPressed: {
    opacity: 0.7,
  },
  newSongButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  songItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
  deleteButton: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonPressed: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
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
