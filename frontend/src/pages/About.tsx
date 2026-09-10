import { Camera, Heart, MapPinned, MessageCircle, Star, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();

  const FEATURES = [
    { icon: MapPinned, title: t('about.exploreTitle'), text: t('about.exploreText') },
    { icon: Camera, title: t('about.shareTitle'), text: t('about.shareText') },
    { icon: MessageCircle, title: t('about.commentTitle'), text: t('about.commentText') },
    { icon: Star, title: t('about.saveTitle'), text: t('about.saveText') },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <p className="text-gold-500 text-xs font-mono tracking-widest mb-3">{t('about.eyebrow')}</p>
      <h1 className="font-display text-3xl font-bold text-elegant mb-4">MboaTrip</h1>
      <p className="text-elegant/70 leading-relaxed mb-2">
        <span className="italic">{t('about.quote')}</span>
      </p>
      <p className="text-elegant/70 leading-relaxed mb-10">
        {t('about.intro')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl bg-white border border-black/5 shadow-sm p-5">
            <div className="w-10 h-10 rounded-xl bg-forest-50 flex items-center justify-center mb-3">
              <f.icon size={18} className="text-forest-600" />
            </div>
            <h3 className="font-display font-bold text-elegant text-sm mb-1">{f.title}</h3>
            <p className="text-xs text-elegant/60 leading-relaxed">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-forest-50 border border-forest-100 p-6 flex gap-4 items-start">
        <Users size={22} className="text-forest-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-display font-bold text-elegant text-sm mb-1">{t('about.communityTitle')}</h3>
          <p className="text-sm text-elegant/60 leading-relaxed">
            {t('about.communityText')}
          </p>
        </div>
      </div>

      <p className="text-xs text-elegant/35 text-center mt-12 flex items-center justify-center gap-1.5">
        {t('about.madeWith')} <Heart size={12} className="fill-red-400 text-red-400" /> {t('about.forCities')}
      </p>
    </div>
  );
}
