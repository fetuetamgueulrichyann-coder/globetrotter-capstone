import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { ApiRequestError } from '../lib/api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import GoogleSignInButton from '../components/GoogleSignInButton';
import {
  Mail, Lock, Eye, EyeOff, MapPin, ShieldCheck, Heart, Leaf,
  Landmark, UtensilsCrossed, BedDouble, ArrowRight, Mountain,
} from 'lucide-react';

const HERO_IMAGE = '/images/hero-mountains.jpg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const FEATURES = [
    { Icon: Mountain, label: t('login.featureDiscover'), sub: t('login.featureDiscoverSub') },
    { Icon: Landmark, label: t('login.featureUnderstand'), sub: t('login.featureUnderstandSub') },
    { Icon: UtensilsCrossed, label: t('login.featureTaste'), sub: t('login.featureTasteSub') },
    { Icon: BedDouble, label: t('login.featureStay'), sub: t('login.featureStaySub') },
  ];

  const TRUST_BADGES = [
    { Icon: ShieldCheck, title: t('login.trustSecure'), sub: t('login.trustSecureSub') },
    { Icon: Heart, title: t('login.trustLove'), sub: t('login.trustLoveSub') },
    { Icon: Leaf, title: t('login.trustLocal'), sub: t('login.trustLocalSub') },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('login.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-body">
      {/* ---------- Fond plein écran ---------- */}
      <img
        src={HERO_IMAGE}
        alt="Route de montagne verdoyante, Ouest Cameroun"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-elegant/80 via-elegant/40 to-elegant/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-elegant/70 via-transparent to-elegant/20" />

      {/* ---------- Sélecteur de langue ---------- */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto w-full px-6 lg:px-10 py-10 items-center">

          {/* ---------- Colonne gauche : identité de marque ---------- */}
          <div className="text-white animate-fadeInUp">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                <img src="/images/cameroon-flag-icon.webp" alt="" className="w-full h-full object-cover" />
              </div>
              <span className="font-display text-2xl font-bold">
                Mboa<span className="text-gold-400">Trip</span>
              </span>
            </div>

            <p className="text-white/80 text-sm mb-6 max-w-sm">
              {t('login.tagline')}
            </p>

            <h1 className="font-display text-4xl lg:text-5xl font-bold leading-tight mb-6">
              {t('login.heroTitle1')}<br />
              <span className="text-forest-400">Camer</span><span className="text-gold-400">oun</span>
            </h1>

            <p className="text-white/75 text-sm max-w-md mb-1 leading-relaxed">
              {t('login.heroSubtitle1')}
            </p>
            <p className="text-gold-400 text-sm max-w-md mb-8 font-medium">
              {t('login.heroSubtitle2')}
            </p>

            <div className="grid grid-cols-4 gap-3 max-w-md mb-8">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex flex-col items-center text-center gap-1.5">
                  <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <f.Icon size={18} strokeWidth={1.8} />
                  </div>
                  <span className="text-xs font-semibold">{f.label}</span>
                  <span className="text-[10px] text-white/60 leading-tight">{f.sub}</span>
                </div>
              ))}
            </div>

            <div className="inline-flex items-center gap-1.5 bg-elegant/50 backdrop-blur-sm border border-white/15 text-white text-xs px-3.5 py-2 rounded-full">
              <MapPin size={13} /> {t('login.badgeLocation', 'Toutes les régions du Cameroun')}
            </div>
          </div>

          {/* ---------- Colonne droite : carte de connexion (glassmorphism) ---------- */}
          <div className="flex justify-center lg:justify-end animate-fadeIn">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/40">

              <div className="flex flex-col items-center text-center mb-5">
              <div className="w-9 h-9 rounded-full overflow-hidden mb-2 shadow-sm">
                <img src="/images/cameroon-flag-icon.webp" alt="" className="w-full h-full object-cover" />
              </div>
                <h2 className="font-display text-2xl font-bold text-elegant">
                  Mboa<span className="text-gold-500">Trip</span>
                </h2>
                <p className="text-forest-600 text-xs font-medium mt-1 tracking-wide">
                  {t('login.miniTagline')}
                </p>
                <p className="text-forest-700 text-sm font-semibold">{t('login.cardTagline', 'Le Cameroun à portée de main')}</p>
                <div className="w-16 h-px bg-gradient-to-r from-forest-500 to-gold-500 my-3" />
                <p className="text-elegant/70 text-sm">{t('login.welcome')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
                  <input
                    type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('login.passwordPlaceholder')}
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                  />
                  <button
                    type="button" onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-elegant/40 hover:text-elegant text-sm"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-1.5 text-elegant/70 cursor-pointer">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-forest-500" />
                    {t('login.rememberMe')}
                  </label>
                  <Link to="/mot-de-passe-oublie" className="text-forest-600 font-medium hover:underline">{t('login.forgotPassword')}</Link>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-forest-600/20"
                >
                  {loading ? t('login.loggingIn') : <>{t('nav.login')} <ArrowRight size={16} /></>}
                </button>

                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-black/10" />
                  <span className="text-[11px] text-elegant/40 font-medium">{t('login.or')}</span>
                  <div className="flex-1 h-px bg-black/10" />
                </div>

                <GoogleSignInButton onError={setError} />
              </form>

              <p className="text-center text-sm text-elegant/60 mt-5">
                {t('login.noAccount')}{' '}
                <Link to="/register" className="text-forest-600 font-semibold hover:underline">{t('login.signUp')}</Link>
              </p>
            </div>
          </div>
        </div>

        {/* ---------- Bandeau de confiance ---------- */}
        <div className="relative bg-forest-900/90 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-6 justify-center sm:justify-between text-white/90">
            {TRUST_BADGES.map((b) => (
              <div key={b.title} className="flex items-center gap-2.5 text-sm">
                <span className="w-8 h-8 rounded-full bg-white/10 border border-gold-400/40 flex items-center justify-center">
                  <b.Icon size={14} />
                </span>
                <div>
                  <p className="font-semibold leading-tight">{b.title}</p>
                  <p className="text-white/60 text-xs leading-tight">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
