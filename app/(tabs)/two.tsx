import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { SongEditor } from '@/components/SongEditor';
import { SongView } from '@/components/SongView';
import { Text, View } from '@/components/Themed';
import { useSelectedSong } from '@/hooks/use-selected-song';
import { useSettings } from '@/hooks/use-settings';
import { parseChordPro } from '@/services/chordpro-parser';
import { createSongStorageService } from '@/services/song-storage-runtime';

export default function SongScreen() {
  const { selectedSong, songContent, songFilename, isNewSong, updateSong, clearNewSongFlag } = useSelectedSong();
  const { settings } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [transpose, setTranspose] = useState(0);

  // Auto-enter edit mode for new songs
  useEffect(() => {
    if (isNewSong) {
      setIsEditing(true);
      clearNewSongFlag();
    }
  }, [isNewSong, clearNewSongFlag]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async (newContent: string) => {
    if (!songFilename) return;

    try {
      // Save with automatic rename based on title
      const service = createSongStorageService();
      console.log('Saving song, current filename:', songFilename);
      const newFilename = await service.saveSongWithRename(songFilename, newContent);
      console.log('New filename after save:', newFilename);

      // Re-parse and update context (include new filename if changed)
      const parsedSong = parseChordPro(newContent);
      updateSong(parsedSong, newContent, newFilename);

      // Exit edit mode
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save song:', err);
    }
  }, [songFilename, updateSong]);

  const handleTransposeUp = useCallback(() => {
    setTranspose((prev) => (prev + 1) % 12);
  }, []);

  const handleTransposeDown = useCallback(() => {
    setTranspose((prev) => (prev - 1 + 12) % 12);
  }, []);

  const handleTransposeReset = useCallback(() => {
    setTranspose(0);
  }, []);

  if (!selectedSong || !songContent) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: settings.backgroundColor }]}>
        <Text style={styles.emptyIcon}>🎵</Text>
        <Text style={[styles.emptyText, { color: settings.lyrics.color }]}>No song selected</Text>
        <Text style={[styles.emptyHint, { color: settings.lyrics.color }]}>
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
    <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        {/* Transpose controls */}
        <View style={styles.transposeContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.transposeButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleTransposeDown}
          >
            <Text style={styles.transposeButtonText}>−</Text>
          </Pressable>

          <Pressable
            style={styles.transposeValue}
            onPress={handleTransposeReset}
          >
            <Text style={styles.transposeValueText}>
              {transpose === 0 ? '0' : transpose > 0 ? `+${transpose}` : transpose}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.transposeButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleTransposeUp}
          >
            <Text style={styles.transposeButtonText}>+</Text>
          </Pressable>
        </View>

        {/* Edit button */}
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleEdit}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>

      {/* Song view */}
      <SongView song={selectedSong} transpose={transpose} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  transposeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transposeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(150,150,150,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transposeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#007AFF',
  },
  transposeValue: {
    minWidth: 44,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  transposeValueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  buttonPressed: {
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
