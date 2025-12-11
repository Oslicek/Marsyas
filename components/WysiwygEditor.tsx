import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';

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
const EDIT_PANEL_HEIGHT = 320; // Height of the chord edit panel + safe area

export function WysiwygEditor({ content, onSave, onCancel }: WysiwygEditorProps) {
  const initialSong = useMemo(() => toEditableSong(parseChordPro(content)), [content]);
  const initialChordProRef = useRef(content);
  const scrollViewRef = useRef<ScrollView>(null);

  const [song, setSong] = useState<EditableSong>(initialSong);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [editingChord, setEditingChord] = useState<{
    sectionId: string;
    lineId: string;
    chordId: string;
    chord: string;
    position: number;
    maxPosition: number;
  } | null>(null);
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
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  const serialized = useMemo(() => fromEditableSong(song), [song]);
  const hasChanges = serialized !== initialChordProRef.current;
  const isDark = useColorScheme() === 'dark';

  // Auto-scroll to edited chord when panel opens
  useEffect(() => {
    if (editingChord && scrollViewRef.current && scrollViewHeight > 0) {
      console.log('Auto-scroll triggered:', {
        editingChord,
        scrollViewHeight,
        lineBoundsCount: lineBounds.length,
      });
      
      const lineBlock = lineBounds.find(
        (lb) => lb.sectionId === editingChord.sectionId && lb.lineId === editingChord.lineId
      );
      
      console.log('Found lineBlock:', lineBlock);
      
      if (lineBlock) {
        // Calculate visible area above the panel
        const visibleHeight = scrollViewHeight - EDIT_PANEL_HEIGHT;
        // We want the line to be visible in the top portion of visible area
        const targetY = lineBlock.top - (visibleHeight * 0.2);
        
        console.log('Scrolling to:', {
          lineTop: lineBlock.top,
          visibleHeight,
          targetY: Math.max(0, targetY),
          currentScroll: scrollOffset,
        });
        
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, targetY), animated: true });
          }
        }, 200);
      } else {
        console.warn('LineBlock not found for editing chord');
      }
    }
  }, [editingChord, lineBounds, scrollViewHeight, scrollOffset]);

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
    console.log('addChord called:', sectionId, lineId);
    
    const section = song.sections.find(s => s.id === sectionId);
    const line = section?.lines.find(l => l.id === lineId);
    
    // Find position: add spacing after the last chord, or at position 0 if no chords
    let newPosition = 0;
    if (line?.chords.length) {
      // Find the last chord by position
      const lastChord = line.chords.reduce((latest, ch) => 
        ch.position > latest.position ? ch : latest
      );
      // Add spacing: last chord length + generous gap to prevent overlap
      // Use at least 8 chars spacing (good for short chords like "C" or "F")
      // Or chord length + 6 for longer chords (e.g., "Gmaj7" → 5+6=11)
      const baseSpacing = lastChord.chord.length + 6;
      const minSpacing = Math.max(8, baseSpacing);
      newPosition = Math.min(lastChord.position + minSpacing, line.lyrics.length);
    }
    
    const newChordId = `chord-${Date.now()}-${Math.random()}`;
    const newChord = {
      id: newChordId,
      chord: 'C',
      position: newPosition,
    };
    console.log('Creating new chord:', newChord);
    
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
                      chords: [...line.chords, newChord],
                    }
                  : line
              ),
            }
          : section
      ),
    }));
    
    // Open edit panel immediately for the new chord (will show it in green)
    setEditingChord({
      sectionId,
      lineId,
      chordId: newChordId,
      chord: 'C',
      position: newPosition,
      maxPosition: line?.lyrics.length || 0,
    });
  }, [song]);

  const deleteChord = useCallback((sectionId: string, lineId: string, chordId: string) => {
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lines: section.lines.map((line) =>
                line.id === lineId
                  ? { ...line, chords: line.chords.filter((c) => c.id !== chordId) }
                  : line
              ),
            }
          : section
      ),
    }));
  }, []);

  const setChordPosition = useCallback((sectionId: string, lineId: string, chordId: string, position: number) => {
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
                          ? { ...ch, position: clamp(position, 0, line.lyrics.length) }
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
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: editingChord ? EDIT_PANEL_HEIGHT : 0,
        }}
        onLayout={(e) => {
          const layout = e?.nativeEvent?.layout;
          if (!layout) return;
          setScrollOrigin({ x: layout.x, y: layout.y });
          setScrollViewHeight(layout.height);
          console.log('ScrollView layout:', { height: layout.height, paddingBottom: editingChord ? EDIT_PANEL_HEIGHT : 0 });
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
                          sectionId={section.id}
                          lineId={line.id}
                          isDark={isDark}
                          zoomScale={zoomScale}
                          editingChordId={editingChord?.chordId}
                          onChordPress={(ch) => {
                            setEditingChord({
                              sectionId: section.id,
                              lineId: line.id,
                              chordId: ch.id,
                              chord: ch.chord,
                              position: ch.position,
                              maxPosition: line.lyrics.length,
                            });
                          }}
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
                      line={line}
                      sectionId={section.id}
                      lineId={line.id}
                      editingChordId={editingChord?.chordId}
                      onChordPress={(ch) => {
                        setEditingChord({
                          sectionId: section.id,
                          lineId: line.id,
                          chordId: ch.id,
                          chord: ch.chord,
                          position: ch.position,
                          maxPosition: line.lyrics.length,
                        });
                      }}
                      isDark={isDark}
                      zoomScale={zoomScale}
                    />
                  )}

                  <Pressable
                    onPress={() => {
                      console.log('Button pressed:', section.id, line.id);
                      addChord(section.id, line.id);
                    }}
                    style={[
                      styles.addChordButton,
                      {
                        paddingHorizontal: 10 * zoomScale,
                        paddingVertical: 6 * zoomScale,
                        borderRadius: 8 * zoomScale,
                      },
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    testID={`add-chord-${line.id}`}
                  >
                    <Text 
                      style={[styles.addChordText, { fontSize: 12 * zoomScale }]}
                      pointerEvents="none"
                    >
                      + Chord
                    </Text>
                  </Pressable>
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

      {/* Chord Edit Panel */}
      {editingChord && (() => {
        console.log('Edit panel rendering for chord:', editingChord);
        return (
          <View style={[styles.editPanel, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
            <View style={styles.panelHeader}>
              <Text style={[styles.panelTitle, { color: isDark ? '#fff' : '#000' }]}>Edit Chord</Text>
              <Pressable onPress={() => setEditingChord(null)}>
                <Text style={styles.doneButton}>Done</Text>
              </Pressable>
            </View>

          <View style={styles.panelContent}>
            <Text style={[styles.panelLabel, { color: isDark ? '#fff' : '#000' }]}>Chord Name</Text>
            <TextInput
              style={[
                styles.chordNameInput,
                {
                  color: isDark ? '#fff' : '#000',
                  backgroundColor: isDark ? '#2c2c2e' : '#f5f5f5',
                },
              ]}
              value={editingChord?.chord || ''}
              onChangeText={(text) => {
                if (editingChord) {
                  updateChordText(editingChord.sectionId, editingChord.lineId, editingChord.chordId, text);
                  setEditingChord({ ...editingChord, chord: text });
                }
              }}
              autoFocus
              selectTextOnFocus
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={[styles.panelLabel, { color: isDark ? '#fff' : '#000', marginTop: 20 }]}>
              Position: {editingChord?.position || 0} / {editingChord?.maxPosition || 0}
            </Text>
            <Slider
              style={styles.positionSlider}
              value={editingChord?.position || 0}
              minimumValue={0}
              maximumValue={editingChord?.maxPosition || 0}
              step={1}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor={isDark ? '#3a3a3c' : '#d1d1d6'}
              thumbTintColor="#007AFF"
              onValueChange={(value) => {
                if (editingChord) {
                  setChordPosition(editingChord.sectionId, editingChord.lineId, editingChord.chordId, Math.round(value));
                  setEditingChord({ ...editingChord, position: Math.round(value) });
                }
              }}
            />

            <Pressable
              style={styles.deleteButton}
              onPress={() => {
                if (editingChord) {
                  deleteChord(editingChord.sectionId, editingChord.lineId, editingChord.chordId);
                  setEditingChord(null);
                }
              }}
            >
              <Text style={styles.deleteButtonText}>Delete Chord</Text>
            </Pressable>
          </View>
        </View>
        );
      })()}
    </View>
  );
}

function ChordRow({
  chords,
  line,
  sectionId,
  lineId,
  onChordPress,
  isDark,
  zoomScale,
}: {
  chords: EditableChord[];
  line: EditableLine;
  sectionId: string;
  lineId: string;
  editingChordId?: string;
  onChordPress: (chord: EditableChord) => void;
  isDark: boolean;
  zoomScale: number;
}) {
  return (
    <View style={styles.chordRow}>
      {chords.map((ch) => {
        const isBeingEdited = editingChordId === ch.id;
        return (
          <Pressable
            key={ch.id}
            style={styles.chordChip}
            onPress={() => onChordPress(ch)}
          >
            <Text
              style={[
                styles.chordInput,
                {
                  color: isBeingEdited ? '#34C759' : '#007AFF',
                  fontFamily: EDIT_FONT_FAMILY,
                  fontSize: EDIT_FONT_SIZE * zoomScale,
                  fontWeight: '600',
                },
              ]}
            >
              {ch.chord || 'C'}
            </Text>
          </Pressable>
        );
      })}
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
  sectionId,
  lineId,
  isDark,
  zoomScale,
  editingChordId,
  onChordPress,
}: {
  chords: EditableChord[];
  lyrics: string;
  lineWidth?: number;
  sectionId: string;
  lineId: string;
  isDark: boolean;
  zoomScale: number;
  editingChordId?: string;
  onChordPress: (chord: EditableChord) => void;
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
          const isBeingEdited = editingChordId === ch.id;
          return (
            <Pressable
              key={ch.id}
              style={[
                styles.overlayChip,
                {
                  left,
                  paddingVertical: 2 * zoomScale,
                  paddingHorizontal: 4 * zoomScale,
                  maxWidth: 60 * zoomScale,
                }
              ]}
              onPress={() => onChordPress(ch)}
            >
              <Text
                style={{
                  color: isBeingEdited ? '#34C759' : '#007AFF',
                  paddingVertical: 2 * zoomScale,
                  paddingHorizontal: 2 * zoomScale,
                  textAlign: 'center',
                  fontFamily: EDIT_FONT_FAMILY,
                  fontSize: EDIT_FONT_SIZE * zoomScale,
                  fontWeight: '600',
                }}
              >
                {ch.chord || 'C'}
              </Text>
            </Pressable>
          );
        })}
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
  lineBlock: { 
    position: 'relative',
    marginBottom: 12,
  },
  chordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
    paddingRight: 100,
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
    minWidth: 30,
    maxWidth: 60,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 6,
    textAlign: 'center',
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
    position: 'absolute',
    right: 8,
    top: 0,
    zIndex: 10,
    borderRadius: 8,
    backgroundColor: '#34C759',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addChordText: { 
    color: '#FFFFFF',
    fontWeight: '600',
  },
  lineScrollContainer: {
    width: '100%',
    paddingRight: 100,
    ...(Platform.OS === 'web' ? {
      overflow: 'auto',
    } : {}),
  },
  lineScrollContent: {
    flexGrow: 1,
    ...(Platform.OS === 'web' ? {
      minWidth: '100%',
    } : {}),
  },
  lyricsWrapper: {
    position: 'relative',
    flexDirection: 'column',
    ...(Platform.OS === 'web' ? {
      width: '100%',
      minWidth: '100%',
    } : {}),
  },
  chordsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 100,
    height: CHORD_OVERLAY_HEIGHT,
    zIndex: 1,
    ...(Platform.OS === 'web' ? {
      pointerEvents: 'none',
    } : {}),
  },
  chordOverlayRow: {
    position: 'relative',
    height: CHORD_OVERLAY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  overlayChip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    maxWidth: 60,
    ...(Platform.OS === 'web' ? {
      pointerEvents: 'auto',
      display: 'inline-block',
    } : {}),
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
    ...(Platform.OS === 'web' ? {
      width: '100%',
      boxSizing: 'border-box',
    } : {}),
  },
  editPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  panelContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  panelLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chordNameInput: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: EDIT_FONT_FAMILY,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  positionSlider: {
    width: '100%',
    height: 40,
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

