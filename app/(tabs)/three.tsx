import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch } from 'react-native';

import { Text, View } from '@/components/Themed';
import {
    AVAILABLE_FONTS,
    FontSettings,
    PRESET_COLORS,
    useSettings,
} from '@/hooks/use-settings';

interface FontSectionProps {
  title: string;
  fontSettings: FontSettings;
  onUpdate: (updates: Partial<FontSettings>) => void;
}

function ColorPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <View style={styles.colorRow}>
      {PRESET_COLORS.map((color) => (
        <Pressable
          key={color}
          style={[
            styles.colorSwatch,
            { backgroundColor: color },
            selected === color && styles.colorSwatchSelected,
          ]}
          onPress={() => onSelect(color)}
        />
      ))}
    </View>
  );
}

function FontPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (font: string) => void;
}) {
  return (
    <View style={styles.fontPickerRow}>
      {AVAILABLE_FONTS.map((font) => (
        <Pressable
          key={font}
          style={[
            styles.fontOption,
            selected === font && styles.fontOptionSelected,
          ]}
          onPress={() => onSelect(font)}
        >
          <Text
            style={[
              styles.fontOptionText,
              { fontFamily: font === 'System' ? undefined : font },
              selected === font && styles.fontOptionTextSelected,
            ]}
          >
            {font}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SizeSlider({
  value,
  onChange,
  min = 10,
  max = 32,
}: {
  value: number;
  onChange: (size: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={styles.sizeRow}>
      <Pressable
        style={styles.sizeButton}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={styles.sizeButtonText}>−</Text>
      </Pressable>
      <Text style={styles.sizeValue}>{value}px</Text>
      <Pressable
        style={styles.sizeButton}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <Text style={styles.sizeButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

function FontSection({ title, fontSettings, onUpdate }: FontSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.sectionContent}>
          <Text style={styles.label}>Font Family</Text>
          <FontPicker
            selected={fontSettings.fontFamily}
            onSelect={(font) => onUpdate({ fontFamily: font })}
          />

          <Text style={styles.label}>Size</Text>
          <SizeSlider
            value={fontSettings.fontSize}
            onChange={(size) => onUpdate({ fontSize: size })}
          />

          <Text style={styles.label}>Color</Text>
          <ColorPicker
            selected={fontSettings.color}
            onSelect={(color) => onUpdate({ color })}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Bold</Text>
            <Switch
              value={fontSettings.bold}
              onValueChange={(bold) => onUpdate({ bold })}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Italic</Text>
            <Switch
              value={fontSettings.italic}
              onValueChange={(italic) => onUpdate({ italic })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, updateLyrics, updateChords, setBackgroundColor, resetSettings } =
    useSettings();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: settings.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Settings</Text>

      <FontSection
        title="Lyrics Font"
        fontSettings={settings.lyrics}
        onUpdate={updateLyrics}
      />

      <FontSection
        title="Chords Font"
        fontSettings={settings.chords}
        onUpdate={updateChords}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Background Color</Text>
        <View style={styles.sectionContent}>
          <ColorPicker
            selected={settings.backgroundColor}
            onSelect={setBackgroundColor}
          />
        </View>
      </View>

      <Pressable style={styles.resetButton} onPress={resetSettings}>
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </Pressable>

      {/* Preview */}
      <View style={styles.previewSection}>
        <Text style={styles.previewTitle}>Preview</Text>
        <View style={styles.previewBox}>
          <Text
            style={[
              styles.previewChord,
              {
                fontFamily:
                  settings.chords.fontFamily === 'System'
                    ? undefined
                    : settings.chords.fontFamily,
                fontSize: settings.chords.fontSize,
                color: settings.chords.color,
                fontWeight: settings.chords.bold ? 'bold' : 'normal',
                fontStyle: settings.chords.italic ? 'italic' : 'normal',
              },
            ]}
          >
            Am
          </Text>
          <Text
            style={[
              styles.previewLyrics,
              {
                fontFamily:
                  settings.lyrics.fontFamily === 'System'
                    ? undefined
                    : settings.lyrics.fontFamily,
                fontSize: settings.lyrics.fontSize,
                color: settings.lyrics.color,
                fontWeight: settings.lyrics.bold ? 'bold' : 'normal',
                fontStyle: settings.lyrics.italic ? 'italic' : 'normal',
              },
            ]}
          >
            Hello world
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 12,
    opacity: 0.5,
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  label: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
    marginTop: 12,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  fontPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  fontOptionSelected: {
    backgroundColor: '#007AFF',
  },
  fontOptionText: {
    fontSize: 12,
  },
  fontOptionTextSelected: {
    color: '#FFFFFF',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sizeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(150,150,150,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sizeValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleLabel: {
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: 'rgba(255,59,48,0.2)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  resetButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  previewSection: {
    marginTop: 10,
  },
  previewTitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  previewBox: {
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  previewChord: {
    marginBottom: 2,
  },
  previewLyrics: {},
});
