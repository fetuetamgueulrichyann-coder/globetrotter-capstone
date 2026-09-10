import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, MapPin, Star, Phone, Loader2, Check, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { HOTELS } from '../data/places';
import { placeIdFromName } from '../components/PlaceReviews';

/**
 * Page dédiée à la demande de réservation — accessible depuis la fiche d'un
 * hôtel (bouton "Réserver"). MboaTrip n'a pas de passerelle de paiement :
 * cette page envoie une DEMANDE (dates, personnes, contact) qui arrive dans
 * le tableau de bord admin ; l'admin confirme ensuite manuellement avec
 * l'établissement. C'est expliqué clairement pour ne jamais laisser croire
 * à une réservation garantie/payée en ligne.
 */
export default function BookingPage() {
  const { hotelSlug } = useParams<{ hotelSlug: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const hotel = HOTELS.find((h) => placeIdFromName(h.name) === hotelSlug);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [feeAmount, setFeeAmount] = useState(1000);
  const [momoPhone, setMomoPhone] = useState('');
  const [payStep, setPayStep] = useState<'idle' | 'waiting' | 'paid' | 'failed' | 'unavailable'>('idle');
  const [payError, setPayError] = useState<string | null>(null);

  if (!hotel) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-elegant/50 text-sm mb-4">Établissement introuvable.</p>
        <Link to="/" className="text-forest-600 font-semibold text-sm">Retour à l'accueil</Link>
      </div>
    );
  }

  const dateError = checkIn && checkOut && checkOut <= checkIn;

  async function handleSubmit() {
    if (!checkIn || !checkOut || dateError || !hotel) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createBookingRequest({
        hotelName: hotel.name, city: hotel.city, checkIn, checkOut, guests, contactPhone: phone, notes,
      });
      setBookingId(res.data.id);
      setFeeAmount(res.data.feeAmountFcfa ?? 1000);
      setMomoPhone(phone);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Échec de l'envoi. Réessaie dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePay() {
    if (!bookingId || !momoPhone.trim()) return;
    setPayStep('waiting');
    setPayError(null);
    try {
      await api.payBookingFee(bookingId, momoPhone.trim());
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 503) {
        setPayStep('unavailable');
      } else {
        setPayStep('failed');
        setPayError(err instanceof ApiRequestError ? err.message : 'Échec du paiement.');
      }
      return;
    }

    // Le client valide sur son téléphone (push MTN) — on interroge le
    // statut toutes les 3s pendant 90s maximum.
    const started = Date.now();
    const poll = async () => {
      if (Date.now() - started > 90_000) { setPayStep('failed'); setPayError('Délai dépassé — réessaie.'); return; }
      const res = await api.getBookingPaymentStatus(bookingId);
      if (res.data.paymentStatus === 'paid') { setPayStep('paid'); return; }
      if (res.data.paymentStatus === 'failed') { setPayStep('failed'); setPayError('Paiement refusé ou annulé.'); return; }
      setTimeout(poll, 3000);
    };
    poll();
  }

  if (done) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-forest-50 flex items-center justify-center mx-auto mb-5">
            <Check size={28} className="text-forest-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-elegant mb-2">Demande envoyée !</h1>
          <p className="text-elegant/60 text-sm leading-relaxed mb-6">
            Ta demande de réservation pour <span className="font-semibold text-elegant">{hotel.name}</span> a bien
            été transmise. On te recontacte pour confirmer les disponibilités directement avec l'établissement —
            aucun paiement n'a été effectué.
          </p>
          <div className="rounded-2xl bg-graylight p-5 text-left text-sm space-y-1.5 mb-6">
            <p className="flex justify-between"><span className="text-elegant/50">Arrivée</span><span className="font-medium text-elegant">{checkIn}</span></p>
            <p className="flex justify-between"><span className="text-elegant/50">Départ</span><span className="font-medium text-elegant">{checkOut}</span></p>
            <p className="flex justify-between"><span className="text-elegant/50">Personnes</span><span className="font-medium text-elegant">{guests}</span></p>
          </div>

          {/* ---- Frais de réservation via MTN Mobile Money ---- */}
          {payStep === 'paid' ? (
            <div className="mb-8 p-4 rounded-xl bg-forest-50 border border-forest-100 text-sm text-forest-700 font-semibold flex items-center justify-center gap-2">
              <Check size={16} /> Frais de réservation payés ✓
            </div>
          ) : payStep === 'unavailable' ? (
            <p className="mb-8 text-xs text-elegant/40">
              Le paiement Mobile Money n'est pas encore actif — ta demande a bien été envoyée, aucun frais requis pour l'instant.
            </p>
          ) : (
            <div className="mb-8 p-4 rounded-xl bg-gold-50 border border-gold-100 text-left">
              <p className="text-sm font-semibold text-elegant mb-1">Frais de réservation — {feeAmount.toLocaleString('fr-FR')} FCFA</p>
              <p className="text-xs text-elegant/50 mb-3">
                Non remboursables, distincts du prix du séjour (réglé sur place, à l'hôtel). Paiement sécurisé par
                MTN Mobile Money.
              </p>
              <div className="flex gap-2">
                <input
                  value={momoPhone} onChange={(e) => setMomoPhone(e.target.value)} placeholder="Numéro MoMo (+237…)"
                  disabled={payStep === 'waiting'}
                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-black/5 text-sm outline-none disabled:opacity-50"
                />
                <button
                  onClick={handlePay} disabled={payStep === 'waiting' || !momoPhone.trim()}
                  className="px-4 py-2 rounded-lg bg-[#FFCB05] text-elegant text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {payStep === 'waiting' ? <Loader2 size={13} className="animate-spin" /> : null}
                  {payStep === 'waiting' ? 'En attente…' : 'Payer'}
                </button>
              </div>
              {payStep === 'waiting' && (
                <p className="text-xs text-elegant/50 mt-2">Valide le paiement sur ton téléphone (notification MTN MoMo)…</p>
              )}
              {payStep === 'failed' && payError && <p className="text-xs text-red-600 mt-2">{payError}</p>}
            </div>
          )}

          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition"
          >
            <ArrowLeft size={15} /> Retour à la page de {hotel.city}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ---------- EN-TÊTE ---------- */}
      <section className="relative h-64 flex items-end overflow-hidden">
        <img src={hotel.imageUrl} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-elegant/90 via-elegant/40 to-elegant/10" />
        <div className="relative z-10 max-w-2xl mx-auto w-full px-6 pb-6 text-white">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium mb-3 transition">
            <ArrowLeft size={13} /> Retour
          </button>
          <p className="text-gold-400 text-xs font-mono tracking-widest mb-2">DEMANDE DE RÉSERVATION</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1.5">{hotel.name}</h1>
          <div className="flex items-center gap-3 text-sm text-white/75">
            <span className="flex items-center gap-1"><MapPin size={13} /> {hotel.city}</span>
            <span className="flex items-center gap-1">
              {Array.from({ length: hotel.stars }).map((_, i) => <Star key={i} size={12} className="fill-gold-400 text-gold-400" />)}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {hotel.priceInfo && (
          <div className="mb-6 p-4 rounded-xl bg-gold-50 border border-gold-100 text-sm text-gold-800 flex items-start gap-2">
            <span aria-hidden>💰</span> {hotel.priceInfo}
          </div>
        )}

        <div className="mb-8 p-4 rounded-xl bg-graylight text-xs text-elegant/50 leading-relaxed">
          Cette page envoie une <strong className="text-elegant/70">demande</strong> de réservation — aucun paiement
          en ligne n'est effectué. MboaTrip confirme ensuite tes dates directement avec l'établissement et te
          recontacte pour finaliser.
        </div>

        {!user ? (
          <div className="text-center py-10">
            <p className="text-elegant/60 text-sm mb-4">Connecte-toi pour envoyer une demande de réservation.</p>
            <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition">
              Se connecter
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-elegant/70 mb-1.5">Date d'arrivée</label>
                <input
                  type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-elegant/70 mb-1.5">Date de départ</label>
                <input
                  type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                />
              </div>
            </div>
            {dateError && <p className="text-xs text-red-600 -mt-3">La date de départ doit être après la date d'arrivée.</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-elegant/70 mb-1.5">Nombre de personnes</label>
                <input
                  type="number" min={1} value={guests} onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-elegant/70 mb-1.5">Ton téléphone</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/30" />
                  <input
                    value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237…"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-elegant/70 mb-1.5">Précisions (optionnel)</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Type de chambre, occasion particulière, questions…"
                className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              onClick={handleSubmit} disabled={submitting || !checkIn || !checkOut || !!dateError}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-elegant font-bold text-sm transition disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />}
              Envoyer la demande de réservation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
