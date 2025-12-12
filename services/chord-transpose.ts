/**
 * Chord transposition service
 * Handles parsing and transposing chord names
 */
import { EditableSong, fromEditableSong, toEditableSong } from './editable-song';
import { parseChordPro } from './chordpro-parser';
// All note names in order (using sharps)
const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// All note names in order (using flats)
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map flats to sharps for consistent indexing
const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#',
  'Eb': 'D#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
};

// Map sharps to flats for output in flat keys
const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
};

export interface ParsedChord {
  root: string;
  quality: string;
  bass?: string;
}

/**
 * Parse a chord string into its components
 * Examples: "C" → {root: "C", quality: ""}
 *           "Am7" → {root: "A", quality: "m7"}
 *           "F#m" → {root: "F#", quality: "m"}
 *           "C/G" → {root: "C", quality: "", bass: "G"}
 */
export function parseChord(chord: string): ParsedChord | null {
  if (!chord || chord.trim() === '') return null;

  // Handle slash chords (e.g., C/G, Am7/E)
  const slashIndex = chord.indexOf('/');
  let mainPart = chord;
  let bass: string | undefined;

  if (slashIndex > 0) {
    mainPart = chord.substring(0, slashIndex);
    bass = chord.substring(slashIndex + 1);
  }

  // Extract root note (1-2 characters: letter + optional #/b)
  const rootMatch = mainPart.match(/^([A-G][#b]?)/);
  if (!rootMatch) return null;

  const root = rootMatch[1];
  const quality = mainPart.substring(root.length);

  return { root, quality, bass };
}

/**
 * Get the semitone index of a note (0-11)
 */
function getNoteIndex(note: string): number {
  // Normalize flat to sharp
  const normalized = FLAT_TO_SHARP[note] || note;
  const index = NOTES_SHARP.indexOf(normalized);
  return index >= 0 ? index : -1;
}

/**
 * Get note name from index, preferring sharps or flats based on original
 */
function getNoteFromIndex(index: number, preferFlats: boolean): string {
  const normalizedIndex = ((index % 12) + 12) % 12; // Handle negative
  const sharpNote = NOTES_SHARP[normalizedIndex];

  if (preferFlats && SHARP_TO_FLAT[sharpNote]) {
    return SHARP_TO_FLAT[sharpNote];
  }
  return sharpNote;
}

/**
 * Check if a note uses flat notation
 */
function isFlat(note: string): boolean {
  return note.includes('b');
}

/**
 * Transpose a single note by semitones
 */
export function transposeNote(note: string, semitones: number): string {
  const index = getNoteIndex(note);
  if (index < 0) return note; // Invalid note, return as-is

  const preferFlats = isFlat(note);
  return getNoteFromIndex(index + semitones, preferFlats);
}

/**
 * Transpose a chord string by semitones
 * Examples: transposeChord("C", 2) → "D"
 *           transposeChord("Am", 3) → "Cm"
 *           transposeChord("F#m7", -2) → "Em7"
 *           transposeChord("C/G", 2) → "D/A"
 */
export function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord;

  const parsed = parseChord(chord);
  if (!parsed) return chord; // Can't parse, return as-is

  const newRoot = transposeNote(parsed.root, semitones);
  let result = newRoot + parsed.quality;

  if (parsed.bass) {
    const newBass = transposeNote(parsed.bass, semitones);
    result += '/' + newBass;
  }

  return result;
}

/**
 * Transpose all chords (and key) in an editable song
 */
export function transposeEditableSong(song: EditableSong, semitones: number): EditableSong {
  if (semitones === 0) return song;
  return {
    ...song,
    key: song.key ? transposeChord(song.key, semitones) : song.key,
    sections: song.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        chords: line.chords.map((ch) => ({ ...ch, chord: transposeChord(ch.chord, semitones) })),
      })),
    })),
  };
}

/**
 * Transpose a ChordPro string and return new ChordPro content
 */
export function transposeChordProContent(content: string, semitones: number): string {
  if (semitones === 0) return content;
  const parsed = toEditableSong(parseChordPro(content));
  const transposed = transposeEditableSong(parsed, semitones);
  return fromEditableSong(transposed);
}









