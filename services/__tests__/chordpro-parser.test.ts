import { parseChordPro, parseLine } from '../chordpro-parser';

describe('ChordPro Parser', () => {
  describe('parseLine', () => {
    it('should parse a line with no chords', () => {
      const result = parseLine('Hello World');

      expect(result.lyrics).toBe('Hello World');
      expect(result.chords).toEqual([]);
    });

    it('should parse a line with a single chord at the start', () => {
      const result = parseLine('[C]Hello World');

      expect(result.lyrics).toBe('Hello World');
      expect(result.chords).toEqual([{ chord: 'C', position: 0 }]);
    });

    it('should parse a line with multiple chords', () => {
      const result = parseLine('[C]Hello [G]World');

      expect(result.lyrics).toBe('Hello World');
      expect(result.chords).toEqual([
        { chord: 'C', position: 0 },
        { chord: 'G', position: 6 },
      ]);
    });

    it('should parse complex chord names', () => {
      const result = parseLine('[Am7]Hello [G/B]World [Dsus4]Today');

      expect(result.lyrics).toBe('Hello World Today');
      expect(result.chords).toEqual([
        { chord: 'Am7', position: 0 },
        { chord: 'G/B', position: 6 },
        { chord: 'Dsus4', position: 12 },
      ]);
    });

    it('should handle chord in the middle of a word', () => {
      const result = parseLine('Be-[C]-fore');

      expect(result.lyrics).toBe('Be--fore');
      expect(result.chords).toEqual([{ chord: 'C', position: 3 }]);
    });

    it('should handle empty line', () => {
      const result = parseLine('');

      expect(result.lyrics).toBe('');
      expect(result.chords).toEqual([]);
    });

    it('should handle line with only chords', () => {
      const result = parseLine('[C] [G] [Am]');

      expect(result.lyrics).toBe('  ');
      expect(result.chords).toEqual([
        { chord: 'C', position: 0 },
        { chord: 'G', position: 1 },
        { chord: 'Am', position: 2 },
      ]);
    });
  });

  describe('parseChordPro', () => {
    it('should parse title metadata', () => {
      const input = '{title: Test Song}';
      const result = parseChordPro(input);

      expect(result.title).toBe('Test Song');
    });

    it('should parse multiple metadata fields', () => {
      const input = `{title: Test Song}
{artist: Test Artist}
{key: Am}
{capo: 2}`;
      const result = parseChordPro(input);

      expect(result.title).toBe('Test Song');
      expect(result.artist).toBe('Test Artist');
      expect(result.key).toBe('Am');
      expect(result.capo).toBe(2);
    });

    it('should parse subtitle', () => {
      const input = '{subtitle: Original Version}';
      const result = parseChordPro(input);

      expect(result.subtitle).toBe('Original Version');
    });

    it('should parse simple song with lyrics and chords', () => {
      const input = `{title: Simple Song}

[C]Hello [G]World`;
      const result = parseChordPro(input);

      expect(result.title).toBe('Simple Song');
      expect(result.sections.length).toBe(1);
      expect(result.sections[0].lines.length).toBe(1);
      expect(result.sections[0].lines[0].lyrics).toBe('Hello World');
      expect(result.sections[0].lines[0].chords).toEqual([
        { chord: 'C', position: 0 },
        { chord: 'G', position: 6 },
      ]);
    });

    it('should parse multiple lines', () => {
      const input = `{title: Multi Line}

[C]Line one
[G]Line two
[Am]Line three`;
      const result = parseChordPro(input);

      expect(result.sections[0].lines.length).toBe(3);
      expect(result.sections[0].lines[0].lyrics).toBe('Line one');
      expect(result.sections[0].lines[1].lyrics).toBe('Line two');
      expect(result.sections[0].lines[2].lyrics).toBe('Line three');
    });

    it('should handle empty lines as section breaks', () => {
      const input = `{title: Sections}

[C]First section

[G]Second section`;
      const result = parseChordPro(input);

      expect(result.sections.length).toBe(2);
    });

    it('should parse verse sections', () => {
      const input = `{start_of_verse}
[C]Verse line
{end_of_verse}`;
      const result = parseChordPro(input);

      expect(result.sections[0].type).toBe('verse');
      expect(result.sections[0].lines[0].lyrics).toBe('Verse line');
    });

    it('should parse chorus sections', () => {
      const input = `{start_of_chorus}
[G]Chorus line
{end_of_chorus}`;
      const result = parseChordPro(input);

      expect(result.sections[0].type).toBe('chorus');
    });

    it('should parse section with label', () => {
      const input = `{start_of_verse: Verse 1}
[C]First verse
{end_of_verse}`;
      const result = parseChordPro(input);

      expect(result.sections[0].type).toBe('verse');
      expect(result.sections[0].label).toBe('Verse 1');
    });

    it('should ignore comments', () => {
      const input = `{title: Song}
# This is a comment
[C]Actual line`;
      const result = parseChordPro(input);

      expect(result.sections[0].lines.length).toBe(1);
      expect(result.sections[0].lines[0].lyrics).toBe('Actual line');
    });

    it('should handle short directive forms', () => {
      const input = `{t: Short Title}
{st: Short Subtitle}`;
      const result = parseChordPro(input);

      expect(result.title).toBe('Short Title');
      expect(result.subtitle).toBe('Short Subtitle');
    });
  });
});

