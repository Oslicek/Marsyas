import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';

import { Text, View } from './Themed';
import { useColorScheme } from './useColorScheme';

interface SongEditorProps {
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

/**
 * Editor component for editing raw ChordPro content
 */
export function SongEditor({ content, onSave, onCancel }: SongEditorProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [hasChanges, setHasChanges] = useState(false);
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
          Use [C] [Am] [G7] for chords • {'{'}title: Name{'}'} for metadata
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
  scrollView: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontFamily: 'SpaceMono',
    fontSize: 14,
    lineHeight: 22,
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


