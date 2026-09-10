import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Post } from '../types';
import PostCard from '../components/PostCard';

export default function Favorites() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyFavorites()
      .then((res) => setPosts(res.data ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  function handleUnfavorited(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-elegant mb-1">{t('favorites.title')}</h1>
      <p className="text-sm text-elegant/50 mb-6">{t('favorites.subtitle')}</p>

      {loading ? (
        <p className="text-center text-sm font-mono text-elegant/40 py-16">{t('common.loading')}</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <Star className="mx-auto text-elegant/20 mb-3" size={32} />
          <p className="text-elegant/50">
            {t('favorites.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onUnfavorited={() => handleUnfavorited(post.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
