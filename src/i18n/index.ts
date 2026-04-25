import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// German translations
import deCommon from './locales/de/common.json';
import deReport from './locales/de/report.json';
import deViewer from './locales/de/viewer.json';
import deBatch from './locales/de/batch.json';
import deSettings from './locales/de/settings.json';
import deErrors from './locales/de/errors.json';

// English translations
import enCommon from './locales/en/common.json';
import enReport from './locales/en/report.json';
import enViewer from './locales/en/viewer.json';
import enBatch from './locales/en/batch.json';
import enSettings from './locales/en/settings.json';
import enErrors from './locales/en/errors.json';

export const defaultNS = 'common';
export const resources = {
  de: {
    common: deCommon,
    report: deReport,
    viewer: deViewer,
    batch: deBatch,
    settings: deSettings,
    errors: deErrors,
  },
  en: {
    common: enCommon,
    report: enReport,
    viewer: enViewer,
    batch: enBatch,
    settings: enSettings,
    errors: enErrors,
  },
} as const;

// Get stored language preference or detect from browser
const getInitialLanguage = (): string => {
  try {
    const stored = localStorage.getItem('radiolyze-user-preferences');
    if (stored) {
      const prefs = JSON.parse(stored);
      if (prefs.uiLanguage) {
        return prefs.uiLanguage;
      }
    }
  } catch (e) {
    console.warn('Failed to read language preference:', e);
  }
  return 'de'; // Default to German
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'de',
    defaultNS,
    ns: ['common', 'report', 'viewer', 'batch', 'settings', 'errors'],
    
    interpolation: {
      escapeValue: false, // React already escapes
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    // Debug mode in development
    debug: import.meta.env.DEV,
  });

export default i18n;
