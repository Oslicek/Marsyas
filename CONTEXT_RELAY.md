# Marsyas Context Relay

## Project
React Native songbook app - lyrics + chords display/edit using ChordPro format.

## Stack
- Expo SDK 53 + TypeScript + Expo Router (file-based nav)
- Jest + TDD workflow
- In-memory storage (temp - expo-file-system API issues)

## Architecture
```
app/(tabs)/index.tsx    # Songs list (Tab 1)
app/(tabs)/two.tsx      # Song view/edit (Tab 2)
components/SongView.tsx # Renders parsed ChordPro with measured chord positioning
components/SongEditor.tsx # TextInput for raw ChordPro editing
hooks/use-selected-song.tsx # Context: selectedSong, songContent, songFilename
hooks/use-song-storage.tsx  # Hook for storage operations
services/song-storage.ts    # Adapter pattern: FileSystemAdapter, BundledAssetsAdapter
services/song-storage-runtime.ts # Singleton in-memory impl + bundled asset loading
services/chordpro-parser.ts # parseLine(), parseChordPro() -> ParsedSong
services/chordpro-types.ts  # ChordPosition, SongLine, SongSection, ParsedSong
data/*.pro                  # Bundled ChordPro song files
```

## Key Patterns
1. **Singleton storage** - `createSongStorageService()` returns same instance
2. **Adapter pattern** - FileSystemAdapter/BundledAssetsAdapter interfaces
3. **Measurement-based chord positioning** - onLayout measures text widths, chords positioned absolutely
4. **Chord-only lines** - Special render for lines with no lyrics (intro/outro)

## ChordPro Parser
- Regex: `/\[([^\]]+)\] ?/g` - extracts chords, trims ONE trailing space
- Sections: {sov}, {eov}, {soc}, {eoc}, {sob}, {eob}
- Metadata: {title:}, {artist:}, {key:}, {capo:}

## BUNDLED_SONGS (song-storage-runtime.ts)
Must manually add new .pro files to BUNDLED_SONGS array.

## Coding Standards
- Strict TS (no `any`), interfaces for data
- TDD: write tests first
- Services = business logic, Components = UI, Hooks = state
- Import order: react, RN, expo, @/, relative

## Current Features
✅ Song list display
✅ Song view with aligned chords (variable-width fonts supported)
✅ Song editing with auto-save to in-memory storage
✅ Bundled songs copied to storage on first run

## Known Issues
- Storage is in-memory only (lost on app restart)
- TODO: Migrate to expo-file-system new API when stable

## Tests
33 tests passing: song-storage (28), chordpro-parser (18), StyledText (1)
Run: `npm test`

