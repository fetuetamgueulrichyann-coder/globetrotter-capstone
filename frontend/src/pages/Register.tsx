import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { ApiRequestError } from '../lib/api';
import {
  Mountain, User, Mail, Lock, Landmark, Palette, Waves, TreePine,
  UtensilsCrossed, Building2, ArrowRight,
} from 'lucide-react';

const PREFERENCE_ICONS: Record<string, typeof Landmark> = {
  culture: Landmark, artisanat: Palette, plage: Waves, nature: TreePine,
  montagne: Mountain, gastronomie: UtensilsCrossed, urbain: Building2, patrimoine: Landmark,
};
const PREFERENCE_KEYS = ['culture', 'artisanat', 'plage', 'nature', 'montagne', 'gastronomie', 'urbain', 'patrimoine'];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function togglePreference(p: string) {
    setPreferences((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await register(name, email, password, preferences);
      navigate('/');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.details) {
          const fe: Record<string, string> = {};
          err.details.forEach((d) => (fe[d.field] = d.message));
          setFieldErrors(fe);
        }
      } else {
        setError(t('register.error'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] relative overflow-hidden">
      <img
        src="/images/hero-mountains.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-15"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-offwhite via-offwhite/95 to-offwhite" />

      <div className="relative z-10 flex justify-center px-6 py-14">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-black/5 p-8 animate-fadeInUp">

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-full overflow-hidden mb-3 shadow-sm">
              <img src="/images/cameroon-flag-icon.webp" alt="" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-display text-2xl font-bold text-elegant">
              {t('register.title')} Mboa<span className="text-gold-500">Trip</span>
            </h1>
            <p className="text-elegant/60 text-sm mt-1">{t('register.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
                <input
                  value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('register.fullName')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                />
              </div>
              {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t('login.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                />
              </div>
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={t('register.passwordPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
                />
              </div>
              {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
            </div>

            <div className="pt-1">
              <p className="text-xs font-mono text-forest-600 tracking-wide mb-2.5">{t('register.interests')}</p>
              <div className="grid grid-cols-2 gap-2">
                {PREFERENCE_KEYS.map((key) => {
                  const Icon = PREFERENCE_ICONS[key];
                  return (
                    <button
                      type="button" key={key} onClick={() => togglePreference(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition ${
                        preferences.includes(key)
                          ? 'bg-forest-600 text-white border-forest-600'
                          : 'border-black/10 text-elegant/60 hover:border-forest-400'
                      }`}
                    >
                      <Icon size={14} /> {t(`preferences.${key}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-forest-600/20 mt-2"
            >
              {loading ? t('register.creating') : <>{t('register.createAccount')} <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-elegant/60 mt-5">
            {t('register.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-forest-600 font-semibold hover:underline">{t('nav.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
