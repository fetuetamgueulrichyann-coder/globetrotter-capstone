import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, ImagePlus, Loader2, MapPin, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Post } from '../types';
import PostCard from '../components/PostCard';

const CITIES = ['Bandjoun', 'Bafoussam', 'Douala', 'Kribi', 'Yaoundé'] as const;
const PAGE_SIZE = 10;

export default function Feed() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadPage = useCallback(async (offset: number) => {
    const res = await api.getFeed({ limit: PAGE_SIZE, offset });
    setHasMore(res.pagination.hasMore);
    return res.data;
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPage(0).then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  }, [loadPage]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const more = await loadPage(posts.length);
      setPosts((prev) => [...prev, ...more]);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('feed.confirmDelete'))) return;
    await api.deletePost(id).catch(() => {});
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-elegant">{t('feed.title')}</h1>
          <p className="text-sm text-elegant/50">{t('feed.subtitle')}</p>
        </div>
        {user && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="w-10 h-10 rounded-full bg-forest-600 hover:bg-forest-700 text-white flex items-center justify-center transition shrink-0"
            title={t('feed.publish')}
          >
            <ImagePlus size={18} />
          </button>
        )}
      </div>

      {showForm && (
        <CreatePostForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
      )}

      {loading ? (
        <p className="text-center text-sm font-mono text-elegant/40 py-16">{t('feed.loadingFeed')}</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Camera className="mx-auto text-elegant/20 mb-3" size={32} />
          <p className="text-elegant/50">{t('feed.empty')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canDelete={user?.id === post.userId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full mt-6 py-2.5 rounded-xl bg-graylight hover:bg-black/10 text-sm font-medium text-elegant transition disabled:opacity-50"
        >
          {loadingMore ? t('common.loading') : t('feed.seeMore')}
        </button>
      )}
    </div>
  );
}

function CreatePostForm({ onCreated, onCancel }: { onCreated: (p: Post) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [city, setCity] = useState<typeof CITIES[number]>('Bandjoun');
  const [locationName, setLocationName] = useState('');
  const [caption, setCaption] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files || []).slice(0, 6);
    setFiles(chosen);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews(chosen.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (files.length === 0) {
      setError(t('feed.addAtLeastOnePhoto'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createPost({ city, locationName, caption, visitDate, images: files });
      previews.forEach((p) => URL.revokeObjectURL(p));
      onCreated(res.data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('feed.publishError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-black/5 shadow-sm p-5 mb-6 space-y-4 animate-fadeInUp">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-elegant">{t('feed.newPost')}</h3>
        <button type="button" onClick={onCancel} className="text-elegant/40 hover:text-elegant transition">
          <X size={18} />
        </button>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-elegant/70 text-white flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={handleFiles} />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="w-full py-3 rounded-xl border-2 border-dashed border-black/10 text-sm text-elegant/50 hover:border-forest-400 hover:text-forest-600 transition flex items-center justify-center gap-2"
      >
        <ImagePlus size={16} /> {files.length > 0 ? t('feed.changePhotos') : t('feed.addPhotos')}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('feed.city')}</label>
          <select
            value={city} onChange={(e) => setCity(e.target.value as typeof city)}
            className="w-full px-3 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
          >
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-elegant/60 mb-1">{t('feed.visitDate')}</label>
          <input
            type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-elegant/60 mb-1 flex items-center gap-1">
          <MapPin size={12} /> {t('feed.locationVisited')}
        </label>
        <input
          value={locationName} onChange={(e) => setLocationName(e.target.value)}
          placeholder={t('feed.locationPlaceholder')}
          className="w-full px-3 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-elegant/60 mb-1">{t('feed.caption')}</label>
        <textarea
          value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={500} required
          placeholder={t('feed.captionPlaceholder')}
          className="w-full px-3 py-2.5 rounded-xl bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit" disabled={submitting}
        className="w-full py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 size={15} className="animate-spin" />}
        {submitting ? t('feed.publishing') : t('feed.publish')}
      </button>
    </form>
  );
}
