import { useState, useEffect, useCallback } from 'react';
import i18n from '@/i18n';

export type UILanguage = 'de' | 'en';

export interface UserPreferences {
  // Display
  theme: 'dark' | 'light' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  uiLanguage: UILanguage;
  
  // Audio / ASR
  microphoneEnabled: boolean;
  asrLanguage: 'de-DE' | 'en-US';
  autoTranscribe: boolean;
  
  // Viewer
  defaultTool: 'zoom' | 'pan' | 'measure' | 'window';
  invertColors: boolean;
  showOverlays: boolean;
  
  // Report
  autoGenerateImpression: boolean;
  showQAWarnings: boolean;
  defaultTemplate: string | null;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  fontSize: 'medium',
  compactMode: false,
  uiLanguage: 'de',
  microphoneEnabled: true,
  asrLanguage: 'de-DE',
  autoTranscribe: true,
  defaultTool: 'window',
  invertColors: false,
  showOverlays: true,
  autoGenerateImpression: true,
  showQAWarnings: true,
  defaultTemplate: null,
};

const STORAGE_KEY = 'radiolyze-user-preferences';

export function useUserPreferences() {
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load user preferences:', e);
    }
    return DEFAULT_PREFERENCES;
  });

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.warn('Failed to save user preferences:', e);
    }
  }, [preferences]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      // System preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
      root.classList.toggle('light', !isDark);
    }
  }, [preferences.theme]);

  // Apply font size
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('text-sm', 'text-base', 'text-lg');
    if (preferences.fontSize === 'small') {
      root.classList.add('text-sm');
    } else if (preferences.fontSize === 'large') {
      root.classList.add('text-lg');
    } else {
      root.classList.add('text-base');
    }
  }, [preferences.fontSize]);

  // Apply UI language
  useEffect(() => {
    if (preferences.uiLanguage && i18n.language !== preferences.uiLanguage) {
      i18n.changeLanguage(preferences.uiLanguage);
    }
  }, [preferences.uiLanguage]);

  const setPreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferencesState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setPreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    setPreference,
    setPreferences,
    resetPreferences,
  };
}
