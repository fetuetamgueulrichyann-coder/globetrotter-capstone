import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'],
    interpolation: { escapeValue: false }, // React échappe déjà le HTML
    detection: {
      // Ordre de détection : choix explicite mémorisé en premier, sinon la
      // langue du navigateur, sinon repli sur le français.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'mboatrip_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
