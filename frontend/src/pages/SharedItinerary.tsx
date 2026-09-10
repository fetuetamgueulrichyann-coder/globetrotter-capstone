import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Compass, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Destination } from '../types';

/**
 * Page ouverte via un lien copié/envoyé (ex. WhatsApp, SMS) — accessible
 * sans compte MboaTrip ni connexion. Purement lecture seule : aucune
 * action de modification n'est proposée ici.
 */
export default function SharedItinerary() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [data, setData] = useState<{ title: string; destination: Destination | null; startDate: string; endDate: string; notes: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getPublicItinerary(id)
      .then((res) => setData(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center text-elegant/40">
        <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
        {t('common.loading')}
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <Compass className="mx-auto text-forest-300 mb-4" size={32} />
        <p className="text-elegant/60 text-sm mb-6">
          {t('itineraries.linkExpired', "Ce lien de partage n'est plus valide, ou l'itinéraire n'existe plus.")}
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 transition">
          {t('itineraries.discoverMboatrip', 'Découvrir MboaTrip')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('itineraries.sharedItineraryEyebrow', 'Itinéraire partagé')}</p>
      <div className="rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm">
        {data.destination && (
          <img src={data.destination.imageUrl} alt={data.destination.name} className="w-full h-44 object-cover" />
        )}
        <div className="p-5">
          <h1 className="font-display text-xl font-bold text-elegant mb-2">{data.title}</h1>
          {data.destination && (
            <p className="text-sm text-elegant/50 flex items-center gap-1.5 mb-1">
              <MapPin size={14} /> {data.destination.name}
            </p>
          )}
          <p className="text-sm text-elegant/50 flex items-center gap-1.5">
            <Calendar size={14} /> {data.startDate} → {data.endDate}
          </p>
          {data.notes && <p className="text-sm text-elegant/70 mt-4 leading-relaxed">{data.notes}</p>}
        </div>
      </div>
      <p className="text-xs text-elegant/40 text-center mt-6">
        {t('itineraries.sharedItineraryFooter', "Créé avec MboaTrip — l'app pour découvrir le Cameroun.")}{' '}
        <Link to="/" className="text-forest-600 font-semibold">mboatrip.cm</Link>
      </p>
    </div>
  );
}
