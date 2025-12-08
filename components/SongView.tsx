import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';

import { useSettings } from '@/hooks/use-settings';
import { transposeChord } from '@/services/chord-transpose';
import { ParsedSong, SongLine, SongSection } from '@/services/chordpro-types';

interface SongViewProps {
  song: ParsedSong;
  transpose?: number;
}

interface SongLineViewProps {
  line: SongLine;
  lyricsStyle: TextStyle;
  chordStyle: TextStyle;
  transpose: number;
}

interface Segment {
  chord?: string;
  text: string;
}

/**
 * Split a SongLine into segments for inline rendering
 * Each segment has a chord (optional) and the text that follows it
 */
function buildSegments(line: SongLine, transpose: number): Segment[] {
  if (line.chords.length === 0) {
    return [{ text: line.lyrics }];
  }

  const segments: Segment[] = [];

  // If there's text before the first chord, add it as a segment without chord
  if (line.chords[0].position > 0) {
    segments.push({ text: line.lyrics.substring(0, line.chords[0].position) });
  }

  for (let i = 0; i < line.chords.length; i++) {
    const chord = line.chords[i];
    const nextChord = line.chords[i + 1];
    const endPos = nextChord ? nextChord.position : line.lyrics.length;
    const text = line.lyrics.substring(chord.position, endPos);

    // Apply transposition to chord
    const transposedChord = transpose !== 0
      ? transposeChord(chord.chord, transpose)
      : chord.chord;

    segments.push({
      chord: transposedChord,
      text: text,
    });
  }

  return segments;
}

function isChordsOnlyLine(line: SongLine): boolean {
  return line.chords.length > 0 && line.lyrics.trim() === '';
}

function ChordOnlyLineView({
  line,
  chordStyle,
  transpose,
}: {
  line: SongLine;
  chordStyle: TextStyle;
  transpose: number;
}) {
  return (
    <View style={styles.lineContainer}>
      <View style={styles.chordOnlyRow}>
        {line.chords.map((chord, i) => {
          const transposedChord = transpose !== 0
            ? transposeChord(chord.chord, transpose)
            : chord.chord;
          return (
            <Text key={i} style={[chordStyle, styles.chordSpaced]}>
              {transposedChord}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Render a single line with chords inline above their text
 * Uses vertical stacking per segment so chords flow with wrapping text
 */
function SongLineView({ line, lyricsStyle, chordStyle, transpose }: SongLineViewProps) {
  const segments = useMemo(() => buildSegments(line, transpose), [line, transpose]);

  if (isChordsOnlyLine(line)) {
    return <ChordOnlyLineView line={line} chordStyle={chordStyle} transpose={transpose} />;
  }

  if (line.chords.length === 0) {
    return (
      <View style={styles.lineContainer}>
        <Text style={lyricsStyle}>{line.lyrics || ' '}</Text>
      </View>
    );
  }

  // Calculate chord row height based on chord font size
  const chordHeight = (chordStyle.fontSize as number) + 2;

  return (
    <View style={styles.lineContainer}>
      <View style={styles.inlineRow}>
        {segments.map((seg, i) => (
          <View key={i} style={styles.segment}>
            {/* Chord or spacer */}
            <View style={{ height: chordHeight }}>
              {seg.chord ? (
                <Text style={chordStyle}>{seg.chord}</Text>
              ) : null}
            </View>
            {/* Lyrics text */}
            <Text style={lyricsStyle}>{seg.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SectionView({
  section,
  lyricsStyle,
  chordStyle,
  textColor,
  transpose,
}: {
  section: SongSection;
  lyricsStyle: TextStyle;
  chordStyle: TextStyle;
  textColor: string;
  transpose: number;
}) {
  const showLabel = section.type !== 'none' || section.label;

  return (
    <View style={styles.section}>
      {showLabel && (
        <Text style={[styles.sectionLabel, { color: textColor }]}>
          {section.label || section.type.toUpperCase()}
        </Text>
      )}
      {section.lines.map((line, index) => (
        <SongLineView
          key={index}
          line={line}
          lyricsStyle={lyricsStyle}
          chordStyle={chordStyle}
          transpose={transpose}
        />
      ))}
    </View>
  );
}

export function SongView({ song, transpose = 0 }: SongViewProps) {
  const { settings } = useSettings();

  const lyricsStyle: TextStyle = useMemo(
    () => ({
      fontFamily:
        settings.lyrics.fontFamily === 'System'
          ? undefined
          : settings.lyrics.fontFamily,
      fontSize: settings.lyrics.fontSize,
      color: settings.lyrics.color,
      fontWeight: settings.lyrics.bold ? 'bold' : 'normal',
      fontStyle: settings.lyrics.italic ? 'italic' : 'normal',
    }),
    [settings.lyrics]
  );

  const chordStyle: TextStyle = useMemo(
    () => ({
      fontFamily:
        settings.chords.fontFamily === 'System'
          ? undefined
          : settings.chords.fontFamily,
      fontSize: settings.chords.fontSize,
      color: settings.chords.color,
      fontWeight: settings.chords.bold ? 'bold' : 'normal',
      fontStyle: settings.chords.italic ? 'italic' : 'normal',
    }),
    [settings.chords]
  );

  // Transpose key metadata if present
  const displayKey = useMemo(() => {
    if (!song.key || transpose === 0) return song.key;
    return transposeChord(song.key, transpose);
  }, [song.key, transpose]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: settings.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {song.title && (
        <Text style={[styles.title, { color: settings.lyrics.color }]}>
          {song.title}
        </Text>
      )}
      {song.subtitle && (
        <Text style={[styles.subtitle, { color: settings.lyrics.color }]}>
          {song.subtitle}
        </Text>
      )}
      {song.artist && (
        <Text style={[styles.artist, { color: settings.lyrics.color }]}>
          {song.artist}
        </Text>
      )}

      {(displayKey || song.capo) && (
        <View style={styles.metaRow}>
          {displayKey && (
            <Text style={[styles.meta, { color: settings.lyrics.color }]}>
              Key: {displayKey}
            </Text>
          )}
          {song.capo && (
            <Text style={[styles.meta, { color: settings.lyrics.color }]}>
              Capo: {song.capo}
            </Text>
          )}
        </View>
      )}

      <View style={styles.songBody}>
        {song.sections.map((section, index) => (
          <SectionView
            key={index}
            section={section}
            lyricsStyle={lyricsStyle}
            chordStyle={chordStyle}
            textColor={settings.lyrics.color}
            transpose={transpose}
          />
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
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  segment: {
    // Each segment stacks chord above text
  },
  chordOnlyRow: {
    flexDirection: 'row',
    gap: 16,
  },
  chordSpaced: {
    minWidth: 40,
  },
});
