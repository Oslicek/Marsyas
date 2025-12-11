import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Text } from './Themed';
import { EditableChord, EditableLine, EditableSection, EditableSong, fromEditableSong, insertChordsIntoLine, toEditableSong } from '@/services/editable-song';
import { parseChordPro } from '@/services/chordpro-parser';
import { useColorScheme } from './useColorScheme';

const EDIT_FONT_FAMILY = 'SpaceMono';
const EDIT_FONT_SIZE = 18;
const EDIT_LINE_HEIGHT = 24;
const LYRICS_PADDING = 10;
const LYRICS_BORDER = 1;
const CHORD_OVERLAY_HEIGHT = EDIT_FONT_SIZE + 12;
const CHORD_OVERLAY_PADDING = 6;

interface WysiwygEditorProps {
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

export function WysiwygEditor({ content, onSave, onCancel }: WysiwygEditorProps) {
  const initialSong = useMemo(() => toEditableSong(parseChordPro(content)), [content]);
  const initialChordProRef = useRef(content);

  const [song, setSong] = useState<EditableSong>(initialSong);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [dragChord, setDragChord] = useState<{
    chord: EditableChord;
    fromSection: string;
    fromLine: string;
  } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [lineBounds, setLineBounds] = useState<
    { sectionId: string; lineId: string; top: number; bottom: number; left: number; width: number }[]
  >([]);
  const [lineWidths, setLineWidths] = useState<{ lineId: string; width: number }>({});
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scrollOrigin, setScrollOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const serialized = useMemo(() => fromEditableSong(song), [song]);
  const hasChanges = serialized !== initialChordProRef.current;
  const isDark = useColorScheme() === 'dark';

  const updateLyrics = useCallback((sectionId: string, lineId: string, text: string) => {
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line) =>
                line.id === lineId ? { ...line, lyrics: text } : line
              ),
            }
          : section
      ),
    }));
  }, []);

  const updateChordText = useCallback((sectionId: string, lineId: string, chordId: string, text: string) => {
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line) =>
                line.id === lineId
                  ? {
                      ...line,
                      chords: line.chords.map((ch) =>
                        ch.id === chordId ? { ...ch, chord: text } : ch
                      ),
                    }
                  : line
              ),
            }
          : section
      ),
    }));
  }, []);

  const shiftChord = useCallback((sectionId: string, lineId: string, chordId: string, delta: number) => {
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line) =>
                line.id === lineId
                  ? {
                      ...line,
                      chords: line.chords.map((ch) =>
                        ch.id === chordId
                          ? {
                              ...ch,
                              position: clamp(
                                ch.position + delta,
                                0,
                                Math.max(line.lyrics.length, 0)
                              ),
                            }
                          : ch
                      ),
                    }
                  : line
              ),
            }
          : section
      ),
    }));
  }, []);

  const addChord = useCallback((sectionId: string, lineId: string) => {
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line) =>
                line.id === lineId
                  ? {
                      ...line,
                      chords: [
                        ...line.chords,
                        {
                          id: `chord-${Date.now()}-${Math.random()}`,
                          chord: 'C',
                          position: line.lyrics.length,
                        },
                      ],
                    }
                  : line
              ),
            }
          : section
      ),
    }));
  }, []);

  const moveChord = useCallback(
    (fromSection: string, fromLine: string, chordId: string, toSection: string, toLine: string, position: number) => {
      setSong((prev) => {
        const nextSections = prev.sections.map((section) => {
          // remove from origin
          if (section.id === fromSection) {
            return {
              ...section,
              lines: section.lines.map((line) =>
                line.id === fromLine
                  ? { ...line, chords: line.chords.filter((c) => c.id !== chordId) }
                  : line
              ),
            };
          }
          return section;
        });

        // find chord data
        const chordData =
          prev.sections
            .find((s) => s.id === fromSection)
            ?.lines.find((l) => l.id === fromLine)
            ?.chords.find((c) => c.id === chordId) || null;

        if (!chordData) return prev;

        // add to target
        const updated = nextSections.map((section) => {
          if (section.id === toSection) {
            return {
              ...section,
              lines: section.lines.map((line) =>
                line.id === toLine
                  ? {
                      ...line,
                      chords: [...line.chords, { ...chordData, position: clamp(position, 0, Math.max(line.lyrics.length, 0)) }].sort(
                        (a, b) => a.position - b.position
                      ),
                    }
                  : line
              ),
            };
          }
          return section;
        });

        return { ...prev, sections: updated };
      });
    },
    []
  );

  const handleSave = useCallback(() => {
    onSave(serialized);
  }, [onSave, serialized]);

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomScale(1.0);
  }, []);

  const handleLineLayout = useCallback(
    (sectionId: string, lineId: string, e: LayoutChangeEvent) => {
      const { x, y, height, width } = e.nativeEvent.layout;
      setLineBounds((prev) => {
        const filtered = prev.filter((b) => !(b.sectionId === sectionId && b.lineId === lineId));
        return [...filtered, { sectionId, lineId, top: y, bottom: y + height, left: x, width }];
      });
    },
    []
  );

  const handleDragStart = useCallback((chord: EditableChord, sectionId: string, lineId: string) => {
    setDragChord({ chord, fromSection: sectionId, fromLine: lineId });
  }, []);

  const handleDrag = useCallback((x: number, y: number) => {
    setDragPos({ x, y });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!dragChord || !dragPos) {
      setDragChord(null);
      setDragPos(null);
      return;
    }

    // find target line
    const contentY = dragPos.y - scrollOrigin.y + scrollOffset;
    const contentX = dragPos.x - scrollOrigin.x; // horizontal scroll is not used
    const target = findNearestLine(lineBounds, contentY);
    if (!target) {
      setDragChord(null);
      setDragPos(null);
      return;
    }

    const targetLine = song.sections
      .find((s) => s.id === target.sectionId)
      ?.lines.find((l) => l.id === target.lineId);

    if (!targetLine) {
      setDragChord(null);
      setDragPos(null);
      return;
    }

    const pos = computePositionInLine(contentX, target, targetLine.lyrics);
    moveChord(dragChord.fromSection, dragChord.fromLine, dragChord.chord.id, target.sectionId, target.lineId, pos);

    setDragChord(null);
    setDragPos(null);
  }, [dragChord, dragPos, lineBounds, moveChord, song.sections]);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable onPress={onCancel} style={styles.toolbarButton}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>WYSIWYG Editor {hasChanges ? '•' : ''}</Text>
        
        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <Pressable
            onPress={handleZoomOut}
            style={styles.zoomButton}
          >
            <Text style={styles.zoomButtonText}>A−</Text>
          </Pressable>
          <Pressable onPress={handleZoomReset} style={styles.zoomValue}>
            <Text style={styles.zoomValueText}>{Math.round(zoomScale * 100)}%</Text>
          </Pressable>
          <Pressable
            onPress={handleZoomIn}
            style={styles.zoomButton}
          >
            <Text style={styles.zoomButtonText}>A+</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!hasChanges}
          style={[styles.toolbarButton, !hasChanges && styles.disabledButton]}
        >
          <Text style={[styles.save, !hasChanges && styles.disabledText]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        onLayout={(e) => {
          const layout = e?.nativeEvent?.layout;
          if (!layout) return;
          setScrollOrigin({ x: layout.x, y: layout.y });
        }}
        onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {song.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            {section.type !== 'none' && (
              <Text style={styles.sectionLabel}>
                {section.type.toUpperCase()} {section.label ? `- ${section.label}` : ''}
              </Text>
            )}

            {section.lines.map((line) => {
              const hasLyrics = line.lyrics.trim().length > 0;
              return (
                <View key={line.id} style={styles.lineBlock} onLayout={(e) => handleLineLayout(section.id, line.id, e)}>
                  {hasLyrics ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                      style={styles.lineScrollContainer}
                      contentContainerStyle={styles.lineScrollContent}
                    >
                      <View style={[
                        styles.lyricsWrapper,
                        { paddingTop: (CHORD_OVERLAY_HEIGHT + CHORD_OVERLAY_PADDING) * zoomScale }
                      ]}>
                        <InteractiveChordOverlay
                          chords={line.chords}
                          lyrics={line.lyrics}
                          lineWidth={lineWidths[line.id]}
                          isDark={isDark}
                          zoomScale={zoomScale}
                          onChangeChord={(chId, text) => updateChordText(section.id, line.id, chId, text)}
                          onDragStart={(ch) => handleDragStart(ch, section.id, line.id)}
                          onDragMove={(x, y) => handleDrag(x, y)}
                          onDragEnd={handleDragEnd}
                          onAdd={() => addChord(section.id, line.id)}
                        />
                        <TextInput
                          style={[
                            styles.lyricsInput,
                            {
                              color: isDark ? '#fff' : '#000',
                              backgroundColor: isDark ? '#1c1c1e' : '#f5f5f5',
                              fontFamily: EDIT_FONT_FAMILY,
                              fontSize: EDIT_FONT_SIZE * zoomScale,
                              lineHeight: EDIT_LINE_HEIGHT * zoomScale,
                              minWidth: '100%',
                            },
                          ]}
                          multiline={false}
                          value={line.lyrics}
                          onChangeText={(text) => updateLyrics(section.id, line.id, text)}
                          placeholder="Lyrics..."
                          placeholderTextColor={isDark ? '#666' : '#999'}
                          onLayout={(e) => {
                            const layout = e?.nativeEvent?.layout;
                            if (!layout) return;
                            setLineWidths((prev) => ({
                              ...prev,
                              [line.id]: layout.width,
                            }));
                          }}
                        />
                      </View>
                    </ScrollView>
                  ) : (
                    <ChordRow
                      chords={line.chords}
                      onChangeChord={(chId, text) =>
                        updateChordText(section.id, line.id, chId, text)
                      }
                      onDragStart={(ch) => handleDragStart(ch, section.id, line.id)}
                      onDragMove={(x, y) => handleDrag(x, y)}
                      onDragEnd={handleDragEnd}
                      onAdd={() => addChord(section.id, line.id)}
                      isDark={isDark}
                      zoomScale={zoomScale}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {dragChord && dragPos && (
        <View pointerEvents="none" style={[styles.floating, { top: dragPos.y - 20, left: dragPos.x - 40 }]}>
          <View style={styles.chordChip}>
            <Text style={styles.chordFloatingText}>{dragChord.chord.chord}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ChordRow({
  chords,
  onChangeChord,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAdd,
  isDark,
  zoomScale,
}: {
  chords: EditableChord[];
  onChangeChord: (id: string, text: string) => void;
  onDragStart: (chord: EditableChord) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onAdd: () => void;
  isDark: boolean;
  zoomScale: number;
}) {
  return (
    <View style={styles.chordRow}>
      {chords.map((ch) => (
        <GestureDetector
          key={ch.id}
          gesture={Gesture.LongPress()
            .minDuration(500)
            .onStart(() => onDragStart(ch))
            .onEnd(() => onDragEnd())
          }
        >
          <View style={styles.chordChip}>
            <TextInput
              style={[
                styles.chordInput,
                {
                  color: '#007AFF',
                  fontFamily: EDIT_FONT_FAMILY,
                  fontSize: EDIT_FONT_SIZE * zoomScale,
                  fontWeight: '600',
                },
              ]}
              placeholder="Chord"
              placeholderTextColor={isDark ? '#aaa' : '#666'}
              value={ch.chord}
              onChangeText={(t) => onChangeChord(ch.id, t)}
              autoCapitalize="characters"
              autoCorrect={false}
              selectTextOnFocus
            />
          </View>
        </GestureDetector>
      ))}

      <Pressable onPress={onAdd} style={styles.addChordButton}>
        <Text style={styles.addChordText}>+ Chord</Text>
      </Pressable>
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function findNearestLine(
  bounds: { sectionId: string; lineId: string; top: number; bottom: number }[],
  y: number
) {
  if (bounds.length === 0) return null;
  let best = bounds[0];
  let bestDist = distanceToBand(y, best.top, best.bottom);

  for (let i = 1; i < bounds.length; i++) {
    const b = bounds[i];
    const d = distanceToBand(y, b.top, b.bottom);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}

function distanceToBand(y: number, top: number, bottom: number): number {
  if (y < top) return top - y;
  if (y > bottom) return y - bottom;
  return 0;
}

function computePositionInLine(
  x: number,
  bounds: { left: number; width: number },
  lyrics: string
): number {
  const relX = clamp(x - bounds.left, 0, bounds.width);
  const charCount = Math.max(lyrics.length, 1);
  const charWidth = bounds.width / charCount;
  return Math.round(relX / charWidth);
}

function ChordOverlay({
  chords,
  lyrics,
  lineWidth,
  isDark,
}: {
  chords: EditableChord[];
  lyrics: string;
  lineWidth?: number;
  isDark: boolean;
}) {
  if (!lineWidth || chords.length === 0) return null;
  const charCount = Math.max(lyrics.length, 1);
  const charWidth = lineWidth / charCount;

  return (
    <View style={styles.chordOverlayRow}>
      {chords.map((ch) => {
        const left = clamp(ch.position * charWidth, 0, lineWidth);
        return (
          <View key={ch.id} style={[styles.overlayChip, { left }]}>
            <Text style={[styles.overlayText, { color: '#007AFF' }]}>{ch.chord || '—'}</Text>
          </View>
        );
      })}
    </View>
  );
}

function InteractiveChordOverlay({
  chords,
  lyrics,
  lineWidth,
  isDark,
  zoomScale,
  onChangeChord,
  onDragStart,
  onDragMove,
  onDragEnd,
  onAdd,
}: {
  chords: EditableChord[];
  lyrics: string;
  lineWidth?: number;
  isDark: boolean;
  zoomScale: number;
  onChangeChord: (id: string, text: string) => void;
  onDragStart: (chord: EditableChord) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onAdd: () => void;
}) {
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const charCount = Math.max(lyrics.length, 1);
  
  // Text in TextInput starts at border + padding from the left edge
  const textStartOffset = LYRICS_PADDING + LYRICS_BORDER;
  
  // Use measured width of the actual text content (from hidden Text component)
  const textContentWidth = measuredWidth ?? (lineWidth ? Math.max(lineWidth - textStartOffset * 2, 1) : 0);
  
  // Calculate width per character (monospace font)
  const charWidth = charCount > 0 ? textContentWidth / charCount : 0;

  const scaledOverlayHeight = CHORD_OVERLAY_HEIGHT * zoomScale;

  return (
    <View style={[styles.chordsOverlay, { height: scaledOverlayHeight }]}>
      <View style={[styles.chordOverlayRow, { height: scaledOverlayHeight }]}>
        {chords.map((ch) => {
          // Position chord at the exact character position in the text
          const left = textContentWidth > 0 ? textStartOffset + (ch.position * charWidth) : 0;
          return (
            <GestureDetector
              key={ch.id}
              gesture={Gesture.LongPress()
                .minDuration(500)
                .onStart(() => onDragStart(ch))
                .onEnd(() => onDragEnd())
              }
            >
              <View style={[
                styles.overlayChip,
                {
                  left,
                  paddingVertical: 2 * zoomScale,
                  paddingRight: 4 * zoomScale,
                }
              ]}>
                <TextInput
                  style={[
                    {
                      color: '#007AFF',
                      paddingVertical: 2 * zoomScale,
                      paddingHorizontal: 0,
                      minWidth: 28 * zoomScale,
                      textAlign: 'left',
                      fontFamily: EDIT_FONT_FAMILY,
                      fontSize: EDIT_FONT_SIZE * zoomScale,
                      borderWidth: 0,
                      fontWeight: '600',
                    },
                  ]}
                  placeholder="Chord"
                  placeholderTextColor={isDark ? '#aaa' : '#666'}
                  value={ch.chord}
                  onChangeText={(t) => onChangeChord(ch.id, t)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  selectTextOnFocus
                />
              </View>
            </GestureDetector>
          );
        })}
        <Pressable onPress={onAdd} style={styles.addChordButton}>
          <Text style={styles.addChordText}>+ Chord</Text>
        </Pressable>
      </View>
      {/* Hidden text to measure exact glyph width for monospace alignment */}
      <Text
        style={[
          styles.hiddenMeasure,
          { fontFamily: EDIT_FONT_FAMILY, fontSize: EDIT_FONT_SIZE * zoomScale },
        ]}
        onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      >
        {lyrics || ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  toolbarButton: { paddingVertical: 8, paddingHorizontal: 4, minWidth: 60 },
  title: { fontSize: 16, fontWeight: '600' },
  cancel: { fontSize: 16, color: '#FF3B30' },
  save: { fontSize: 16, fontWeight: '600', color: '#007AFF', textAlign: 'right' },
  disabledButton: { opacity: 0.5 },
  disabledText: { color: '#999' },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(150,150,150,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
  },
  zoomValue: {
    minWidth: 44,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  zoomValueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  scroll: { flex: 1, paddingHorizontal: 12 },
  section: { marginTop: 12, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    marginBottom: 6,
  },
  lineBlock: { marginBottom: 12 },
  chordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.08)',
    gap: 6,
  },
  chordInput: {
    minWidth: 40,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
  },
  chordControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shiftButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
  },
  shiftText: { fontSize: 10, fontWeight: '700' },
  positionLabel: { fontSize: 12, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  addChordButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
    marginLeft: 'auto',
  },
  addChordText: { color: '#007AFF', fontWeight: '600' },
  lineScrollContainer: {
    width: '100%',
  },
  lineScrollContent: {
    flexGrow: 1,
  },
  lyricsWrapper: {
    position: 'relative',
    flexDirection: 'column',
  },
  chordsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CHORD_OVERLAY_HEIGHT,
    zIndex: 1,
  },
  chordOverlayRow: {
    position: 'relative',
    height: CHORD_OVERLAY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  overlayChip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
  },
  overlayText: {
    fontWeight: '700',
    fontSize: 12,
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
    left: -9999,
    top: -9999,
  },
  lyricsInput: {
    minHeight: 50,
    padding: LYRICS_PADDING,
    borderRadius: 8,
    borderWidth: LYRICS_BORDER,
    borderColor: 'rgba(0,0,0,0.08)',
    textAlignVertical: 'top',
  },
});

