import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';

import { Text } from './Themed';
import { EditableChord, EditableLine, EditableSection, EditableSong, fromEditableSong, insertChordsIntoLine, toEditableSong } from '@/services/editable-song';
import { copyChordsToSections } from '@/services/chord-copy';
import { parseChordPro } from '@/services/chordpro-parser';
import { useColorScheme } from './useColorScheme';

const EDIT_FONT_FAMILY = 'SpaceMono';
const EDIT_FONT_SIZE = 18;
const EDIT_LINE_HEIGHT = 24;
const LYRICS_PADDING = 10;
const LYRICS_BORDER = 1;
const CHORD_OVERLAY_HEIGHT = EDIT_FONT_SIZE + 12;
const CHORD_OVERLAY_PADDING = 6;
const EXTRA_CHORD_TAIL_CHARS = 20; // allow chords after end of line
const EXTRA_EMPTY_LINE_TAIL_CHARS = 40; // more room when lyrics are empty
const EMPTY_CHAR_WIDTH = 12; // px per char on empty lines to spread chords

function getMaxPositionForLine(line: EditableLine): number {
  const hasLyrics = line.lyrics.trim().length > 0;
  return hasLyrics ? line.lyrics.length + EXTRA_CHORD_TAIL_CHARS : EXTRA_EMPTY_LINE_TAIL_CHARS;
}

