import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, MessageSquareWarning, ImagePlus, LogOut, Trash2, Loader2, Check, ShieldCheck, CalendarCheck, Flag, UserPlus, MapPinPlus, X as XIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, ApiRequestError, resolveImageUrl } from '../lib/api';
import type { Comment, AuthorIdentity, Destination, PlaceSuggestion } from '../types';

type Tab = 'stats' | 'moderation' | 'photos' | 'bookings' | 'guides' | 'suggestions';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-elegant/50 text-sm mb-4">Accès réservé aux administrateurs.</p>
        <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-xl bg-forest-600 text-white text-sm font-semibold">
          Se connecter en admin
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-graylight/60">
      {/* Bandeau dédié à l'administration — délibérément distinct du reste de
          l'appli (fond sombre plutôt que crème) pour qu'on sache toujours
          qu'on est dans un espace de gestion, pas dans l'appli publique. */}
      <div className="bg-elegant">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center">
              <ShieldCheck size={19} className="text-gold-400" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-white leading-tight">Administration</h1>
              <p className="text-[11px] text-white/40">MboaTrip · {user.name}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white transition px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            { id: 'stats', label: 'Statistiques', Icon: Users },
            { id: 'moderation', label: 'Modération', Icon: MessageSquareWarning },
            { id: 'photos', label: 'Photos des sites', Icon: ImagePlus },
            { id: 'bookings', label: 'Réservations', Icon: CalendarCheck },
            { id: 'guides', label: 'Guides', Icon: UserPlus },
            { id: 'suggestions', label: 'Suggestions de lieu', Icon: MapPinPlus },
          ] as const).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap shrink-0 ${
                tab === id ? 'bg-forest-600 text-white shadow-sm' : 'bg-white text-elegant/50 hover:text-elegant border border-black/5'
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 sm:p-6">
          {tab === 'stats' && <StatsTab />}
          {tab === 'moderation' && <ModerationTab />}
          {tab === 'photos' && <PhotosTab />}
          {tab === 'bookings' && <BookingsTab />}
          {tab === 'guides' && <GuidesTab />}
          {tab === 'suggestions' && <SuggestionsTab />}
        </div>
      </div>
    </div>
  );
}

// ============================================================ STATS ====

