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
  const lineRefs = useRef<Map<string, View>>(new Map());

  const serialized = useMemo(() => fromEditableSong(song), [song]);
  const hasChanges = serialized !== initialChordProRef.current;
  const isDark = useColorScheme() === 'dark';

  // Auto-scroll to edited chord when panel opens
  useEffect(() => {
    console.log('[Scroll Effect] Triggered:', {
      hasEditingChord: !!editingChord,
      chordId: editingChord?.chordId,
      hasScrollRef: !!scrollViewRef.current,
      scrollViewHeight,
    });
    
    if (!editingChord || !editingChord.chordId || !scrollViewRef.current || scrollViewHeight === 0) {
      console.log('[Scroll Effect] Early return - missing requirements', {
        hasEditingChord: !!editingChord,
        hasChordId: !!editingChord?.chordId,
        hasScrollRef: !!scrollViewRef.current,
        hasHeight: scrollViewHeight > 0,
      });
      return;
    }
    
    const scrollTimer = setTimeout(() => {
      console.log('[Scroll Effect] Timer fired after 250ms');
      
      if (!scrollViewRef.current || scrollViewHeight === 0) {
        console.log('[Scroll Effect] ScrollView or height no longer available');
        return;
      }
      
      // Platform-specific scroll implementation
      if (Platform.OS === 'web') {
        // Web: Use offsetTop for simple, reliable positioning
        const lineKey = `${editingChord.sectionId}-${editingChord.lineId}`;
        const lineView = lineRefs.current.get(lineKey);
        
        if (!lineView) {
          console.warn('[Web] Line view not found for:', lineKey);
          return;
        }
        
        try {
          // @ts-ignore - RN Web refs have a way to access the underlying node
          const lineElement = lineView;
          // @ts-ignore
          const scrollElement = scrollViewRef.current?.getScrollableNode 
            ? scrollViewRef.current.getScrollableNode() 
            : scrollViewRef.current;
          
          // Try multiple ways to get the DOM node
          let lineDomNode = null;
          let scrollDomNode = null;
          
          // @ts-ignore - try different properties
          if (lineElement.measure) {
            // It's an RN component, try to get the node
            // @ts-ignore
            lineDomNode = lineElement._touchableNode || lineElement._nativeTag;
          }
          // @ts-ignore
          if (!lineDomNode && lineElement.nodeType) {
            lineDomNode = lineElement; // It's already a DOM node
          }
          
          // For ScrollView on web, find the actual scrollable div
          // @ts-ignore
          if (scrollElement && scrollElement.nodeType) {
            scrollDomNode = scrollElement;
          // @ts-ignore
          } else if (scrollElement && scrollElement._scrollViewRef) {
            // @ts-ignore
            scrollDomNode = scrollElement._scrollViewRef;
          }
          
          // On web, ScrollView creates a wrapper div that actually scrolls
          // Try to find it by looking for a child with overflow style
          if (scrollDomNode && scrollDomNode.nodeType === 1) {
            // Check if this element actually scrolls
            const hasScroll = scrollDomNode.scrollHeight > scrollDomNode.clientHeight;
            if (!hasScroll) {
              // Look for a child that scrolls
              console.log('[Web] Parent doesnt scroll, looking for scrollable child');
              const children = scrollDomNode.children || [];
              for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.scrollHeight > child.clientHeight) {
                  console.log('[Web] Found scrollable child at index', i);
                  scrollDomNode = child;
                  break;
                }
              }
            }
          }
          
          console.log('[Web] Found elements:', {
            hasLineNode: !!lineDomNode,
            hasScrollNode: !!scrollDomNode,
            lineNodeType: lineDomNode?.nodeType,
            scrollNodeType: scrollDomNode?.nodeType,
            lineOffsetTop: lineDomNode?.offsetTop,
            scrollTop: scrollDomNode?.scrollTop,
            scrollHeight: scrollDomNode?.scrollHeight,
            clientHeight: scrollDomNode?.clientHeight,
            isScrollable: scrollDomNode && (scrollDomNode.scrollHeight > scrollDomNode.clientHeight),
          });
          
          if (lineDomNode && scrollDomNode && lineDomNode.offsetTop !== undefined) {
            // Calculate total offset by walking up the DOM tree
            let totalOffsetTop = 0;
            let element = lineDomNode;
            
            console.log('[Web] Walking DOM tree to calculate offset:');
            while (element && element !== scrollDomNode) {
              const offset = element.offsetTop || 0;
              totalOffsetTop += offset;
              console.log('[Web]   Element:', element.tagName || 'unknown', 'offsetTop:', offset, 'running total:', totalOffsetTop);
              element = element.offsetParent;
              
              // Safety: stop if we've gone too far up
              if (!element || element === document.body || element === document.documentElement) {
                console.warn('[Web] Reached body/html without finding scroll container');
                break;
              }
            }
            
            const lineOffsetTop = totalOffsetTop;
            const currentScrollTop = scrollDomNode.scrollTop || 0;
            const scrollHeight = scrollDomNode.scrollHeight || 0;
            const clientHeight = scrollDomNode.clientHeight || 0;
            
            // Calculate visible area (viewport minus panel at bottom)
            const visibleArea = scrollViewHeight - EDIT_PANEL_HEIGHT;
            
            // Check current position of line relative to viewport
            const lineTopInViewport = lineOffsetTop - currentScrollTop;
            const lineBottomInViewport = lineTopInViewport + 80; // Line + chord overlay height
            
            // Define margins for comfortable visibility
            const TOP_MARGIN = 50; // Minimum space from top
            const BOTTOM_MARGIN = 100; // Space to keep above panel (accounting for +Chord button)
            const CLOSE_THRESHOLD = 150; // If within 150px of being visible, use minimal scroll
            
            // Check if line is comfortably visible
            const isLineVisible = 
              lineTopInViewport >= TOP_MARGIN && 
              lineBottomInViewport <= (visibleArea - BOTTOM_MARGIN);
            
            const distanceAboveViewport = -lineTopInViewport; // Positive if above
            const distanceBelowVisible = lineBottomInViewport - (visibleArea - BOTTOM_MARGIN); // Positive if below
            
            const isLineTooHigh = lineTopInViewport < TOP_MARGIN;
            const isLineTooLow = lineBottomInViewport > (visibleArea - BOTTOM_MARGIN);
            
            console.log('[Web] Visibility check:', {
              lineTopInViewport,
              lineBottomInViewport,
              visibleArea,
              isLineVisible,
              isLineTooLow,
              isLineTooHigh,
              distanceAboveViewport: isLineTooHigh ? distanceAboveViewport : 0,
              distanceBelowVisible: isLineTooLow ? distanceBelowVisible : 0,
            });
            
            let targetScrollY;
            
            if (isLineVisible) {
              // Line is already comfortably visible - don't scroll
              console.log('[Web] Line already visible, no scroll needed');
              targetScrollY = currentScrollTop;
            } else if (isLineTooHigh) {
              // Line is above viewport
              if (distanceAboveViewport <= CLOSE_THRESHOLD) {
                // Close to visible - minimal scroll to just show it with margin
                targetScrollY = currentScrollTop - (distanceAboveViewport + TOP_MARGIN);
                console.log('[Web] Line close above, minimal scroll:', targetScrollY);
              } else {
                // Far above - scroll to comfortable position (40% from top)
                targetScrollY = lineOffsetTop - (visibleArea * 0.4);
                console.log('[Web] Line far above, scroll to 40% from top');
              }
            } else {
              // Line is too low (hidden by panel or below)
              if (distanceBelowVisible <= CLOSE_THRESHOLD) {
                // Close to visible - minimal scroll to just show it with margin
                targetScrollY = currentScrollTop + distanceBelowVisible + BOTTOM_MARGIN;
                console.log('[Web] Line close below, minimal scroll:', targetScrollY);
              } else {
                // Far below - scroll to comfortable position (40% from top)
                targetScrollY = lineOffsetTop - (visibleArea * 0.4);
                console.log('[Web] Line far below, scroll to 40% from top');
              }
            }
            
            const clampedTargetScrollY = Math.max(0, Math.min(targetScrollY, scrollHeight - clientHeight));
            
            console.log('[Web] Scroll calculation:', {
              chordId: editingChord.chordId,
              lineOffsetTop,
              currentScrollTop,
              scrollViewHeight,
              panelHeight: EDIT_PANEL_HEIGHT,
              visibleArea,
              targetScrollY,
              clampedTargetScrollY,
              scrollHeight,
              clientHeight,
              maxScroll: scrollHeight - clientHeight,
              willScroll: clampedTargetScrollY !== currentScrollTop,
              scrollDelta: clampedTargetScrollY - currentScrollTop,
              calculation: `${lineOffsetTop} - (${visibleArea} * 0.2) = ${targetScrollY}`,
            });
            
            // Use native scrollTo - try both methods
            console.log('[Web] Calling scrollTo with:', { top: clampedTargetScrollY });
            const scrollTopBefore = scrollDomNode.scrollTop;
            
            // Method 1: Try smooth scrollTo first
            if (scrollDomNode.scrollTo) {
              scrollDomNode.scrollTo({
                top: clampedTargetScrollY,
                behavior: 'smooth',
              });
            }
            
            // Method 2: Immediate fallback with direct assignment
            // On some browsers/configurations, scrollTo doesn't work, so set directly
            setTimeout(() => {
              const scrollTopAfter = scrollDomNode.scrollTop;
              const scrolledCorrectly = Math.abs(scrollTopAfter - clampedTargetScrollY) < 5; // Within 5px
              
              console.log('[Web] Scroll result:', {
                before: scrollTopBefore,
                after: scrollTopAfter,
                target: clampedTargetScrollY,
                changed: scrollTopAfter !== scrollTopBefore,
                delta: scrollTopAfter - scrollTopBefore,
                scrolledCorrectly,
              });
              
              // If it didn't scroll correctly, force it
              if (!scrolledCorrectly) {
                console.warn('[Web] Scroll not at target, forcing with direct assignment');
                scrollDomNode.scrollTop = clampedTargetScrollY;
                
                setTimeout(() => {
                  console.log('[Web] After forced scroll, scrollTop:', scrollDomNode.scrollTop);
                }, 50);
              }
            }, 100);
            
            return;
          }
          
          console.warn('[Web] Could not access offsetTop, trying fallback');
          
          // Fallback: use lineBounds state
          const lineBlock = lineBounds.find(
            (lb) => lb.sectionId === editingChord.sectionId && lb.lineId === editingChord.lineId
          );
          
          if (lineBlock) {
            const visibleArea = scrollViewHeight - EDIT_PANEL_HEIGHT;
            const targetScrollY = Math.max(0, lineBlock.top - (visibleArea * 0.2));
            
            console.log('[Web] Fallback using state:', { 
              targetScrollY, 
              lineTop: lineBlock.top,
              visibleArea,
            });
            
            // @ts-ignore
            if (scrollDomNode?.scrollTo) {
              scrollDomNode.scrollTo({
                top: targetScrollY,
                behavior: 'smooth',
              });
            } else {
              scrollViewRef.current?.scrollTo({ y: targetScrollY, animated: true });
            }
          }
        } catch (error) {
          console.error('[Web] Scroll error:', error);
        }
      } else {
        // Android/iOS: Use measureLayout (more reliable on native)
        const lineKey = `${editingChord.sectionId}-${editingChord.lineId}`;
        const lineView = lineRefs.current.get(lineKey);
        
        if (!lineView) {
          console.warn('[Native] Line view not found for:', lineKey);
          return;
        }
        
        lineView.measureLayout(
          // @ts-ignore - ScrollView does have a native view handle
          scrollViewRef.current,
          (left, top, width, height) => {
            if (!scrollViewRef.current || scrollViewHeight === 0) {
              return;
            }
            
            console.log('[Native] Measured line position:', {
              chordId: editingChord.chordId,
              top,
              height,
              scrollViewHeight,
              panelHeight: EDIT_PANEL_HEIGHT,
            });
            
            const visibleArea = scrollViewHeight - EDIT_PANEL_HEIGHT;
            const targetScrollY = Math.max(0, top - (visibleArea * 0.2));
            
            console.log('[Native] Scrolling to:', {
              targetScrollY,
              visibleArea,
              calculation: `${top} - (${visibleArea} * 0.2)`,
            });
            
            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true,
            });
          },
          (error) => {
            console.error('[Native] measureLayout failed:', error);
          }
        );
      }
    }, 250); // Slightly longer delay for web DOM
    
    return () => {
      console.log('[Scroll Effect] Cleanup');
      clearTimeout(scrollTimer);
    };
  }, [editingChord?.chordId, scrollViewHeight]); // Only trigger when chord ID changes (not on text edits)

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
    const newEditingChord = {
      sectionId,
      lineId,
      chordId: newChordId,
      chord: 'C',
      position: newPosition,
      maxPosition: line?.lyrics.length || 0,
    };
    console.log('Setting editingChord:', newEditingChord);
    setEditingChord(newEditingChord);
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
          paddingBottom: EDIT_PANEL_HEIGHT + 20, // Always add padding to prevent layout thrashing
        }}
        onLayout={(e) => {
          const layout = e?.nativeEvent?.layout;
          if (!layout) return;
          setScrollOrigin({ x: layout.x, y: layout.y });
          if (scrollViewHeight !== layout.height) {
            setScrollViewHeight(layout.height);
          }
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
              const lineKey = `${section.id}-${line.id}`;
              return (
                <View 
                  key={line.id} 
                  style={styles.lineBlock}
                  ref={(ref) => {
                    if (ref) {
                      lineRefs.current.set(lineKey, ref);
                    } else {
                      lineRefs.current.delete(lineKey);
                    }
                  }}
                  onLayout={(e) => handleLineLayout(section.id, line.id, e)}
                >
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

