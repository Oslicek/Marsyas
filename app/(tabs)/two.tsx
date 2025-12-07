import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { SongEditor } from '@/components/SongEditor';
import { SongView } from '@/components/SongView';
import { Text, View } from '@/components/Themed';
import { useSelectedSong } from '@/hooks/use-selected-song';
import { parseChordPro } from '@/services/chordpro-parser';
import { createSongStorageService } from '@/services/song-storage-runtime';

export default function SongScreen() {
  const { selectedSong, songContent, songFilename, updateSong } = useSelectedSong();
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async (newContent: string) => {
    if (!songFilename) return;

    try {
      // Save to storage
      const service = createSongStorageService();
      await service.saveSong(songFilename, newContent);

      // Re-parse and update context
      const parsedSong = parseChordPro(newContent);
      updateSong(parsedSong, newContent);

      // Exit edit mode
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save song:', err);
    }
  }, [songFilename, updateSong]);

  if (!selectedSong || !songContent) {
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

  if (isEditing) {
    return (
      <SongEditor
        content={songContent}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Edit button */}
      <View style={styles.toolbar}>
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.editButtonPressed,
          ]}
          onPress={handleEdit}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      {/* Song view */}
      <SongView song={selectedSong} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  editButtonPressed: {
    opacity: 0.6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
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
