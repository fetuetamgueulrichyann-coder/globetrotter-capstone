import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [devToken, setDevToken] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message);
      if (res.devResetToken) {
        setDevToken(res.devResetToken);
        setToken(res.devResetToken);
      }
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('common.retryError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('common.retryError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex justify-center px-6 py-16">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-black/5 p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full overflow-hidden mb-3 shadow-sm">
            <img src="/images/cameroon-flag-icon.webp" alt="" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display text-2xl font-bold text-elegant">{t('forgotPassword.title')}</h1>
        </div>

        {step === 'request' && (
          <form onSubmit={handleRequest} className="space-y-3.5">
            <p className="text-elegant/60 text-sm mb-2">
              {t('forgotPassword.intro')}
            </p>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? t('forgotPassword.sending') : <>{t('common.continue')} <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset} className="space-y-3.5">
            <p className="text-elegant/60 text-sm mb-2">{message}</p>

            {devToken && (
              <div className="p-3 rounded-xl bg-gold-300/20 border border-gold-500/30 text-xs text-elegant/70 leading-relaxed">
                <b className="text-elegant">{t('forgotPassword.demoModeLabel')}</b> {t('forgotPassword.demoModeText')}
              </div>
            )}

            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
              <input
                value={token} onChange={(e) => setToken(e.target.value)} required
                placeholder={t('forgotPassword.tokenPlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition font-mono text-xs"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-elegant/40" />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder={t('forgotPassword.newPasswordPlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 focus:bg-white outline-none text-sm transition"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-semibold text-sm transition disabled:opacity-50"
            >
              {loading ? t('forgotPassword.updating') : t('forgotPassword.resetButton')}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center">
            <p className="text-forest-600 font-medium text-sm mb-6">
              ✅ {t('forgotPassword.success')}
            </p>
            <Link to="/login" className="inline-block px-5 py-2.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 transition">
              {t('nav.login')}
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="text-center text-sm text-elegant/50 mt-5">
            <Link to="/login" className="text-forest-600 font-semibold hover:underline">{t('forgotPassword.backToLogin')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
