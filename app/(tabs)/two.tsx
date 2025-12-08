import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { SongEditor } from '@/components/SongEditor';
import { SongView } from '@/components/SongView';
import { Text, View } from '@/components/Themed';
import { useSelectedSong } from '@/hooks/use-selected-song';
import { useSettings } from '@/hooks/use-settings';
import { parseChordPro } from '@/services/chordpro-parser';
import { createSongStorageService } from '@/services/song-storage-runtime';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const DEFAULT_ZOOM = 1.0;
const ZOOM_STEP = 0.25;

export default function SongScreen() {
  const { selectedSong, songContent, songFilename, isNewSong, updateSong, clearNewSongFlag } = useSelectedSong();
  const { settings } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const [zoomScale, setZoomScale] = useState(DEFAULT_ZOOM);
  const savedScale = useSharedValue(DEFAULT_ZOOM);

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

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomScale(DEFAULT_ZOOM);
    savedScale.value = DEFAULT_ZOOM;
  }, [savedScale]);

  const updateZoom = useCallback((scale: number) => {
    setZoomScale(scale);
  }, []);

  // Pinch gesture for zooming (optional, buttons are primary)
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = zoomScale;
    })
    .onUpdate((event) => {
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, savedScale.value * event.scale));
      runOnJS(updateZoom)(newScale);
    });

  // Double tap to reset zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(handleZoomReset)();
    });

  // Compose gestures
  const composedGesture = Gesture.Simultaneous(doubleTapGesture, pinchGesture);

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
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          {/* Transpose controls */}
          <View style={styles.controlGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleTransposeDown}
            >
              <Text style={styles.controlButtonText}>−</Text>
            </Pressable>

            <Pressable
              style={styles.controlValue}
              onPress={handleTransposeReset}
            >
              <Text style={styles.controlValueText}>
                {transpose === 0 ? '0' : transpose > 0 ? `+${transpose}` : transpose}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleTransposeUp}
            >
              <Text style={styles.controlButtonText}>+</Text>
            </Pressable>
          </View>

          {/* Zoom controls */}
          <View style={styles.controlGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleZoomOut}
            >
              <Text style={styles.zoomButtonText}>A−</Text>
            </Pressable>

            <Pressable
              style={styles.controlValue}
              onPress={handleZoomReset}
            >
              <Text style={styles.controlValueText}>
                {Math.round(zoomScale * 100)}%
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleZoomIn}
            >
              <Text style={styles.zoomButtonText}>A+</Text>
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

        {/* Song view with gesture handling */}
        <GestureDetector gesture={composedGesture}>
          <View style={styles.songContainer}>
            <SongView song={selectedSong} transpose={transpose} zoomScale={zoomScale} />
          </View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  songContainer: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  zoomButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
  },
  controlValue: {
    minWidth: 40,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  controlValueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
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
