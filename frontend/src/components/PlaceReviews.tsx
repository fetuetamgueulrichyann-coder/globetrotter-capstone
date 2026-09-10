import { useState, useEffect } from 'react';
import { Star, UserCircle2, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError, resolveImageUrl } from '../lib/api';
import { useAuth } from '../lib/auth';

/** Identifiant stable d'un lieu à partir de son nom — pas de dépendance à un id backend. */
export function placeIdFromName(name: string) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Review {
  id: string; userId: string; stars: number; comment: string; createdAt: string;
  author: { id: string; name: string; avatarUrl: string };
}

interface Props {
  placeName: string;
}

/**
 * Étoiles + avis sous une fiche lieu (dans GalleryModal). Avant d'écrire un
 * commentaire, l'utilisateur choisit d'abord le nombre d'étoiles, puis
 * laisse son avis, visible par tous les autres utilisateurs qui consultent
 * la fiche.
 */
export default function PlaceReviews({ placeName }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const placeId = placeIdFromName(placeName);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<{ averageStars: number; reviewCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [myStars, setMyStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getPlaceReviews(placeId)
      .then((res) => {
        setReviews(res.data);
        setSummary(res.summary);
        const mine = res.data.find((r) => r.userId === user?.id);
        if (mine) { setMyStars(mine.stars); setComment(mine.comment); }
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [placeId]);

  async function handleSubmit() {
    if (myStars === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitPlaceReview(placeId, placeName, myStars, comment.trim());
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Échec de l\'envoi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(reviewId: string) {
    try {
      await api.deletePlaceReview(reviewId);
      load();
    } catch {
      // silencieux — l'avis reste affiché si la suppression échoue
    }
  }

  return (
    <div className="mt-5 pt-5 border-t border-black/5">
      <div className="flex items-center gap-2 mb-4">
        {summary && summary.reviewCount > 0 ? (
          <>
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={16} className={i < Math.round(summary.averageStars) ? 'fill-gold-500 text-gold-500' : 'text-black/15'} />
              ))}
            </div>
            <span className="text-sm font-semibold text-elegant">{summary.averageStars}</span>
            <span className="text-xs text-elegant/45">({t('reviews.count', '{{count}} avis', { count: summary.reviewCount })})</span>
          </>
        ) : (
          <span className="text-xs text-elegant/40">{t('reviews.beFirst', 'Aucun avis pour l\'instant — sois le premier !')}</span>
        )}
      </div>

      {user ? (
        <div className="mb-5 p-3.5 rounded-xl bg-graylight">
          <p className="text-xs font-medium text-elegant/60 mb-2">{t('reviews.yourReview', 'Ton avis')}</p>
          <div className="flex gap-1 mb-2.5" onMouseLeave={() => setHoverStars(0)}>
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i} type="button"
                onMouseEnter={() => setHoverStars(i + 1)}
                onClick={() => setMyStars(i + 1)}
                aria-label={`${i + 1} étoile(s)`}
              >
                <Star size={22} className={i < (hoverStars || myStars) ? 'fill-gold-500 text-gold-500' : 'text-black/15'} />
              </button>
            ))}
          </div>
          <textarea
            value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
            placeholder={t('reviews.placeholder', 'Partage ton expérience (optionnel)…')}
            className="w-full px-3 py-2 rounded-lg bg-white border border-black/5 text-sm outline-none resize-none mb-2"
          />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button
            onClick={handleSubmit} disabled={myStars === 0 || submitting}
            className="px-3.5 py-1.5 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {t('reviews.publish', 'Publier')}
          </button>
        </div>
      ) : (
        <p className="text-xs text-elegant/40 mb-5">{t('reviews.loginPrompt', 'Connecte-toi pour noter ce lieu et laisser un avis.')}</p>
      )}

      {loading ? (
        <p className="text-xs text-elegant/30">{t('reviews.loading', 'Chargement des avis…')}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="flex items-start gap-2.5">
              {r.author?.avatarUrl ? (
                <img src={resolveImageUrl(r.author.avatarUrl)} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <UserCircle2 size={26} className="text-forest-400 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-elegant">{r.author?.name || 'Utilisateur'}</span>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={10} className={i < r.stars ? 'fill-gold-500 text-gold-500' : 'text-black/15'} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-elegant/65 mt-0.5">{r.comment}</p>}
              </div>
              {(r.userId === user?.id || user?.role === 'admin') && (
                <button onClick={() => handleDelete(r.id)} className="shrink-0 text-elegant/25 hover:text-red-500 transition">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
