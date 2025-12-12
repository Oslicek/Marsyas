import {
    ChordPosition,
    ParsedSong,
    SectionType,
    SongLine,
    SongSection,
} from './chordpro-types';

/**
 * Parse a single line of ChordPro format, extracting chords and lyrics
 */
export function parseLine(line: string): SongLine {
  const chords: ChordPosition[] = [];
  let lyrics = '';
  let position = 0;

  // Regex to match chord brackets (optionally followed by a single space)
  const chordRegex = /\[([^\]]+)\] ?/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = chordRegex.exec(line)) !== null) {
    // Add text before the chord
    const textBefore = line.substring(lastIndex, match.index);
    lyrics += textBefore;
    position += textBefore.length;

    // Record chord position
    chords.push({
      chord: match[1],
      position: position,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last chord
  lyrics += line.substring(lastIndex);

  return { lyrics, chords };
}

/**
 * Parse directive (metadata) from a line
 * Returns [directive, value] or null if not a directive
 */
function parseDirective(line: string): [string, string] | null {
  const match = line.match(/^\{([^:}]+)(?::\s*(.*))?}\s*$/);
  if (!match) return null;

  const directive = match[1].trim().toLowerCase();
  const value = match[2]?.trim() || '';

  return [directive, value];
}

/**
 * Map short directive names to full names
 */
function normalizeDirective(directive: string): string {
  const aliases: Record<string, string> = {
    t: 'title',
    st: 'subtitle',
    su: 'subtitle',
    c: 'comment',
    ci: 'comment_italic',
    cb: 'comment_box',
    soc: 'start_of_chorus',
    eoc: 'end_of_chorus',
    sov: 'start_of_verse',
    eov: 'end_of_verse',
    sob: 'start_of_bridge',
    eob: 'end_of_bridge',
    sot: 'start_of_tab',
    eot: 'end_of_tab',
  };

  return aliases[directive] || directive;
}

/**
 * Parse a complete ChordPro formatted string into a ParsedSong
 */
export function parseChordPro(content: string): ParsedSong {
  const lines = content.split(/\r?\n/);
  
  const song: ParsedSong = {
    sections: [],
  };

  let currentSection: SongSection = {
    type: 'none',
    lines: [],
  };

  let inSection = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Skip comments
    if (trimmed.startsWith('#')) {
      continue;
    }

    // Check for directive
    const directive = parseDirective(trimmed);
    if (directive) {
      const [name, value] = directive;
      const normalizedName = normalizeDirective(name);

      // Handle metadata directives
      switch (normalizedName) {
        case 'title':
          song.title = value;
          continue;
        case 'subtitle':
          song.subtitle = value;
          continue;
        case 'artist':
          song.artist = value;
          continue;
        case 'key':
          song.key = value;
          continue;
        case 'capo':
          song.capo = parseInt(value, 10) || undefined;
          continue;
        case 'tempo':
          song.tempo = parseInt(value, 10) || undefined;
          continue;
      }

      // Handle section start directives
      if (normalizedName.startsWith('start_of_')) {
        // Save current section if it has content
        if (currentSection.lines.length > 0) {
          song.sections.push(currentSection);
        }

        const sectionType = normalizedName.replace('start_of_', '') as SectionType;
        currentSection = {
          type: sectionType,
          label: value || undefined,
          lines: [],
        };
        inSection = true;
        continue;
      }

      // Handle section end directives
      if (normalizedName.startsWith('end_of_')) {
        if (currentSection.lines.length > 0) {
          song.sections.push(currentSection);
        }
        currentSection = {
          type: 'none',
          lines: [],
        };
        inSection = false;
        continue;
      }

      // Skip other directives (comments, etc.)
      continue;
    }

    // Empty line - keep it inside a section; ignore leading empties before any content
    if (trimmed === '') {
      if (inSection || currentSection.lines.length > 0) {
        currentSection.lines.push({ lyrics: '', chords: [] });
      }
      continue;
    }

    // Regular line with lyrics/chords
    const parsedLine = parseLine(rawLine);
    currentSection.lines.push(parsedLine);
  }

  // Add final section if it has content
  if (currentSection.lines.length > 0) {
    song.sections.push(currentSection);
  }

  return song;
}

