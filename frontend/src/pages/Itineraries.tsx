import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, MapPin, Calendar, Users, Compass, Share2, Loader2, Check, Link2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import ExpenseSplitter from '../components/ExpenseSplitter';
import type { Itinerary, Destination } from '../types';

export default function Itineraries() {
  const { t } = useTranslation();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccessId, setShareSuccessId] = useState<string | null>(null);
  const [copyingLinkId, setCopyingLinkId] = useState<string | null>(null);
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.getItineraries(), api.getDestinations({ limit: '50' })])
      .then(([itRes, destRes]) => {
        setItineraries(itRes.data ?? []);
        setDestinations(destRes.data ?? []);
      })
      .catch(() => { setItineraries([]); setDestinations([]); })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createItinerary({ title, destinationId, startDate, endDate });
      setShowForm(false);
      setTitle(''); setDestinationId(''); setStartDate(''); setEndDate('');
      load();
    } catch (err: any) {
      setError(err.message || t('itineraries.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  const findDest = (id: string) => destinations.find((d) => d.id === id);

  async function handleShare(itineraryId: string) {
    if (!shareEmail.trim()) return;
    setShareBusy(true);
    setShareError(null);
    try {
      await api.shareItinerary(itineraryId, shareEmail.trim());
      setShareSuccessId(itineraryId);
      setShareEmail('');
      load();
      setTimeout(() => { setSharingId(null); setShareSuccessId(null); }, 1500);
    } catch (err) {
      setShareError(err instanceof ApiRequestError ? err.message : t('itineraries.shareError', 'Partage impossible.'));
    } finally {
      setShareBusy(false);
    }
  }

  async function handleDeleteItinerary(itineraryId: string) {
    if (!window.confirm(t('itineraries.confirmDelete', 'Supprimer définitivement cet itinéraire ?'))) return;
    await api.deleteItinerary(itineraryId);
    setItineraries((prev) => prev.filter((it) => it.id !== itineraryId));
  }

  async function handleCopyLink(itineraryId: string) {
    setCopyingLinkId(itineraryId);
    try {
      await api.enableItineraryShareLink(itineraryId);
      const url = `${window.location.origin}/itineraries/partages/${itineraryId}`;
      await navigator.clipboard.writeText(url);
      setLinkCopiedId(itineraryId);
      setTimeout(() => setLinkCopiedId(null), 2000);
    } catch {
      // silencieux : le bouton reprend simplement son état normal
    } finally {
      setCopyingLinkId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('itineraries.eyebrow')}</p>
          <h1 className="font-display text-2xl font-bold text-elegant">{t('itineraries.title')}</h1>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition flex items-center gap-2 shadow-sm"
        >
          {showForm ? <><X size={16} /> {t('common.cancel')}</> : <><Plus size={16} /> {t('itineraries.newItinerary')}</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-10 p-6 rounded-2xl bg-white border border-black/5 shadow-sm space-y-4 animate-fadeInUp">
          <div>
            <label className="block text-sm text-elegant/70 mb-1.5 font-medium">{t('itineraries.tripTitle')}</label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder={t('itineraries.tripTitlePlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
            />
          </div>

          <div>
            <label className="block text-sm text-elegant/70 mb-2 font-medium">{t('itineraries.destination')}</label>
            <div className="grid grid-cols-2 gap-3">
              {destinations.map((d) => (
                <button
                  type="button" key={d.id} onClick={() => setDestinationId(d.id)}
                  className={`relative rounded-xl overflow-hidden h-20 text-left border-2 transition ${
                    destinationId === d.id ? 'border-forest-600' : 'border-transparent'
                  }`}
                >
                  <img src={d.imageUrl} alt={d.name} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-elegant/50" />
                  <span className="absolute bottom-2 left-3 text-white text-sm font-semibold">{d.name}</span>
                  {destinationId === d.id && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-forest-600 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-elegant/70 mb-1.5 font-medium">{t('itineraries.startDate')}</label>
              <input
                type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
              />
            </div>
            <div>
              <label className="block text-sm text-elegant/70 mb-1.5 font-medium">{t('itineraries.endDate')}</label>
              <input
                type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit" disabled={submitting || !destinationId}
            className="px-5 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {submitting ? t('itineraries.creating') : t('itineraries.createButton')}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-elegant/40 text-sm font-mono">{t('common.loading')}</p>
      ) : itineraries.length === 0 ? (
        <div className="text-center py-20 px-6 rounded-2xl bg-forest-50 border border-forest-100">
          <Compass className="mx-auto text-forest-400 mb-4" size={32} />
          <p className="text-elegant/60 text-sm mb-4">
            {t('itineraries.empty')}
          </p>
          <Link
            to="/explorer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 transition"
          >
            <Compass size={16} /> {t('itineraries.openMap')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {itineraries.map((it) => {
            const dest = findDest(it.destinationId);
            return (
              <div key={it.id} className="rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition relative">
                {dest && <img src={dest.imageUrl} alt={dest.name} className="w-full h-32 object-cover" loading="lazy" />}
                <button
                  onClick={() => handleDeleteItinerary(it.id)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 hover:bg-red-600 text-white flex items-center justify-center transition backdrop-blur-sm"
                  title={t('itineraries.delete', 'Supprimer cet itinéraire')}
                >
                  <Trash2 size={14} />
                </button>
                <div className="p-4">
                  <p className="font-display font-bold text-elegant mb-1.5">{it.title}</p>
                  <p className="text-sm text-elegant/50 flex items-center gap-1.5 mb-1">
                    <MapPin size={13} /> {dest?.name || it.destinationId}
                  </p>
                  <p className="text-sm text-elegant/50 flex items-center gap-1.5">
                    <Calendar size={13} /> {it.startDate} → {it.endDate}
                  </p>
                  {(it.sharedWith || []).length > 0 && (
                    <p className="text-xs font-mono text-forest-600 flex items-center gap-1.5 mt-2">
                      <Users size={12} /> {t('itineraries.sharedWith', { count: (it.sharedWith || []).length })}
                    </p>
                  )}

                  {sharingId === it.id ? (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      {shareSuccessId === it.id ? (
                        <p className="text-xs font-semibold text-forest-600 flex items-center gap-1.5">
                          <Check size={13} /> {t('itineraries.shared', 'Itinéraire partagé !')}
                        </p>
                      ) : (
                        <>
                          <div className="flex gap-1.5">
                            <input
                              type="email" autoFocus value={shareEmail}
                              onChange={(e) => setShareEmail(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleShare(it.id); } }}
                              placeholder={t('itineraries.shareEmailPlaceholder', 'Email de la personne')}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-graylight text-xs outline-none"
                            />
                            <button
                              onClick={() => handleShare(it.id)} disabled={shareBusy || !shareEmail.trim()}
                              className="px-2.5 py-1.5 rounded-lg bg-forest-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                            >
                              {shareBusy ? <Loader2 size={12} className="animate-spin" /> : t('common.send', 'Envoyer')}
                            </button>
                            <button
                              onClick={() => { setSharingId(null); setShareError(null); }}
                              className="px-2 py-1.5 rounded-lg text-elegant/40 text-xs"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          {shareError && <p className="text-xs text-red-600 mt-1.5">{shareError}</p>}
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSharingId(it.id); setShareEmail(''); setShareError(null); }}
                      className="mt-3 pt-3 border-t border-black/5 w-full flex items-center gap-1.5 text-xs font-semibold text-forest-600 hover:text-forest-700 transition"
                    >
                      <Share2 size={13} /> {t('itineraries.share', 'Partager cet itinéraire')}
                    </button>
                  )}
                  <button
                    onClick={() => handleCopyLink(it.id)}
                    disabled={copyingLinkId === it.id}
                    className="mt-2 w-full flex items-center gap-1.5 text-xs font-semibold text-elegant/50 hover:text-forest-600 transition disabled:opacity-50"
                  >
                    {copyingLinkId === it.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : linkCopiedId === it.id ? (
                      <Check size={13} className="text-forest-600" />
                    ) : (
                      <Link2 size={13} />
                    )}
                    {linkCopiedId === it.id
                      ? t('itineraries.linkCopied', 'Lien copié !')
                      : t('itineraries.copyLink', 'Copier le lien à envoyer')}
                  </button>
                  <ExpenseSplitter itineraryId={it.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
