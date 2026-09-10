import { useRef, useState, type FormEvent } from 'react';
import { X, Camera, Loader2, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError, resolveImageUrl } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, refresh } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '');
  const [showUrlField, setShowUrlField] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      const res = await api.uploadMyAvatar(file);
      setAvatarPreview(res.data.user.avatarUrl);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('account.avatarUploadError'));
    } finally {
      setUploadingAvatar(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleUseUrl() {
    if (!avatarUrlInput.trim()) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      await api.updateMyProfile({ avatarUrl: avatarUrlInput.trim() });
      setAvatarPreview(avatarUrlInput.trim());
      setShowUrlField(false);
      setAvatarUrlInput('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('account.updateError'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.updateMyProfile({ name, bio });
      await refresh();
      setSaved(true);
      setTimeout(onClose, 700);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('account.updateError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-elegant/40 backdrop-blur-sm px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white border border-black/5 shadow-xl p-6 space-y-4 animate-fadeInUp"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display font-bold text-elegant">{t('account.title')}</h3>
          <button type="button" onClick={onClose} className="text-elegant/40 hover:text-elegant transition">
            <X size={18} />
          </button>
        </div>

        {/* ---- Photo de profil : sélection directe depuis ses propres fichiers ---- */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatarPreview ? (
              <img src={resolveImageUrl(avatarPreview)} alt="" className="w-16 h-16 rounded-full object-cover border border-black/5" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-forest-50 border border-black/5" />
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-elegant/50 flex items-center justify-center">
                <Loader2 size={18} className="text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handlePickFile} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploadingAvatar}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-graylight hover:bg-black/10 transition text-sm font-medium text-elegant disabled:opacity-50"
            >
              <Camera size={14} /> {t('account.choosePhoto')}
            </button>
            <button
              type="button"
              onClick={() => setShowUrlField((s) => !s)}
              className="w-full flex items-center justify-center gap-1 mt-1.5 text-xs text-elegant/40 hover:text-forest-600 transition"
            >
              <Link2 size={11} /> {t('account.useUrlInstead')}
            </button>
          </div>
        </div>

        {showUrlField && (
          <div className="flex gap-2">
            <input
              value={avatarUrlInput} onChange={(e) => setAvatarUrlInput(e.target.value)}
              placeholder="https://…"
              className="flex-1 px-3 py-2 rounded-lg bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
            />
            <button
              type="button" onClick={handleUseUrl} disabled={uploadingAvatar}
              className="px-3 py-2 rounded-lg bg-forest-600 hover:bg-forest-700 text-white text-xs font-semibold transition disabled:opacity-50"
            >
              {t('common.continue')}
            </button>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('account.name')}</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('account.bio')}</label>
          <textarea
            value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && <p className="text-sm text-forest-600">{t('account.saved')}</p>}

        <button
          type="submit" disabled={saving}
          className="w-full py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {saving ? t('account.saving') : t('account.save')}
        </button>
      </form>
    </div>
  );
}
