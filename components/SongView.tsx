import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ParsedSong, SongLine, SongSection } from '@/services/chordpro-types';
import { Text, View } from './Themed';

interface SongViewProps {
  song: ParsedSong;
}

interface SongLineViewProps {
  line: SongLine;
}

/**
 * Render a single line with chords above lyrics
 */
function SongLineView({ line }: SongLineViewProps) {
  if (line.chords.length === 0) {
    // No chords - just render lyrics
    return (
      <View style={styles.lineContainer}>
        <Text style={styles.lyrics}>{line.lyrics || ' '}</Text>
      </View>
    );
  }

  // Build chord line with proper spacing
  const chordLine = buildChordLine(line);

  return (
    <View style={styles.lineContainer}>
      <Text style={styles.chords}>{chordLine}</Text>
      <Text style={styles.lyrics}>{line.lyrics || ' '}</Text>
    </View>
  );
}

/**
 * Build a chord line with spaces to align chords over lyrics
 */
function buildChordLine(line: SongLine): string {
  if (line.chords.length === 0) return '';

  let result = '';
  let currentPos = 0;

  for (const chord of line.chords) {
    // Add spaces to reach chord position
    const spacesNeeded = Math.max(0, chord.position - currentPos);
    result += ' '.repeat(spacesNeeded);
    result += chord.chord;
    currentPos = chord.position + chord.chord.length;
  }

  return result;
}

/**
 * Render a song section
 */
function SectionView({ section }: { section: SongSection }) {
  const showLabel = section.type !== 'none' || section.label;

  return (
    <View style={styles.section}>
      {showLabel && (
        <Text style={styles.sectionLabel}>
          {section.label || section.type.toUpperCase()}
        </Text>
      )}
      {section.lines.map((line, index) => (
        <SongLineView key={index} line={line} />
      ))}
    </View>
  );
}

/**
 * Main component to render a parsed ChordPro song
 */
export function SongView({ song }: SongViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      {song.title && <Text style={styles.title}>{song.title}</Text>}
      {song.subtitle && <Text style={styles.subtitle}>{song.subtitle}</Text>}
      {song.artist && <Text style={styles.artist}>{song.artist}</Text>}
      
      {/* Metadata row */}
      {(song.key || song.capo) && (
        <View style={styles.metaRow}>
          {song.key && <Text style={styles.meta}>Key: {song.key}</Text>}
          {song.capo && <Text style={styles.meta}>Capo: {song.capo}</Text>}
        </View>
      )}

      {/* Song content */}
      <View style={styles.songBody}>
        {song.sections.map((section, index) => (
          <SectionView key={index} section={section} />
        ))}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.6,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  meta: {
    fontSize: 12,
    opacity: 0.7,
  },
  songBody: {
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    opacity: 0.5,
    marginBottom: 8,
    letterSpacing: 1,
  },
  lineContainer: {
    marginBottom: 4,
  },
  chords: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    letterSpacing: 0,
  },
  lyrics: {
    fontFamily: 'SpaceMono',
    fontSize: 14,
    lineHeight: 20,
  },
});