function StatsTab() {
  const [stats, setStats] = useState<{ usersCount: number; legacyUsersCount: number } | null>(null);
  const [social, setSocial] = useState<{ postsCount: number; commentsCount: number } | null>(null);
  const [legacyInput, setLegacyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function load() {
    api.getAdminUserStats().then((res) => { setStats(res.data); setLegacyInput(String(res.data.legacyUsersCount)); });
    api.getAdminSocialStats().then((res) => setSocial(res.data));
  }

  useEffect(load, []);

  async function saveLegacy() {
    const n = parseInt(legacyInput, 10);
    if (Number.isNaN(n) || n < 0) return;
    setSaving(true);
    try {
      await api.setAdminLegacyUsersCount(n);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      load();
    } finally {
      setSaving(false);
    }
  }

  const totalUsers = (stats?.usersCount || 0) + (stats?.legacyUsersCount || 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <StatCard label="Utilisateurs (app actuelle)" value={stats?.usersCount} Icon={Users} />
      <StatCard label="Publications" value={social?.postsCount} Icon={ImagePlus} />
      <StatCard label="Commentaires" value={social?.commentsCount} Icon={MessageSquareWarning} />

      <div className="sm:col-span-3 p-5 rounded-xl border border-black/[0.03] bg-graylight/70">
        <p className="text-sm font-semibold text-elegant mb-1">Utilisateurs de l'ancienne version</p>
        <p className="text-xs text-elegant/50 mb-3">
          Aucune donnée de l'ancien déploiement n'est accessible automatiquement — indique ici le nombre que tu
          connais (ex. depuis les statistiques d'hébergement) pour l'ajouter au total.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} value={legacyInput} onChange={(e) => setLegacyInput(e.target.value)}
            className="w-32 px-3 py-2 rounded-lg bg-graylight text-sm outline-none"
          />
          <button onClick={saveLegacy} disabled={saving}
            className="px-3 py-2 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : savedFlash ? <Check size={13} /> : null}
            Enregistrer
          </button>
        </div>
        <p className="mt-4 text-sm text-elegant/70">
          Total combiné (actuel + ancienne version) : <span className="font-bold text-elegant">{totalUsers}</span>
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon }: { label: string; value?: number; Icon: any }) {
  return (
    <div className="p-5 rounded-xl bg-graylight/70 border border-black/[0.03]">
      <div className="w-9 h-9 rounded-lg bg-forest-600/10 flex items-center justify-center mb-3">
        <Icon size={16} className="text-forest-600" />
      </div>
      <p className="text-3xl font-display font-bold text-elegant">{value ?? '—'}</p>
      <p className="text-xs text-elegant/50 mt-1">{label}</p>
    </div>
  );
}

// ======================================================= MODERATION ====

type AdminComment = Comment & { author: AuthorIdentity; postCaption: string | null; postId: string; reportCount: number };

function ModerationTab() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getAdminAllComments().then((res) => setComments(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.adminDeleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : 'Suppression impossible.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p className="text-sm text-elegant/40">Chargement…</p>;
  if (comments.length === 0) return <p className="text-sm text-elegant/40">Aucun commentaire pour l'instant.</p>;

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className={`flex items-start gap-3 p-4 rounded-xl border ${c.reportCount > 0 ? 'border-red-200 bg-red-50/40' : 'border-black/[0.03] bg-graylight/70'}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {c.author?.avatarUrl && (
                <img src={resolveImageUrl(c.author.avatarUrl)} alt="" className="w-6 h-6 rounded-full object-cover" />
              )}
              <span className="text-sm font-semibold text-elegant">{c.author?.name || 'Utilisateur'}</span>
              {c.postCaption && <span className="text-xs text-elegant/35">sur « {c.postCaption.slice(0, 40)} »</span>}
              {c.reportCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <Flag size={10} /> Signalé ×{c.reportCount}
                </span>
              )}
            </div>
            <p className="text-sm text-elegant/70">{c.content}</p>
          </div>
          <button
            onClick={() => handleDelete(c.id)} disabled={deletingId === c.id}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition disabled:opacity-50"
            title="Supprimer ce commentaire"
          >
            {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      ))}
    </div>
  );
}

// ===================================================== PHOTOS DES SITES

// Mêmes destinations que celles couvertes par MboaTrip — voir HamburgerMenu.tsx.
const DESTINATION_IDS = [
  { id: 'd12', label: 'Bafoussam' },
  { id: 'd13', label: 'Bandjoun' },
  { id: 'd20', label: 'Douala' },
];

function PhotosTab() {
  const [destId, setDestId] = useState(DESTINATION_IDS[0].id);
  const [dest, setDest] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.getDestination(destId).then((res) => setDest(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [destId]);

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {DESTINATION_IDS.map((d) => (
          <button key={d.id} onClick={() => setDestId(d.id)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
              destId === d.id ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60'
            }`}>
            {d.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-elegant/40">Chargement…</p>}
      {!loading && dest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dest.pointsOfInterest?.map((poi, i) => (
            <PoiPhotoEditor key={i} destId={destId} poiIndex={i} poi={poi} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoiPhotoEditor({
  destId, poiIndex, poi, onSaved,
}: { destId: string; poiIndex: number; poi: { name: string; imageUrl: string; images?: string[] }; onSaved: () => void }) {
  const [imageUrl, setImageUrl] = useState(poi.imageUrl);
  const [imagesText, setImagesText] = useState((poi.images || []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const images = imagesText.split('\n').map((s) => s.trim()).filter(Boolean);
      await api.adminUpdatePoiPhotos(destId, poiIndex, { imageUrl, images });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Échec de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 rounded-xl border border-black/[0.03] bg-graylight/70">
      <div className="flex gap-3 mb-3">
        {imageUrl && <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
        <div className="min-w-0">
          <p className="font-semibold text-elegant text-sm">{poi.name}</p>
          <p className="text-xs text-elegant/40">Point d'intérêt #{poiIndex + 1}</p>
        </div>
      </div>

      <label className="block text-xs font-medium text-elegant/60 mb-1">URL photo principale</label>
      <input
        value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-graylight text-xs outline-none"
        placeholder="https://…"
      />

      <label className="block text-xs font-medium text-elegant/60 mb-1">Galerie (une URL par ligne)</label>
      <textarea
        value={imagesText} onChange={(e) => setImagesText(e.target.value)} rows={3}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-graylight text-xs outline-none resize-none"
        placeholder="https://…&#10;https://…"
      />

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className="px-3 py-1.5 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
        {saving ? <Loader2 size={12} className="animate-spin" /> : savedFlash ? <Check size={12} /> : null}
        Enregistrer
      </button>
    </div>
  );
}

// ===================================================== RÉSERVATIONS ====

const STATUS_LABEL: Record<string, string> = { pending: 'En attente', confirmed: 'Confirmée', cancelled: 'Annulée' };
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gold-100 text-gold-700', confirmed: 'bg-forest-100 text-forest-700', cancelled: 'bg-red-100 text-red-700',
};

function BookingsTab() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getAdminAllBookings().then((res) => setBookings(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled') {
    setBusyId(id);
    try {
      await api.adminUpdateBookingStatus(id, status);
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-elegant/40">Chargement…</p>;
  if (bookings.length === 0) return <p className="text-sm text-elegant/40">Aucune demande de réservation pour l'instant.</p>;

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="p-4 rounded-xl border border-black/[0.03] bg-graylight/70">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold text-elegant text-sm">{b.hotelName}</p>
              <p className="text-xs text-elegant/50">{b.city}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${STATUS_COLOR[b.status]}`}>
              {STATUS_LABEL[b.status]}
            </span>
          </div>
          <p className="text-xs text-elegant/60 mb-1">
            {b.checkIn} → {b.checkOut} · {b.guests} personne(s)
          </p>
          {b.contactPhone && (
            <a href={`tel:${b.contactPhone}`} className="text-xs text-forest-600 font-semibold">{b.contactPhone}</a>
          )}
          {b.status === 'pending' && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => setStatus(b.id, 'confirmed')} disabled={busyId === b.id}
                className="px-3 py-1.5 rounded-lg bg-forest-600 text-white text-xs font-semibold disabled:opacity-50">
                Confirmer
              </button>
              <button onClick={() => setStatus(b.id, 'cancelled')} disabled={busyId === b.id}
                className="px-3 py-1.5 rounded-lg border border-black/10 text-elegant/60 text-xs font-semibold disabled:opacity-50">
                Annuler
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ========================================================= GUIDES ====

const GUIDE_CITIES = ['Bandjoun', 'Bafoussam', 'Ouest', 'Douala'];

function GuidesTab() {
  const [city, setCity] = useState('Douala');
  const [guides, setGuides] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.getGuides(city).then((res) => setGuides(res.data)).catch(() => setGuides([]));
  }

  useEffect(load, [city]);

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.adminCreateGuide({ name: name.trim(), phone: phone.trim(), city, specialty: specialty.trim(), bio: bio.trim(), photoUrl: photoUrl.trim() });
      setName(''); setPhone(''); setSpecialty(''); setBio(''); setPhotoUrl('');
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Échec de l'ajout.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.adminDeleteGuide(id).catch(() => {});
    load();
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {GUIDE_CITIES.map((c) => (
          <button key={c} onClick={() => setCity(c)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
              city === c ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60'
            }`}>
            {c}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-xl border border-black/[0.03] bg-graylight/70 mb-6">
        <p className="text-sm font-semibold text-elegant mb-3">Ajouter un guide vérifié — {city}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom complet" className="px-3 py-2 rounded-lg bg-graylight text-sm outline-none" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (+237…)" className="px-3 py-2 rounded-lg bg-graylight text-sm outline-none" />
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Spécialité (ex: randonnée, chefferies)" className="px-3 py-2 rounded-lg bg-graylight text-sm outline-none" />
          <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="URL photo (optionnel)" className="px-3 py-2 rounded-lg bg-graylight text-sm outline-none" />
        </div>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Petite bio (optionnel)" className="w-full mb-2 px-3 py-2 rounded-lg bg-graylight text-sm outline-none resize-none" />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button onClick={handleAdd} disabled={saving || !name.trim() || !phone.trim()}
          className="px-3.5 py-2 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} Ajouter
        </button>
      </div>

      <div className="space-y-2">
        {guides.map((g) => (
          <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-black/[0.03] bg-graylight/70">
            <div>
              <p className="text-sm font-semibold text-elegant">{g.name} <span className="text-elegant/40 font-normal">· {g.phone}</span></p>
              {g.specialty && <p className="text-xs text-elegant/50">{g.specialty}</p>}
            </div>
            <button onClick={() => handleDelete(g.id)} className="text-elegant/30 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {guides.length === 0 && <p className="text-sm text-elegant/40">Aucun guide pour {city} pour l'instant.</p>}
      </div>
    </div>
  );
}

const SUGGESTION_FILTERS = ['pending', 'approved', 'rejected'] as const;
const SUGGESTION_FILTER_LABELS: Record<(typeof SUGGESTION_FILTERS)[number], string> = {
  pending: 'En attente', approved: 'Ajoutés', rejected: 'Non retenus',
};

function SuggestionsTab() {
  const [filter, setFilter] = useState<(typeof SUGGESTION_FILTERS)[number]>('pending');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.getAdminPlaceSuggestions(filter).then((res) => setSuggestions(res.data)).catch(() => setSuggestions([]));
  }

  useEffect(load, [filter]);

  async function handleReview(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    try {
      await api.reviewPlaceSuggestion(id, status);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {SUGGESTION_FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition ${
              filter === f ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60'
            }`}>
            {SUGGESTION_FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.id} className="flex gap-3 p-4 rounded-xl border border-black/[0.03] bg-graylight/70">
            {s.photoUrl ? (
              <img src={resolveImageUrl(s.photoUrl)} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-graylight flex items-center justify-center shrink-0">
                <MapPinPlus size={20} className="text-elegant/25" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-elegant">{s.name} {s.city && <span className="text-elegant/40 font-normal">· {s.city}</span>}</p>
              <p className="text-xs text-elegant/50 mt-0.5 line-clamp-2">{s.description}</p>
              <p className="text-[11px] text-elegant/35 mt-1">Envoyé par {s.author?.name || 'Utilisateur'}</p>
            </div>
            {filter === 'pending' && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => handleReview(s.id, 'approved')} disabled={busyId === s.id}
                  className="w-8 h-8 rounded-lg bg-forest-100 text-forest-600 flex items-center justify-center hover:bg-forest-200 transition disabled:opacity-50"
                  title="Ajouter aux destinations"
                >
                  {busyId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button
                  onClick={() => handleReview(s.id, 'rejected')} disabled={busyId === s.id}
                  className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition disabled:opacity-50"
                  title="Ne pas retenir"
                >
                  <XIcon size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
        {suggestions.length === 0 && (
          <p className="text-sm text-elegant/40">Aucune suggestion {SUGGESTION_FILTER_LABELS[filter].toLowerCase()} pour l'instant.</p>
        )}
      </div>

      {filter === 'pending' && suggestions.length > 0 && (
        <p className="text-xs text-elegant/35 mt-4">
          Note : approuver une suggestion ne l'ajoute pas automatiquement dans le catalogue des destinations — cela marque juste la demande comme retenue, à toi de créer la fiche du lieu ensuite.
        </p>
      )}
    </div>
  );
}
