import { copyChordsToSections } from '../chord-copy';

describe('copyChordsToSections', () => {
  it('should copy chords from first verse to second verse', () => {
    const input = `{title: Test}

{sov}
[C] First line of verse one
[G] Second line
{eov}

{sov}
First line of verse two
Second line
{eov}`;

    const result = copyChordsToSections(input);

    expect(result).toContain('[C] First line of verse two');
    expect(result).toContain('[G] Second line');
  });

  it('should copy chords from first chorus to second chorus', () => {
    const input = `{title: Test}

{soc}
[Am] Chorus line one
[F] Chorus line two
{eoc}

{soc}
Chorus line one
Chorus line two
{eoc}`;

    const result = copyChordsToSections(input);

    expect(result).toContain('[Am] Chorus line one');
    expect(result).toContain('[F] Chorus line two');
  });

  it('should not modify lines that already have chords', () => {
    const input = `{title: Test}

{sov}
[C] First verse
{eov}

{sov}
[D] Already has chord
{eov}`;

    const result = copyChordsToSections(input);

    expect(result).toContain('[D] Already has chord');
    expect(result).not.toContain('[C] Already has chord');
  });

  it('should handle multiple chords per line', () => {
    const input = `{title: Test}

{sov}
[C] Start [G] middle [Am] end
{eov}

{sov}
Start middle end
{eov}`;

    const result = copyChordsToSections(input);

    // The second verse should have chords inserted
    const lines = result.split('\n');
    const secondVerseLine = lines.find(l => 
      l.includes('Start') && 
      !l.includes('First') && 
      lines.indexOf(l) > lines.indexOf('{sov}')
    );
    
    expect(secondVerseLine).toContain('[C]');
    expect(secondVerseLine).toContain('[G]');
    expect(secondVerseLine).toContain('[Am]');
  });

  it('should preserve empty lines within sections', () => {
    const input = `{title: Test}

{sov}
[C] Line one

Line three
{eov}

{sov}
Line one

Line three
{eov}`;

    const result = copyChordsToSections(input);

    // Should have empty line preserved
    expect(result.split('\n').filter(l => l === '').length).toBeGreaterThan(0);
  });

  it('should handle sections with different line counts', () => {
    const input = `{title: Test}

{sov}
[C] Line one
[G] Line two
{eov}

{sov}
Line one
Line two
Line three extra
{eov}`;

    const result = copyChordsToSections(input);

    expect(result).toContain('[C] Line one');
    expect(result).toContain('[G] Line two');
    expect(result).toContain('Line three extra');
  });

  it('should handle content without sections', () => {
    const input = `{title: Test}

[C] Just some content
Without sections`;

    const result = copyChordsToSections(input);

    expect(result).toBe(input);
  });

  it('should handle abbreviated tags (sov, eov, soc, eoc)', () => {
    const input = `{sov}
[Am] Verse
{eov}

{sov}
Verse
{eov}`;

    const result = copyChordsToSections(input);

    const lines = result.split('\n');
    const verseLines = lines.filter(l => l.includes('Verse'));
    
    expect(verseLines.every(l => l.includes('[Am]'))).toBe(true);
  });

  it('should position chords approximately at same character position', () => {
    const input = `{sov}
Hello [C] world
{eov}

{sov}
Hello world
{eov}`;

    const result = copyChordsToSections(input);

    // The chord should be inserted at approximately position 6 (after "Hello ")
    expect(result).toContain('Hello [C] world');
  });
});






