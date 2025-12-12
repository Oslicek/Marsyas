import { ParsedSong, SongLine, SongSection, SectionType } from './chordpro-types';

export type EditableChord = {
  id: string;
  chord: string;
  position: number; // character index in lyrics
};

export type EditableLine = {
  id: string;
  lyrics: string;
  chords: EditableChord[];
};

export type EditableSection = {
  id: string;
  type: SectionType;
  label?: string;
  lines: EditableLine[];
};

export type EditableSong = {
  title?: string;
  subtitle?: string;
  artist?: string;
  key?: string;
  capo?: number;
  tempo?: number;
  sections: EditableSection[];
};

/**
 * Convert ParsedSong (from ChordPro parser) to editable model.
 */
export function toEditableSong(parsed: ParsedSong): EditableSong {
  const sections: EditableSection[] = parsed.sections.map((section, sIdx) =>
    toEditableSection(section, sIdx)
  );

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    artist: parsed.artist,
    key: parsed.key,
    capo: parsed.capo,
    tempo: parsed.tempo,
    sections,
  };
}

function toEditableSection(section: SongSection, sectionIndex: number): EditableSection {
  const lines: EditableLine[] = section.lines.map((line, lIdx) =>
    toEditableLine(line, sectionIndex, lIdx)
  );

  return {
    id: `section-${sectionIndex}`,
    type: section.type,
    label: section.label,
    lines,
  };
}

function toEditableLine(line: SongLine, sectionIndex: number, lineIndex: number): EditableLine {
  return {
    id: `line-${sectionIndex}-${lineIndex}`,
    lyrics: line.lyrics,
    chords: line.chords.map((chord, cIdx) => ({
      id: `chord-${sectionIndex}-${lineIndex}-${cIdx}`,
      chord: chord.chord,
      position: chord.position,
    })),
  };
}

/**
 * Convert editable model back to ChordPro string.
 */
export function fromEditableSong(song: EditableSong): string {
  const lines: string[] = [];

  // Metadata
  if (song.title) lines.push(`{title: ${song.title}}`);
  if (song.subtitle) lines.push(`{subtitle: ${song.subtitle}}`);
  if (song.artist) lines.push(`{artist: ${song.artist}}`);
  if (song.key) lines.push(`{key: ${song.key}}`);
  if (song.capo !== undefined) lines.push(`{capo: ${song.capo}}`);
  if (song.tempo !== undefined) lines.push(`{tempo: ${song.tempo}}`);

  if (lines.length > 0) lines.push(''); // blank line after metadata

  song.sections.forEach((section, idx) => {
    emitSection(lines, section);
    if (idx < song.sections.length - 1) {
      // keep a blank line between sections for readability
      lines.push('');
    }
  });

  return lines.join('\n');
}

function emitSection(out: string[], section: EditableSection) {
  const hasDirective = section.type !== 'none';

  if (hasDirective) {
    out.push(sectionStartDirective(section.type, section.label));
  }

  section.lines.forEach((line) => {
    out.push(insertChordsIntoLine(line.lyrics, line.chords));
  });

  if (hasDirective) {
    out.push(sectionEndDirective(section.type));
  }
}

function sectionStartDirective(type: SectionType, label?: string): string {
  const name = startDirectiveName(type);
  return label ? `{${name}: ${label}}` : `{${name}}`;
}

function sectionEndDirective(type: SectionType): string {
  const name = endDirectiveName(type);
  return `{${name}}`;
}

function startDirectiveName(type: SectionType): string {
  switch (type) {
    case 'verse':
      return 'sov';
    case 'chorus':
      return 'soc';
    case 'bridge':
      return 'sob';
    case 'tab':
      return 'sot';
    case 'outro':
      return 'sot'; // treat outro as tab/other? fallback to generic none
    case 'intro':
      return 'sot';
    case 'grid':
      return 'sot';
    default:
      return 'sov';
  }
}

function endDirectiveName(type: SectionType): string {
  switch (type) {
    case 'verse':
      return 'eov';
    case 'chorus':
      return 'eoc';
    case 'bridge':
      return 'eob';
    case 'tab':
      return 'eot';
    case 'outro':
      return 'eot';
    case 'intro':
      return 'eot';
    case 'grid':
      return 'eot';
    default:
      return 'eov';
  }
}

/**
 * Insert chords into a plain text line at specified positions.
 * Adds a trailing space after the chord token when needed.
 */
export function insertChordsIntoLine(text: string, chords: EditableChord[]): string {
  if (!chords || chords.length === 0) return text;

  const sorted = [...chords].sort((a, b) => b.position - a.position);
  let result = text;

  // Allow chords beyond text end; give empty lines extra tail room
  const hasLyrics = text.length > 0;
  const maxLen = hasLyrics ? text.length + 20 : 40;

  for (const chord of sorted) {
    const pos = clamp(chord.position, 0, Math.max(result.length, maxLen));
    const needsSpace = pos < result.length && result[pos] !== ' ';
    const chordToken = needsSpace ? `[${chord.chord}] ` : `[${chord.chord}]`;
    result = result.slice(0, pos) + chordToken + result.slice(pos);
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}








