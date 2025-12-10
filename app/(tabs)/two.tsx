import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { SongEditor } from '@/components/SongEditor';
import { SongView, SongViewRef } from '@/components/SongView';
import { Text, View } from '@/components/Themed';
import { WysiwygEditor } from '@/components/WysiwygEditor';
import { useSelectedSong } from '@/hooks/use-selected-song';
import { useSettings } from '@/hooks/use-settings';
import { parseChordPro } from '@/services/chordpro-parser';
import { createSongStorageService } from '@/services/song-storage-runtime';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const DEFAULT_ZOOM = 1.0;
const ZOOM_STEP = 0.25;

// Autoscroll settings
const MIN_SCROLL_SPEED = 0.5;
const MAX_SCROLL_SPEED = 5.0;
const DEFAULT_SCROLL_SPEED = 1.0;
const SCROLL_SPEED_STEP = 0.5;
const SCROLL_INTERVAL_MS = 50; // 20 FPS
type EditMode = 'wysiwyg' | 'raw';

export default function SongScreen() {
  const { selectedSong, songContent, songFilename, isNewSong, updateSong, clearNewSongFlag } = useSelectedSong();
  const { settings } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('wysiwyg');
  const [transpose, setTranspose] = useState(0);
  const [zoomScale, setZoomScale] = useState(DEFAULT_ZOOM);
  const savedScale = useSharedValue(DEFAULT_ZOOM);
  
  // Autoscroll state
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(DEFAULT_SCROLL_SPEED);
  const scrollViewRef = useRef<SongViewRef>(null);
  const scrollPositionRef = useRef(0);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track the current song filename to detect changes
  const previousFilenameRef = useRef<string | null>(null);

  // Auto-enter edit mode for new songs
  useEffect(() => {
    if (isNewSong) {
      setIsEditing(true);
      setEditMode('wysiwyg');
      clearNewSongFlag();
    }
  }, [isNewSong, clearNewSongFlag]);

  // Exit edit mode when a different song is selected
  useEffect(() => {
    // Only exit editing if we're switching from one valid song to another valid song
    if (
      songFilename && 
      previousFilenameRef.current && 
      songFilename !== previousFilenameRef.current
    ) {
      setIsEditing(false);
    }
    // Update ref after state change
    previousFilenameRef.current = songFilename;
  }, [songFilename]);

  // Autoscroll effect
  useEffect(() => {
    if (isScrolling && scrollViewRef.current) {
      scrollIntervalRef.current = setInterval(() => {
        scrollPositionRef.current += scrollSpeed;
        scrollViewRef.current?.scrollTo({
          y: scrollPositionRef.current,
          animated: false,
        });
      }, SCROLL_INTERVAL_MS);
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isScrolling, scrollSpeed]);

  // Stop autoscroll when song changes
  useEffect(() => {
    setIsScrolling(false);
    scrollPositionRef.current = 0;
  }, [selectedSong]);

  const handleEdit = useCallback(() => {
    setIsScrolling(false);
    setIsEditing(true);
    setEditMode('wysiwyg');
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

  // Autoscroll controls
  const handleScrollToggle = useCallback(() => {
    setIsScrolling((prev) => !prev);
  }, []);

  const handleScrollFaster = useCallback(() => {
    setScrollSpeed((prev) => Math.min(MAX_SCROLL_SPEED, prev + SCROLL_SPEED_STEP));
  }, []);

  const handleScrollSlower = useCallback(() => {
    setScrollSpeed((prev) => Math.max(MIN_SCROLL_SPEED, prev - SCROLL_SPEED_STEP));
  }, []);

  // Track scroll position when user manually scrolls
  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    scrollPositionRef.current = event.nativeEvent.contentOffset.y;
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
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={{ flex: 1 }}>
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeButton, editMode === 'wysiwyg' && styles.modeButtonActive]}
              onPress={() => setEditMode('wysiwyg')}
            >
              <Text style={[styles.modeButtonText, editMode === 'wysiwyg' && styles.modeButtonTextActive]}>
                WYSIWYG
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, editMode === 'raw' && styles.modeButtonActive]}
              onPress={() => setEditMode('raw')}
            >
              <Text style={[styles.modeButtonText, editMode === 'raw' && styles.modeButtonTextActive]}>
                Raw
              </Text>
            </Pressable>
          </View>
          {editMode === 'wysiwyg' ? (
            <WysiwygEditor 
              key={songFilename || 'no-song'} 
              content={songContent} 
              onSave={handleSave} 
              onCancel={handleCancel} 
            />
          ) : (
            <SongEditor 
              key={songFilename || 'no-song'} 
              content={songContent} 
              onSave={handleSave} 
              onCancel={handleCancel} 
            />
          )}
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Toolbar Row 1 */}
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

        {/* Toolbar Row 2 - Autoscroll */}
        <View style={styles.toolbarSecondary}>
          <View style={styles.controlGroup}>
            <Pressable
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleScrollSlower}
            >
              <Text style={styles.scrollButtonText}>◀</Text>
            </Pressable>

            <Pressable
              style={[
                styles.playButton,
                isScrolling && styles.playButtonActive,
              ]}
              onPress={handleScrollToggle}
            >
              <Text style={[
                styles.playButtonText,
                isScrolling && styles.playButtonTextActive,
              ]}>
                {isScrolling ? '⏸' : '▶'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.controlButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleScrollFaster}
            >
              <Text style={styles.scrollButtonText}>▶</Text>
            </Pressable>

            <View style={styles.speedIndicator}>
              <Text style={styles.speedText}>
                {scrollSpeed.toFixed(1)}x
              </Text>
            </View>
          </View>
        </View>

        {/* Song view with gesture handling */}
        <GestureDetector gesture={composedGesture}>
          <View style={styles.songContainer}>
            <SongView
              ref={scrollViewRef}
              song={selectedSong}
              transpose={transpose}
              zoomScale={zoomScale}
              onScroll={handleScroll}
            />
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
  toolbarSecondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  scrollButtonText: {
    fontSize: 10,
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
  playButton: {
    width: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,122,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  playButtonActive: {
    backgroundColor: '#007AFF',
  },
  playButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  playButtonTextActive: {
    color: '#FFFFFF',
  },
  speedIndicator: {
    minWidth: 36,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
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
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#007AFF',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
});
