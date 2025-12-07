import { StyleSheet } from 'react-native';

import { SongView } from '@/components/SongView';
import { Text, View } from '@/components/Themed';
import { useSelectedSong } from '@/hooks/use-selected-song';

export default function SongScreen() {
  const { selectedSong } = useSelectedSong();

  if (!selectedSong) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🎵</Text>
        <Text style={styles.emptyText}>No song selected</Text>
        <Text style={styles.emptyHint}>
          Tap a song from the Songs tab to view it here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SongView song={selectedSong} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
