import React, { createContext, useCallback, useContext, useState } from 'react';
import { Platform } from 'react-native';

export interface FontSettings {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface AppSettings {
  lyrics: FontSettings;
  chords: FontSettings;
  backgroundColor: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  lyrics: {
    fontFamily: 'System',
    fontSize: 16,
    color: '#FFFFFF',
    bold: false,
    italic: false,
  },
  chords: {
    fontFamily: 'System',
    fontSize: 14,
    color: '#007AFF',
    bold: true,
    italic: false,
  },
  backgroundColor: '#000000',
};

interface SettingsContextType {
  settings: AppSettings;
  updateLyrics: (updates: Partial<FontSettings>) => void;
  updateChords: (updates: Partial<FontSettings>) => void;
  setBackgroundColor: (color: string) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const updateLyrics = useCallback((updates: Partial<FontSettings>) => {
    setSettings((prev) => ({
      ...prev,
      lyrics: { ...prev.lyrics, ...updates },
    }));
  }, []);

  const updateChords = useCallback((updates: Partial<FontSettings>) => {
    setSettings((prev) => ({
      ...prev,
      chords: { ...prev.chords, ...updates },
    }));
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    setSettings((prev) => ({ ...prev, backgroundColor: color }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, updateLyrics, updateChords, setBackgroundColor, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// iOS system fonts (available on all iOS devices)
const IOS_FONTS = [
  'System',
  'SpaceMono', // Bundled with app
  // Sans-serif
  'Helvetica Neue',
  'Helvetica',
  'Arial',
  'Avenir',
  'Avenir Next',
  'Futura',
  'Gill Sans',
  'Verdana',
  'Trebuchet MS',
  // Serif
  'Georgia',
  'Times New Roman',
  'Palatino',
  'Baskerville',
  'Hoefler Text',
  'Didot',
  'Optima',
  // Monospace
  'Courier',
  'Courier New',
  'Menlo',
  'American Typewriter',
  // Display/Decorative
  'Copperplate',
  'Papyrus',
  'Marker Felt',
  'Chalkboard SE',
  'Noteworthy',
  'Snell Roundhand',
  'Bradley Hand',
  'Party LET',
  'Zapfino',
];

// Android system fonts
const ANDROID_FONTS = [
  'System',
  'SpaceMono', // Bundled with app
  // Roboto variants
  'Roboto',
  'sans-serif',
  'sans-serif-light',
  'sans-serif-thin',
  'sans-serif-condensed',
  'sans-serif-medium',
  'sans-serif-black',
  'sans-serif-smallcaps',
  // Serif
  'serif',
  'Droid Serif',
  'notoserif',
  // Monospace
  'monospace',
  'Droid Sans Mono',
  // Decorative
  'cursive',
  'casual',
  'serif-monospace',
];

export const AVAILABLE_FONTS = Platform.select({
  ios: IOS_FONTS,
  android: ANDROID_FONTS,
  default: ['System', 'SpaceMono'],
}) as string[];

export const PRESET_COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#007AFF', // Blue
  '#FF3B30', // Red
  '#34C759', // Green
  '#FF9500', // Orange
  '#AF52DE', // Purple
  '#FFD60A', // Yellow
  '#8E8E93', // Gray
];
