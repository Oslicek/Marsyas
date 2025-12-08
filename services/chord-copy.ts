/**
 * Service for copying chords from first verse/chorus to subsequent ones
 */

interface ChordInfo {
  chord: string;
  position: number; // character position from start of line
}

interface LineChords {
  chords: ChordInfo[];
  originalText: string;
}

/**
 * Extract chords and their positions from a ChordPro line
 */
function extractChordsFromLine(line: string): LineChords {
  const chords: ChordInfo[] = [];
  let textWithoutChords = '';
  let textPosition = 0;
  
  const chordRegex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  while ((match = chordRegex.exec(line)) !== null) {
    // Add text before the chord
    const textBefore = line.substring(lastIndex, match.index);
    textWithoutChords += textBefore;
    textPosition += textBefore.length;
    
    // Record chord at current text position
    chords.push({
      chord: match[1],
      position: textPosition,
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  textWithoutChords += line.substring(lastIndex);
  
  return { chords, originalText: textWithoutChords };
}

/**
 * Insert chords into a plain text line at specified positions
 */
function insertChordsIntoLine(text: string, chords: ChordInfo[]): string {
  if (chords.length === 0) return text;
  
  // Sort chords by position (descending) to insert from end to start
  const sortedChords = [...chords].sort((a, b) => b.position - a.position);
  
  let result = text;
  for (const chord of sortedChords) {
    // Clamp position to text length
    const pos = Math.min(chord.position, result.length);
    // Add space after chord if next char is not a space and not end of string
    const needsSpace = pos < result.length && result[pos] !== ' ';
    const chordStr = needsSpace ? `[${chord.chord}] ` : `[${chord.chord}]`;
    result = result.substring(0, pos) + chordStr + result.substring(pos);
  }
  
  return result;
}

/**
 * Check if a line is a section directive
 */
function getSectionDirective(line: string): { type: 'start' | 'end'; section: string } | null {
  const trimmed = line.trim().toLowerCase();
  
  // Check for start directives
  const startMatch = trimmed.match(/^\{(sov|start_of_verse|soc|start_of_chorus)\}$/);
  if (startMatch) {
    const directive = startMatch[1];
    if (directive === 'sov' || directive === 'start_of_verse') {
      return { type: 'start', section: 'verse' };
    }
    if (directive === 'soc' || directive === 'start_of_chorus') {
      return { type: 'start', section: 'chorus' };
    }
  }
  
  // Check for end directives
  const endMatch = trimmed.match(/^\{(eov|end_of_verse|eoc|end_of_chorus)\}$/);
  if (endMatch) {
    const directive = endMatch[1];
    if (directive === 'eov' || directive === 'end_of_verse') {
      return { type: 'end', section: 'verse' };
    }
    if (directive === 'eoc' || directive === 'end_of_chorus') {
      return { type: 'end', section: 'chorus' };
    }
  }
  
  return null;
}

/**
 * Check if line has any chords
 */
function lineHasChords(line: string): boolean {
  return /\[[^\]]+\]/.test(line);
}

/**
 * Copy chords from first verse to subsequent verses, and first chorus to subsequent choruses
 */
export function copyChordsToSections(content: string): string {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  
  // Store chord patterns from first verse and chorus
  let firstVerseChords: LineChords[] | null = null;
  let firstChorusChords: LineChords[] | null = null;
  
  // Track current section state
  let currentSection: 'verse' | 'chorus' | null = null;
  let currentSectionLines: string[] = [];
  let verseCount = 0;
  let chorusCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const directive = getSectionDirective(line);
    
    if (directive) {
      if (directive.type === 'start') {
        // Starting a new section
        currentSection = directive.section as 'verse' | 'chorus';
        currentSectionLines = [];
        result.push(line);
      } else if (directive.type === 'end') {
        // Ending current section
        if (currentSection === 'verse') {
          verseCount++;
          if (verseCount === 1) {
            // This is the first verse - extract chord patterns
            firstVerseChords = currentSectionLines.map(l => extractChordsFromLine(l));
            // Output original lines
            result.push(...currentSectionLines);
          } else if (firstVerseChords) {
            // Apply first verse chords to this verse
            const processedLines = applyChordPattern(currentSectionLines, firstVerseChords);
            result.push(...processedLines);
          } else {
            result.push(...currentSectionLines);
          }
        } else if (currentSection === 'chorus') {
          chorusCount++;
          if (chorusCount === 1) {
            // This is the first chorus - extract chord patterns
            firstChorusChords = currentSectionLines.map(l => extractChordsFromLine(l));
            // Output original lines
            result.push(...currentSectionLines);
          } else if (firstChorusChords) {
            // Apply first chorus chords to this chorus
            const processedLines = applyChordPattern(currentSectionLines, firstChorusChords);
            result.push(...processedLines);
          } else {
            result.push(...currentSectionLines);
          }
        }
        
        currentSection = null;
        currentSectionLines = [];
        result.push(line);
      }
    } else if (currentSection) {
      // We're inside a section - collect lines
      currentSectionLines.push(line);
    } else {
      // Outside any section
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * Apply chord pattern from template to target lines
 */
function applyChordPattern(targetLines: string[], templateChords: LineChords[]): string[] {
  return targetLines.map((line, index) => {
    // Skip empty lines
    if (line.trim() === '') return line;
    
    // If line already has chords, keep it as is
    if (lineHasChords(line)) return line;
    
    // Get corresponding template if available
    const template = templateChords[index];
    if (!template || template.chords.length === 0) return line;
    
    // Extract just the text (in case there are any chords)
    const { originalText } = extractChordsFromLine(line);
    
    // Insert chords from template
    return insertChordsIntoLine(originalText, template.chords);
  });
}