interface WysiwygEditorProps {
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  onContentChange?: (content: string) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
export function WysiwygEditor({ content, onSave, onCancel, onContentChange }: WysiwygEditorProps) {
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
  const [focusedLine, setFocusedLine] = useState<{ sectionId: string; lineId: string } | null>(null);

  const serialized = useMemo(() => fromEditableSong(song), [song]);
  useEffect(() => {
    if (onContentChange) {
      onContentChange(serialized);
    }
  }, [serialized, onContentChange]);
  const hasChanges = serialized !== initialChordProRef.current;
  const isDark = useColorScheme() === 'dark';

  // Auto-scroll removed - simpler without it

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
                                Math.max(getMaxPositionForLine(line), 0)
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
      newPosition = Math.min(lastChord.position + minSpacing, getMaxPositionForLine(line));
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
    const newEditingChord = {
      sectionId,
      lineId,
      chordId: newChordId,
      chord: 'C',
      position: newPosition,
      maxPosition: getMaxPositionForLine(line || { lyrics: '', chords: [] } as EditableLine),
    };
    console.log('Setting editingChord:', newEditingChord);
    setEditingChord(newEditingChord);
    setFocusedLine({ sectionId, lineId });
  }, [song]);

  const addLineBelow = useCallback((sectionId: string, lineId: string) => {
    const newLineId = `line-${Date.now()}-${Math.random()}`;
    console.log('addLineBelow called:', sectionId, lineId, '->', newLineId);
    setSong((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const idx = section.lines.findIndex((l) => l.id === lineId);
        if (idx === -1) {
          console.warn('addLineBelow: line not found, appending to end', lineId);
          return {
            ...section,
            lines: [...section.lines, { id: newLineId, lyrics: '', chords: [] as EditableChord[] }],
          };
        }
        const newLine = { id: newLineId, lyrics: '', chords: [] as EditableChord[] };
        const newLines = [...section.lines];
        newLines.splice(idx + 1, 0, newLine);
        return { ...section, lines: newLines };
      }),
    }));
    setEditingChord(null);
    setFocusedLine({ sectionId, lineId: newLineId });
  }, []);

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
                          ? { ...ch, position: clamp(position, 0, getMaxPositionForLine(line)) }
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

  const deleteLine = useCallback((sectionId: string, lineId: string) => {
    const section = song.sections.find((s) => s.id === sectionId);
    const line = section?.lines.find((l) => l.id === lineId);
    if (!line) return;

    const hasContent = line.lyrics.trim().length > 0 || line.chords.length > 0;

    const doDelete = () => {
      setSong((prev) => ({
        ...prev,
        sections: prev.sections.map((sec) =>
          sec.id === sectionId
            ? { ...sec, lines: sec.lines.filter((l) => l.id !== lineId) }
            : sec
        ),
      }));
      if (editingChord && editingChord.sectionId === sectionId && editingChord.lineId === lineId) {
        setEditingChord(null);
      }
      if (focusedLine && focusedLine.sectionId === sectionId && focusedLine.lineId === lineId) {
        setFocusedLine(null);
      }
    };

    if (!hasContent) {
      doDelete();
      return;
    }

    Alert.alert('Delete line', 'This line has lyrics or chords. Delete it?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  }, [editingChord, focusedLine, song]);

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
                      chords: [...line.chords, { ...chordData, position: clamp(position, 0, Math.max(getMaxPositionForLine(line), 0)) }].sort(
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

  const handleCopyChords = useCallback(() => {
    const copied = copyChordsToSections(serialized);
    const parsed = toEditableSong(parseChordPro(copied));
    setSong(parsed);
  }, [serialized]);

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
        
        <Pressable onPress={handleCopyChords} style={styles.toolbarButton}>
          <Text style={styles.toolText}>Copy Chords</Text>
        </Pressable>

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
              return (
                <View 
                  key={line.id} 
                  style={styles.lineBlock}
                  onLayout={(e) => handleLineLayout(section.id, line.id, e)}
                >
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
                            maxPosition: line.lyrics.length + EXTRA_CHORD_TAIL_CHARS,
                          });
                          setFocusedLine({ sectionId: section.id, lineId: line.id });
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
                        onFocus={() => setFocusedLine({ sectionId: section.id, lineId: line.id })}
                      />
                    </View>
                  </ScrollView>

                  {focusedLine?.sectionId === section.id && focusedLine?.lineId === line.id && (
                    <>
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
                          style={styles.addChordText}
                          pointerEvents="none"
                        >
                          + Chord
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          console.log('Add line pressed:', section.id, line.id);
                          addLineBelow(section.id, line.id);
                        }}
                        style={[
                          styles.addLineButton,
                          {
                            paddingHorizontal: 10 * zoomScale,
                            paddingVertical: 6 * zoomScale,
                            borderRadius: 8 * zoomScale,
                          },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID={`add-line-${line.id}`}
                      >
                        <Text style={styles.addLineText}>
                          + Line
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => deleteLine(section.id, line.id)}
                        style={[
                          styles.deleteLineButton,
                          {
                            paddingHorizontal: 10 * zoomScale,
                            paddingVertical: 6 * zoomScale,
                            borderRadius: 8 * zoomScale,
                          },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        testID={`delete-line-${line.id}`}
                      >
                        <Text style={styles.deleteLineText}>
                          Delete line
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {editingChord && editingChord.sectionId === section.id && editingChord.lineId === line.id && (
                    (() => {
                      const targetChord = line.chords.find((c) => c.id === editingChord.chordId);
                      const chordText = targetChord?.chord ?? editingChord.chord;
                      const chordPosition = targetChord?.position ?? editingChord.position ?? 0;
                      const maxPosition = getMaxPositionForLine(line);
                      return (
                        <View style={[styles.inlinePanel, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
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
                              value={chordText}
                              onChangeText={(text) => {
                                updateChordText(section.id, line.id, editingChord.chordId, text);
                                setEditingChord({ ...editingChord, chord: text });
                              }}
                              autoFocus
                              selectTextOnFocus
                              autoCapitalize="characters"
                              autoCorrect={false}
                            />

                            <Text style={[styles.panelLabel, { color: isDark ? '#fff' : '#000', marginTop: 20 }]}>
                              Position: {chordPosition} / {maxPosition}
                            </Text>
            <Slider
              style={styles.positionSlider}
              value={chordPosition}
              minimumValue={0}
              maximumValue={maxPosition}
              step={1}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor={isDark ? '#3a3a3c' : '#d1d1d6'}
              thumbTintColor="#007AFF"
              onValueChange={(value) => {
                setChordPosition(section.id, line.id, editingChord.chordId, Math.round(value));
                setEditingChord({ ...editingChord, position: Math.round(value) });
              }}
            />

                            <Pressable
                              style={styles.deleteButton}
                              onPress={() => {
                                deleteChord(section.id, line.id, editingChord.chordId);
                                setEditingChord(null);
                              }}
                            >
                              <Text style={styles.deleteButtonText}>Delete Chord</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })()
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
  line,
  sectionId,
  lineId,
  editingChordId,
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
  const hasLyrics = line.lyrics.trim().length > 0;
  const maxPosition = getMaxPositionForLine(line);
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
  const relX = Math.max(0, x - bounds.left); // allow beyond current width
  const lyricsLen = lyrics.length;
  const charWidth =
    lyricsLen > 0
      ? bounds.width / Math.max(lyricsLen, 1)
      : EMPTY_CHAR_WIDTH;
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
  const hasLyrics = lyrics.trim().length > 0;
  const baseCharCount = hasLyrics ? Math.max(lyrics.length, 1) : 1;
  const baseCharWidth = hasLyrics ? lineWidth / baseCharCount : EMPTY_CHAR_WIDTH;
  const tail = hasLyrics ? EXTRA_CHORD_TAIL_CHARS : EXTRA_EMPTY_LINE_TAIL_CHARS;

  return (
    <View style={styles.chordOverlayRow}>
      {chords.map((ch) => {
        const left = clamp(ch.position * baseCharWidth, 0, lineWidth + baseCharWidth * tail);
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
  const textStartOffset = LYRICS_PADDING + LYRICS_BORDER;
  const hasLyrics = lyrics.trim().length > 0;
  const baseContentWidth =
    measuredWidth ??
    (lineWidth ? Math.max(lineWidth - textStartOffset * 2, 1) : 0);
  const baseCharCount = hasLyrics ? Math.max(lyrics.length, 1) : 1;
  const baseCharWidth = hasLyrics
    ? baseContentWidth / baseCharCount
    : EMPTY_CHAR_WIDTH;
  const tail = hasLyrics ? EXTRA_CHORD_TAIL_CHARS : EXTRA_EMPTY_LINE_TAIL_CHARS;
  const totalContentWidth = baseContentWidth + baseCharWidth * tail;

  const scaledOverlayHeight = CHORD_OVERLAY_HEIGHT * zoomScale;

  return (
    <View style={[styles.chordsOverlay, { height: scaledOverlayHeight }]}>
      <View style={[styles.chordOverlayRow, { height: scaledOverlayHeight, minWidth: totalContentWidth }]}>
        {chords.map((ch) => {
          // Position chord at the exact character position in the text (allow tail)
          const left = totalContentWidth > 0 ? textStartOffset + (ch.position * baseCharWidth) : 0;
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
  toolText: { fontSize: 14, color: '#007AFF', fontWeight: '600' },
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
    fontSize: 12,
    fontFamily: EDIT_FONT_FAMILY,
  },
  addLineButton: {
    position: 'absolute',
    right: 88, // place to the left of +Chord to avoid overlap
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
  addLineText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: EDIT_FONT_FAMILY,
  },
  deleteLineButton: {
    position: 'absolute',
    right: 168, // place left of +Line
    top: 0,
    zIndex: 10,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteLineText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: EDIT_FONT_FAMILY,
  },
  lineScrollContainer: {
    width: '100%',
    paddingRight: 160,
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
  inlinePanel: {
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
    overflow: 'hidden',
  },
});

