import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';

import { Text, View } from './Themed';
import { useColorScheme } from './useColorScheme';
import { copyChordsToSections } from '@/services/chord-copy';

interface SongEditorProps {
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const BASE_FONT_SIZE = 14;
const BASE_LINE_HEIGHT = 22;

/**
 * Editor component for editing raw ChordPro content
 */
export function SongEditor({ content, onSave, onCancel }: SongEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    setHasChanges(editedContent !== content);
  }, [editedContent, content]);

  const handleSave = useCallback(() => {
    onSave(editedContent);
  }, [editedContent, onSave]);

  const handleTextChange = useCallback((text: string) => {
    setEditedContent(text);
  }, []);

  const handleCopyChords = useCallback(() => {
    const newContent = copyChordsToSections(editedContent);
    setEditedContent(newContent);
  }, [editedContent]);

  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomScale(1.0);
  }, []);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable
          style={styles.toolbarButton}
          onPress={onCancel}
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </Pressable>
        
        <Text style={styles.toolbarTitle}>
          Edit Song {hasChanges && '•'}
        </Text>
        
        <Pressable
          style={[styles.toolbarButton, !hasChanges && styles.disabledButton]}
          onPress={handleSave}
          disabled={!hasChanges}
        >
          <Text style={[styles.saveButton, !hasChanges && styles.disabledText]}>
            Save
          </Text>
        </Pressable>
      </View>

      {/* Tools Row */}
      <View style={styles.toolsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.toolButton,
            pressed && styles.toolButtonPressed,
          ]}
          onPress={handleCopyChords}
        >
          <Text style={styles.toolButtonText}>📋 Copy Chords</Text>
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
      </View>

      {/* Editor */}
      <ScrollView 
        style={styles.scrollView}
        keyboardDismissMode="interactive"
      >
        <TextInput
          style={[
            styles.editor,
            { 
              color: isDark ? '#fff' : '#000',
              backgroundColor: isDark ? '#1c1c1e' : '#f5f5f5',
              fontSize: BASE_FONT_SIZE * zoomScale,
              lineHeight: BASE_LINE_HEIGHT * zoomScale,
            }
          ]}
          value={editedContent}
          onChangeText={handleTextChange}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="Enter song in ChordPro format..."
          placeholderTextColor={isDark ? '#666' : '#999'}
        />
      </ScrollView>

      {/* Help text */}
      <View style={styles.helpBar}>
        <Text style={styles.helpText}>
          Use [C] [Am] for chords • {'{'}sov{'}'}/{'{'}eov{'}'} for verses • {'{'}soc{'}'}/{'{'}eoc{'}'} for chorus
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  toolbarButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
    color: '#FF3B30',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'right',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    gap: 8,
  },
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
  toolButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  toolButtonPressed: {
    opacity: 0.6,
  },
  toolButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontFamily: 'SpaceMono',
    padding: 16,
    minHeight: 400,
    textAlignVertical: 'top',
  },
  helpBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  helpText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
});
