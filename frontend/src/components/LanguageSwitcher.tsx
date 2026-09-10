import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'fr';

  function switchTo(lang: 'fr' | 'en') {
    i18n.changeLanguage(lang);
  }

  return (
    <div
      className={`flex items-center rounded-full bg-white shadow-md border border-black/5 overflow-hidden text-[11px] font-mono font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        onClick={() => switchTo('fr')}
        className={`px-2.5 py-2 transition ${current === 'fr' ? 'bg-forest-600 text-white' : 'text-elegant/50 hover:text-elegant'}`}
      >
        FR
      </button>
      <button
        onClick={() => switchTo('en')}
        className={`px-2.5 py-2 transition ${current === 'en' ? 'bg-forest-600 text-white' : 'text-elegant/50 hover:text-elegant'}`}
      >
        EN
      </button>
    </div>
  );
}
