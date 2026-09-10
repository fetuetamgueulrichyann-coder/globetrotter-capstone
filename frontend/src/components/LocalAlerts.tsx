import { useState, useEffect } from 'react';
import { AlertTriangle, X, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Alert {
  id: string; userId: string; city: string; placeName: string; type: string; message: string; createdAt: string;
  author: { id: string; name: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  route: '🛣️ Route', price: '💰 Prix', closed: '🚫 Fermé', other: 'ℹ️ Info',
};

/**
 * Alertes communautaires hyper-locales — signalées par les utilisateurs
 * eux-mêmes (état des routes, prix qui grimpent, lieu fermé). Là où Google
 * Maps Cameroun est souvent périmé, MboaTrip reste à jour grâce à sa
 * communauté.
 */
export default function LocalAlerts({ city }: { city: string }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<'route' | 'price' | 'closed' | 'other'>('route');
  const [placeName, setPlaceName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getAlerts(city).then((res) => setAlerts(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [city]);

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createAlert({ city, placeName: placeName.trim(), type, message: message.trim() });
      setMessage(''); setPlaceName(''); setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Échec de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteAlert(id).catch(() => {});
    load();
  }

  if (loading) return null;
  if (alerts.length === 0 && !user) return null;

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-4">
        <p className="flex items-center gap-1.5 text-xs font-mono text-gold-700 tracking-wider">
          <AlertTriangle size={13} /> ALERTES COMMUNAUTAIRES
        </p>
        {user && (
          <button onClick={() => setFormOpen((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-forest-600">
            <Plus size={13} /> Signaler
          </button>
        )}
      </div>

      {formOpen && (
        <div className="mb-4 p-4 rounded-xl bg-graylight">
          <div className="flex gap-2 mb-2 flex-wrap">
            {(['route', 'price', 'closed', 'other'] as const).map((tKey) => (
              <button key={tKey} onClick={() => setType(tKey)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${type === tKey ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60'}`}>
                {TYPE_LABEL[tKey]}
              </button>
            ))}
          </div>
          <input
            value={placeName} onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Lieu concerné (optionnel)"
            className="w-full mb-2 px-3 py-2 rounded-lg bg-white border border-black/5 text-sm outline-none"
          />
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
            placeholder="Décris l'info en quelques mots…"
            className="w-full mb-2 px-3 py-2 rounded-lg bg-white border border-black/5 text-sm outline-none resize-none"
          />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting || !message.trim()}
            className="px-3 py-1.5 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
            {submitting && <Loader2 size={12} className="animate-spin" />} Publier
          </button>
        </div>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-elegant/35">Aucune alerte récente à {city}.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-gold-50 border border-gold-100">
              <span className="text-xs font-semibold shrink-0">{TYPE_LABEL[a.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-elegant/80">{a.message}</p>
                <p className="text-[11px] text-elegant/40 mt-0.5">
                  {a.placeName && <>{a.placeName} · </>}{a.author?.name || 'Utilisateur'}
                </p>
              </div>
              {user && (user.id === a.userId || user.role === 'admin') && (
                <button onClick={() => handleDelete(a.id)} className="shrink-0 text-elegant/30 hover:text-red-500">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
