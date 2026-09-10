import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon, UserCircle2, Globe, Bell, Lock, Trash2, Info, Loader2, Check, AlertTriangle, KeyRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AccountModal from '../components/AccountModal';

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-black/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={17} className="text-forest-600" />
        <h2 className="text-sm font-bold text-elegant">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  // ---- Mot de passe ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // ---- Notifications & confidentialité ----
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
  const [messagingPrivacy, setMessagingPrivacy] = useState(user?.messagingPrivacy ?? 'everyone');
  const [prefSaving, setPrefSaving] = useState(false);

  // ---- Suppression de compte ----
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    setPwSaving(true);
    try {
      await api.changeMyPassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwError(err instanceof ApiRequestError ? err.message : t('common.retryError'));
    } finally {
      setPwSaving(false);
    }
  }

  async function updatePreference(patch: { notificationsEnabled?: boolean; messagingPrivacy?: 'everyone' | 'nobody' }) {
    setPrefSaving(true);
    try {
      await api.updateMyProfile(patch);
      await refresh();
    } finally {
      setPrefSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await api.deleteMyAccount();
      logout();
      navigate('/');
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <SettingsIcon size={20} className="text-forest-600" />
        <h1 className="font-display text-2xl font-bold text-elegant">{t('settings.title', 'Paramètres')}</h1>
      </div>

      <div className="space-y-5">
        {/* ---- Compte ---- */}
        <Section icon={UserCircle2} title={t('settings.account', 'Compte')}>
          <p className="text-sm text-elegant/60 mb-3">{user.name} · {user.email}</p>
          <button
            onClick={() => setAccountOpen(true)}
            className="text-sm font-semibold text-forest-600 hover:text-forest-700 transition mb-5"
          >
            {t('settings.editProfile', 'Modifier mon nom et ma photo')}
          </button>

          <form onSubmit={handleChangePassword} className="pt-4 border-t border-black/5 space-y-2.5">
            <p className="text-xs font-semibold text-elegant/60 flex items-center gap-1.5"><KeyRound size={13} /> {t('settings.changePassword', 'Changer mon mot de passe')}</p>
            <input
              type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required
              placeholder={t('settings.currentPassword', 'Mot de passe actuel')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 outline-none text-sm"
            />
            <input
              type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
              placeholder={t('settings.newPassword', 'Nouveau mot de passe (8 caractères min.)')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 outline-none text-sm"
            />
            {pwError && <p className="text-xs text-red-500">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-forest-600 flex items-center gap-1"><Check size={12} /> {t('settings.passwordUpdated', 'Mot de passe mis à jour.')}</p>}
            <button
              type="submit" disabled={pwSaving}
              className="px-4 py-2 rounded-lg bg-forest-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {pwSaving && <Loader2 size={13} className="animate-spin" />} {t('settings.updatePassword', 'Mettre à jour')}
            </button>
          </form>
        </Section>

        {/* ---- Langue ---- */}
        <Section icon={Globe} title={t('settings.language', 'Langue')}>
          <p className="text-xs text-elegant/45 mb-3">{t('settings.languageHint', 'Ce réglage est aussi accessible à tout moment en haut de l\'application.')}</p>
          <LanguageSwitcher />
        </Section>

        {/* ---- Notifications ---- */}
        <Section icon={Bell} title={t('settings.notifications', 'Notifications')}>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-elegant/70">{t('settings.notificationsToggle', 'Recevoir des notifications de nouveaux messages')}</span>
            <input
              type="checkbox" checked={notificationsEnabled} disabled={prefSaving}
              onChange={(e) => { setNotificationsEnabled(e.target.checked); updatePreference({ notificationsEnabled: e.target.checked }); }}
              className="w-5 h-5 accent-forest-600"
            />
          </label>
        </Section>

        {/* ---- Confidentialité ---- */}
        <Section icon={Lock} title={t('settings.privacy', 'Confidentialité')}>
          <p className="text-sm text-elegant/70 mb-3">{t('settings.whoCanMessage', 'Qui peut vous envoyer un message ?')}</p>
          <div className="flex gap-2">
            {(['everyone', 'nobody'] as const).map((option) => (
              <button
                key={option} disabled={prefSaving}
                onClick={() => { setMessagingPrivacy(option); updatePreference({ messagingPrivacy: option }); }}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  messagingPrivacy === option ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60'
                }`}
              >
                {option === 'everyone' ? t('settings.everyone', 'Tout le monde') : t('settings.nobody', 'Personne')}
              </button>
            ))}
          </div>
        </Section>

        {/* ---- Données / suppression de compte ---- */}
        <Section icon={AlertTriangle} title={t('settings.data', 'Données')}>
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 transition"
            >
              <Trash2 size={14} /> {t('settings.deleteAccount', 'Supprimer mon compte')}
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-700 mb-3">
                {t('settings.deleteConfirm', "Cette action est définitive : tu ne pourras plus te connecter avec ce compte. Confirmer la suppression ?")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount} disabled={deleting}
                  className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleting && <Loader2 size={13} className="animate-spin" />} {t('settings.confirmDelete', 'Oui, supprimer')}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3.5 py-2 rounded-lg border border-black/10 text-elegant/60 text-xs font-semibold"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ---- À propos ---- */}
        <Section icon={Info} title={t('settings.about', 'À propos')}>
          <p className="text-sm text-elegant/60 mb-2">MboaTrip — {t('settings.version', 'version')} 1.0</p>
          <a href="/a-propos" className="text-sm font-semibold text-forest-600 hover:text-forest-700 transition">
            {t('settings.aboutLink', "En savoir plus sur MboaTrip")}
          </a>
        </Section>
      </div>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
