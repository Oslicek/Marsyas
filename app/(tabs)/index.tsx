import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useSongStorage } from '@/hooks/use-song-storage';

export default function TabOneScreen() {
  const { songs, isLoading, isInitialized, error, initResult } = useSongStorage();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Initializing song storage...</Text>
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
          <View style={styles.songItem}>
            <Text style={styles.songTitle}>
              {item.filename.replace('.pro', '')}
            </Text>
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
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
  },
  list: {
    width: '100%',
    paddingHorizontal: 20,
  },
  songItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  songTitle: {
    fontSize: 16,
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
