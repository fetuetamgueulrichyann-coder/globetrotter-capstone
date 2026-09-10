import { useState, useEffect, useRef, type FormEvent } from 'react';
import { MapPinPlus, Camera, Loader2, Check, Clock, X as XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError, resolveImageUrl } from '../lib/api';
import type { PlaceSuggestion } from '../types';

const STATUS_LABELS: Record<PlaceSuggestion['status'], { fr: string; color: string }> = {
  pending: { fr: 'En attente', color: 'bg-gold-100 text-gold-600' },
  approved: { fr: 'Ajouté', color: 'bg-forest-100 text-forest-600' },
  rejected: { fr: 'Non retenu', color: 'bg-red-50 text-red-500' },
};

export default function SuggestPlace() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mine, setMine] = useState<PlaceSuggestion[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  function loadMine() {
    api.getMyPlaceSuggestions().then((res) => setMine(res.data)).catch(() => {});
  }

  useEffect(() => { loadMine(); }, []);

  function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.submitPlaceSuggestion({ name, city, description, photo });
      setSuccess(true);
      setName(''); setCity(''); setDescription(''); setPhoto(null); setPreview(null);
      if (fileInput.current) fileInput.current.value = '';
      loadMine();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('common.retryError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <MapPinPlus size={20} className="text-forest-600" />
        <h1 className="font-display text-2xl font-bold text-elegant">{t('suggestPlace.title', 'Suggérer un lieu')}</h1>
      </div>
      <p className="text-sm text-elegant/50 mb-6">
        {t('suggestPlace.subtitle', "Un endroit qui mérite d'être sur MboaTrip mais qu'on n'a pas encore ? Envoie-nous une photo et une description, l'équipe l'examine avant de l'ajouter.")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border border-black/5 p-5">
        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('suggestPlace.name', 'Nom du lieu')}</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} required maxLength={150}
            placeholder={t('suggestPlace.namePlaceholder', 'Ex. Cascade de la Metché')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('suggestPlace.city', 'Ville / région')}</label>
          <input
            value={city} onChange={(e) => setCity(e.target.value)} maxLength={100}
            placeholder={t('suggestPlace.cityPlaceholder', 'Ex. Bafang')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('suggestPlace.description', 'Description')}</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} maxLength={800} rows={4}
            placeholder={t('suggestPlace.descriptionPlaceholder', "Qu'est-ce qui rend ce lieu intéressant à visiter ?")}
            className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('suggestPlace.photo', 'Photo (optionnelle)')}</label>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handlePickPhoto} />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="" className="w-full h-40 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPreview(null); if (fileInput.current) fileInput.current.value = ''; }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-elegant/70 text-white flex items-center justify-center"
              >
                <XIcon size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button" onClick={() => fileInput.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-6 rounded-xl bg-graylight hover:bg-black/10 transition text-sm font-medium text-elegant/60"
            >
              <Camera size={16} /> {t('suggestPlace.choosePhoto', 'Ajouter une photo')}
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-forest-600 flex items-center gap-1.5"><Check size={14} /> {t('suggestPlace.sent', "Envoyé ! L'équipe va l'examiner.")}</p>}

        <button
          type="submit" disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          {t('suggestPlace.submit', 'Envoyer la suggestion')}
        </button>
      </form>

      {mine.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-elegant/70 mb-3">{t('suggestPlace.mySuggestions', 'Mes suggestions')}</h2>
          <div className="space-y-2">
            {mine.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-black/5">
                {s.photoUrl ? (
                  <img src={resolveImageUrl(s.photoUrl)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-graylight flex items-center justify-center shrink-0">
                    <Clock size={16} className="text-elegant/30" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-elegant truncate">{s.name}</p>
                  {s.adminNote && <p className="text-xs text-elegant/40 truncate">{s.adminNote}</p>}
                </div>
                <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${STATUS_LABELS[s.status].color}`}>
                  {STATUS_LABELS[s.status].fr}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
