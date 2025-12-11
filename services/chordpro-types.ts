/**
 * Position of a chord within a lyric line
 */
export interface ChordPosition {
  chord: string;     // e.g., "C", "Am7", "G/B"
  position: number;  // character index in the lyric text
}

/**
 * A single line in a parsed song
 */
export interface SongLine {
  lyrics: string;
  chords: ChordPosition[];
}

/**
 * Song section types
 */
export type SectionType = 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'tab' | 'grid' | 'none';

/**
 * A section of the song (verse, chorus, etc.)
 */
export interface SongSection {
  type: SectionType;
  label?: string;    // e.g., "Verse 1", "Refrain"
  lines: SongLine[];
}

/**
 * Parsed song with metadata and content
 */
export interface ParsedSong {
  title?: string;
  subtitle?: string;
  artist?: string;
  key?: string;
  capo?: number;
  tempo?: number;
  sections: SongSection[];
}







