import { ParsedSong } from '../chordpro-types';
import {
  EditableSong,
  fromEditableSong,
  insertChordsIntoLine,
  toEditableSong,
} from '../editable-song';

describe('editable-song converters', () => {
  const baseParsed: ParsedSong = {
    title: 'Test Song',
    subtitle: 'Sub',
    artist: 'Artist',
    key: 'C',
    capo: 2,
    tempo: 120,
    sections: [
      {
        type: 'verse',
        label: 'Verse 1',
        lines: [
          {
            lyrics: 'Hello world',
            chords: [{ chord: 'C', position: 6 }],
          },
          {
            lyrics: 'Second line',
            chords: [{ chord: 'G', position: 0 }],
          },
        ],
      },
      {
        type: 'chorus',
        label: 'Chorus',
        lines: [
          {
            lyrics: 'Sing loud',
            chords: [
              { chord: 'Am', position: 0 },
              { chord: 'F', position: 5 },
            ],
          },
        ],
      },
      {
        type: 'none',
        lines: [
          {
            lyrics: 'No section here',
            chords: [],
          },
        ],
      },
    ],
  };

  it('converts ParsedSong to EditableSong', () => {
    const editable = toEditableSong(baseParsed);
    expect(editable.title).toBe('Test Song');
    expect(editable.sections.length).toBe(3);
    expect(editable.sections[0].lines[0].chords[0].chord).toBe('C');
    expect(editable.sections[1].lines[0].chords[1].position).toBe(5);
    expect(editable.sections[2].type).toBe('none');
  });

  it('serializes EditableSong back to ChordPro with directives', () => {
    const editable = toEditableSong(baseParsed);
    const output = fromEditableSong(editable);

    expect(output).toContain('{title: Test Song}');
    expect(output).toContain('{sov: Verse 1}');
    expect(output).toContain('{eov}');
    expect(output).toContain('{soc: Chorus}');
    expect(output).toContain('{eoc}');
    // Lines with chords inserted at correct positions
    expect(output).toContain('Hello [C] world');
    expect(output).toContain('[G] Second line');
    expect(output).toContain('[Am] Sing [F] loud');
    // Section without directives remains plain
    expect(output).toContain('No section here');
  });

  it('insertChordsIntoLine inserts spaces when needed', () => {
    const line = 'Hello world';
    const result = insertChordsIntoLine(line, [
      { id: '1', chord: 'C', position: 5 },
    ]);
    expect(result).toBe('Hello[C] world'); // Already space after 'Hello'
  });

  it('insertChordsIntoLine adds space if chord is inside a word', () => {
    const line = 'Helloworld';
    const result = insertChordsIntoLine(line, [
      { id: '1', chord: 'C', position: 5 },
    ]);
    expect(result).toBe('Hello[C] world'); // space inserted after chord
  });

  it('clamps chord position to end of line', () => {
    const line = 'Hi';
    const result = insertChordsIntoLine(line, [
      { id: '1', chord: 'G', position: 10 },
    ]);
    expect(result).toBe('Hi[G]');
  });

  it('roundtrip keeps content logically equivalent', () => {
    const editable = toEditableSong(baseParsed);
    const output = fromEditableSong(editable);
    const again = toEditableSong(parseChordProForTest(output));

    expect(again.title).toBe(editable.title);
    expect(again.sections.length).toBe(editable.sections.length);
    expect(again.sections[0].lines[0].chords[0].chord).toBe('C');
    expect(again.sections[1].lines[0].chords[0].chord).toBe('Am');
  });
});

// Minimal parser reuse for roundtrip check; we rely on existing parseChordPro
import { parseChordPro } from '../chordpro-parser';
function parseChordProForTest(content: string): ParsedSong {
  return parseChordPro(content);
}



