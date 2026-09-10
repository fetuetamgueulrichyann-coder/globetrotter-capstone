import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, Send, Star, Trash2, UserCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, resolveImageUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Post } from '../types';
import CommentSection from './CommentSection';

interface Props {
  post: Post;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  onUnfavorited?: () => void;
}

export default function PostCard({ post, canDelete, onDelete, onUnfavorited }: Props) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isFavorited, setIsFavorited] = useState(post.isFavorited);
  const [favBusy, setFavBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount ?? 0);

  // Garde-fous : certaines réponses API (notamment /favorites) peuvent renvoyer
  // un post dont l'auteur ou les images n'ont pas été correctement hydratés côté
  // backend. Sans ces valeurs par défaut, post.author.name ou post.images.length
  // plantent tout le rendu React (écran blanc, toute l'appli devient inutilisable).
  const author = post.author ?? { id: '', name: t('common.unknownUser', 'Utilisateur'), avatarUrl: '' };
  const images = post.images ?? [];

  const dateLabel = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString(i18n.language, {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  async function toggleFavorite() {
    if (!user || favBusy) return;
    setFavBusy(true);
    try {
      const res = isFavorited ? await api.removeFavorite(post.id) : await api.addFavorite(post.id);
      setIsFavorited(res.data.isFavorited);
      if (!res.data.isFavorited) onUnfavorited?.();
    } catch {
      // silencieux
    } finally {
      setFavBusy(false);
    }
  }

  return (
    <article className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden animate-fadeInUp">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {author.avatarUrl ? (
            <img src={author.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-forest-50 flex items-center justify-center shrink-0">
              <UserCircle2 size={20} className="text-forest-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-elegant truncate">{author.name}</p>
            <p className="text-xs text-elegant/40">{dateLabel}</p>
          </div>
        </div>
        {user && author.id && author.id !== user.id && (
          <button
            onClick={() => navigate(`/messages?with=${author.id}`)}
            title={t('feed.writeToAuthor', 'Écrire à cet utilisateur')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-forest-600/30 text-forest-600 text-xs font-semibold hover:bg-forest-50 transition"
          >
            <Send size={12} /> {t('feed.write', 'Écrire')}
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete?.(post.id)}
            title={t('common.delete')}
            className="text-elegant/30 hover:text-red-500 transition p-1.5 shrink-0"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="relative">
        {images.length > 0 && (
          <div className={`grid gap-0.5 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {images.slice(0, 4).map((img, i) => (
              <div key={i} className="relative aspect-square bg-graylight">
                <img src={resolveImageUrl(img)} alt="" className="w-full h-full object-cover" loading="lazy" />
                {i === 3 && images.length > 4 && (
                  <div className="absolute inset-0 bg-elegant/50 flex items-center justify-center text-white font-semibold">
                    +{images.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {user && (
          <button
            onClick={toggleFavorite}
            disabled={favBusy}
            title={isFavorited ? t('feed.removeFavorite') : t('feed.addFavorite')}
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm transition hover:scale-105 disabled:opacity-60"
          >
            <Star size={18} className={isFavorited ? 'fill-gold-500 text-gold-500' : 'text-elegant/50'} />
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        {post.locationName && (
          <p className="text-sm font-semibold text-forest-600 flex items-center gap-1.5 mb-1">
            <MapPin size={14} /> {post.locationName} <span className="text-elegant/40 font-normal">· {post.city}</span>
          </p>
        )}
        <p className="text-sm text-elegant/80">{post.caption}</p>

        <button
          onClick={() => setCommentsOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-elegant/50 hover:text-forest-600 transition mt-3"
        >
          <MessageCircle size={14} />
          {commentsCount > 0 ? t('feed.commentsCount', { count: commentsCount }) : t('feed.comment')}
        </button>
      </div>

      {commentsOpen && <CommentSection postId={post.id} onCountChange={setCommentsCount} />}
    </article>
  );
}
