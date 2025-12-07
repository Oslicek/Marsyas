import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet } from 'react-native';

import { ParsedSong, SongLine, SongSection } from '@/services/chordpro-types';
import { Text, View } from './Themed';

interface SongViewProps {
  song: ParsedSong;
}

interface SongLineViewProps {
  line: SongLine;
}

interface Segment {
  textBefore: string;
  chord?: string;
  textAfter: string;
}

function buildSegments(line: SongLine): Segment[] {
  if (line.chords.length === 0) {
    return [{ textBefore: '', textAfter: line.lyrics }];
  }

  const segments: Segment[] = [];

  for (let i = 0; i < line.chords.length; i++) {
    const chord = line.chords[i];
    const nextChord = line.chords[i + 1];

    const textBefore = i === 0 ? line.lyrics.substring(0, chord.position) : '';
    const endPos = nextChord ? nextChord.position : line.lyrics.length;
    const textAfter = line.lyrics.substring(chord.position, endPos);

    segments.push({
      textBefore,
      chord: chord.chord,
      textAfter,
    });
  }

  return segments;
}

function isChordsOnlyLine(line: SongLine): boolean {
  return line.chords.length > 0 && line.lyrics.trim() === '';
}

function ChordOnlyLineView({ line }: SongLineViewProps) {
  return (
    <View style={styles.lineContainer}>
      <View style={styles.chordOnlyRow}>
        {line.chords.map((chord, i) => (
          <Text key={i} style={styles.chordSpaced}>
            {chord.chord}
          </Text>
        ))}
      </View>
    </View>
  );
}

function SongLineView({ line }: SongLineViewProps) {
  const [segmentWidths, setSegmentWidths] = useState<number[]>([]);
  const [measurementCount, setMeasurementCount] = useState(0);

  const segments = useMemo(() => buildSegments(line), [line]);

  const handleSegmentLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;

      setSegmentWidths((prev) => {
        const updated = [...prev];
        updated[index] = width;
        return updated;
      });

      setMeasurementCount((prev) => prev + 1);
    },
    []
  );

  const totalMeasurements = segments[0].textBefore ? segments.length + 1 : segments.length;
  const measurementComplete = measurementCount >= totalMeasurements;

  if (isChordsOnlyLine(line)) {
    return <ChordOnlyLineView line={line} />;
  }

  if (line.chords.length === 0) {
    return (
      <View style={styles.lineContainer}>
        <Text style={styles.lyrics}>{line.lyrics || ' '}</Text>
      </View>
    );
  }

  const calculateOffset = (index: number): number => {
    const hasTextBefore = segments[0].textBefore.length > 0;

    if (index === 0 && hasTextBefore) {
      return segmentWidths[0] || 0;
    }

    if (index === 0) {
      return 0;
    }

    let offset = hasTextBefore ? (segmentWidths[0] || 0) : 0;

    for (let i = 0; i < index; i++) {
      const widthIndex = hasTextBefore ? i + 1 : i;
      offset += segmentWidths[widthIndex] || 0;
    }

    return offset;
  };

  return (
    <View style={styles.lineContainer}>
      <View style={styles.chordsRow}>
        {segments.map((seg, i) =>
          seg.chord ? (
            <Text
              key={`chord-${i}`}
              style={[
                styles.chord,
                {
                  position: 'absolute',
                  left: calculateOffset(i),
                  opacity: measurementComplete ? 1 : 0,
                },
              ]}
            >
              {seg.chord}
            </Text>
          ) : null
        )}
        <Text style={[styles.chord, { opacity: 0 }]}>X</Text>
      </View>

      <View style={styles.lyricsRow}>
        {segments[0].textBefore.length > 0 && (
          <Text
            style={styles.lyrics}
            onLayout={(e) => handleSegmentLayout(0, e)}
          >
            {segments[0].textBefore}
          </Text>
        )}
        {segments.map((seg, i) => (
          <Text
            key={`lyric-${i}`}
            style={styles.lyrics}
            onLayout={(e) =>
              handleSegmentLayout(
                i + (segments[0].textBefore.length > 0 ? 1 : 0),
                e
              )
            }
          >
            {seg.textAfter}
          </Text>
        ))}
      </View>
    </View>
  );
}

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

export function SongView({ song }: SongViewProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {song.title && <Text style={styles.title}>{song.title}</Text>}
      {song.subtitle && <Text style={styles.subtitle}>{song.subtitle}</Text>}
      {song.artist && <Text style={styles.artist}>{song.artist}</Text>}

      {(song.key || song.capo) && (
        <View style={styles.metaRow}>
          {song.key && <Text style={styles.meta}>Key: {song.key}</Text>}
          {song.capo && <Text style={styles.meta}>Capo: {song.capo}</Text>}
        </View>
      )}

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
    marginBottom: 8,
  },
  chordsRow: {
    flexDirection: 'row',
    position: 'relative',
    minHeight: 18,
  },
  chordOnlyRow: {
    flexDirection: 'row',
    gap: 16,
  },
  lyricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chord: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  chordSpaced: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    minWidth: 40,
  },
  lyrics: {
    fontSize: 16,
    lineHeight: 22,
  },
});
