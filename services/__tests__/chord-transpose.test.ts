import {
    parseChord,
    transposeChord,
    transposeNote,
} from '../chord-transpose';

describe('Chord Transpose Service', () => {
  describe('parseChord', () => {
    it('should parse simple major chord', () => {
      expect(parseChord('C')).toEqual({ root: 'C', quality: '' });
      expect(parseChord('G')).toEqual({ root: 'G', quality: '' });
    });

    it('should parse minor chord', () => {
      expect(parseChord('Am')).toEqual({ root: 'A', quality: 'm' });
      expect(parseChord('Dm')).toEqual({ root: 'D', quality: 'm' });
    });

    it('should parse seventh chords', () => {
      expect(parseChord('G7')).toEqual({ root: 'G', quality: '7' });
      expect(parseChord('Am7')).toEqual({ root: 'A', quality: 'm7' });
      expect(parseChord('Cmaj7')).toEqual({ root: 'C', quality: 'maj7' });
    });

    it('should parse sharp chords', () => {
      expect(parseChord('F#')).toEqual({ root: 'F#', quality: '' });
      expect(parseChord('C#m')).toEqual({ root: 'C#', quality: 'm' });
      expect(parseChord('G#m7')).toEqual({ root: 'G#', quality: 'm7' });
    });

    it('should parse flat chords', () => {
      expect(parseChord('Bb')).toEqual({ root: 'Bb', quality: '' });
      expect(parseChord('Ebm')).toEqual({ root: 'Eb', quality: 'm' });
      expect(parseChord('Abmaj7')).toEqual({ root: 'Ab', quality: 'maj7' });
    });

    it('should parse slash chords', () => {
      expect(parseChord('C/G')).toEqual({ root: 'C', quality: '', bass: 'G' });
      expect(parseChord('Am7/E')).toEqual({ root: 'A', quality: 'm7', bass: 'E' });
      expect(parseChord('D/F#')).toEqual({ root: 'D', quality: '', bass: 'F#' });
    });

    it('should parse complex chords', () => {
      expect(parseChord('Cmaj9')).toEqual({ root: 'C', quality: 'maj9' });
      expect(parseChord('Fsus4')).toEqual({ root: 'F', quality: 'sus4' });
      expect(parseChord('Gadd9')).toEqual({ root: 'G', quality: 'add9' });
      expect(parseChord('Bdim')).toEqual({ root: 'B', quality: 'dim' });
      expect(parseChord('Caug')).toEqual({ root: 'C', quality: 'aug' });
    });

    it('should return null for invalid input', () => {
      expect(parseChord('')).toBeNull();
      expect(parseChord('   ')).toBeNull();
    });
  });

  describe('transposeNote', () => {
    it('should transpose natural notes up', () => {
      expect(transposeNote('C', 1)).toBe('C#');
      expect(transposeNote('C', 2)).toBe('D');
      expect(transposeNote('E', 1)).toBe('F');
      expect(transposeNote('B', 1)).toBe('C');
    });

    it('should transpose natural notes down', () => {
      expect(transposeNote('D', -2)).toBe('C');
      expect(transposeNote('C', -1)).toBe('B');
      expect(transposeNote('F', -1)).toBe('E');
    });

    it('should transpose sharp notes', () => {
      expect(transposeNote('F#', 2)).toBe('G#');
      expect(transposeNote('C#', -1)).toBe('C');
      expect(transposeNote('G#', 1)).toBe('A');
    });

    it('should preserve flat notation', () => {
      expect(transposeNote('Bb', 2)).toBe('C');
      expect(transposeNote('Eb', 1)).toBe('E');
      expect(transposeNote('Ab', -1)).toBe('G');
      expect(transposeNote('Db', 2)).toBe('Eb');
    });

    it('should handle full octave transposition', () => {
      expect(transposeNote('C', 12)).toBe('C');
      expect(transposeNote('G', -12)).toBe('G');
    });

    it('should handle large transpositions', () => {
      expect(transposeNote('C', 14)).toBe('D');
      expect(transposeNote('C', -14)).toBe('A#');
    });
  });

  describe('transposeChord', () => {
    it('should transpose major chords', () => {
      expect(transposeChord('C', 2)).toBe('D');
      expect(transposeChord('G', 5)).toBe('C');
      expect(transposeChord('D', -2)).toBe('C');
    });

    it('should transpose minor chords', () => {
      expect(transposeChord('Am', 3)).toBe('Cm');
      expect(transposeChord('Em', 2)).toBe('F#m');
      expect(transposeChord('Dm', -2)).toBe('Cm');
    });

    it('should transpose seventh chords', () => {
      expect(transposeChord('G7', 2)).toBe('A7');
      expect(transposeChord('Am7', 3)).toBe('Cm7');
      expect(transposeChord('Cmaj7', 5)).toBe('Fmaj7');
    });

    it('should transpose slash chords', () => {
      expect(transposeChord('C/G', 2)).toBe('D/A');
      expect(transposeChord('Am/E', 3)).toBe('Cm/G');
      expect(transposeChord('D/F#', 2)).toBe('E/G#');
    });

    it('should preserve complex qualities', () => {
      expect(transposeChord('Csus4', 2)).toBe('Dsus4');
      expect(transposeChord('Gadd9', 5)).toBe('Cadd9');
      expect(transposeChord('Bdim', 1)).toBe('Cdim');
    });

    it('should return same chord when semitones is 0', () => {
      expect(transposeChord('Am7', 0)).toBe('Am7');
      expect(transposeChord('F#m', 0)).toBe('F#m');
    });

    it('should handle sharp chords', () => {
      expect(transposeChord('F#m', 2)).toBe('G#m');
      expect(transposeChord('C#', 1)).toBe('D');
    });

    it('should preserve flat notation', () => {
      expect(transposeChord('Bbm', 2)).toBe('Cm');
      expect(transposeChord('Eb', 2)).toBe('F');
    });
  });
});







