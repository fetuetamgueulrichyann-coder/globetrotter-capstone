import { useEffect, useState } from 'react';
import { Loader2, Send, ThumbsDown, ThumbsUp, Trash2, UserCircle2, Flag, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AuthorIdentity, Comment } from '../types';

export default function CommentSection({ postId, onCountChange }: { postId: string; onCountChange?: (n: number) => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api.getComments(postId).then((res) => {
      setComments(res.data);
      onCountChange?.(res.data.length);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function handleAdd() {
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    try {
      const res = await api.addComment(postId, content);
      setComments((prev) => {
        const next = [...prev, res.data];
        onCountChange?.(next.length);
        return next;
      });
      setText('');
    } catch {
      // silencieux : l'utilisateur peut réessayer
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteComment(id).catch(() => {});
    setComments((prev) => {
      const next = prev.filter((c) => c.id !== id);
      onCountChange?.(next.length);
      return next;
    });
  }

  function handleVoteUpdate(id: string, patch: Partial<Comment>) {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="border-t border-black/5 px-4 py-3 space-y-3">
      {loading ? (
        <p className="text-xs text-elegant/40">{t('comments.loading')}</p>
      ) : (
        comments.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            canDelete={user?.id !== undefined && c.author.id === user.id}
            onDelete={handleDelete}
            onVoteUpdate={handleVoteUpdate}
          />
        ))
      )}

      {user ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={t('comments.writePlaceholder')}
            maxLength={500}
            className="flex-1 px-3 py-2 rounded-full bg-graylight border border-black/5 focus:border-forest-500 outline-none text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={posting || !text.trim()}
            className="w-8 h-8 rounded-full bg-forest-600 hover:bg-forest-700 text-white flex items-center justify-center transition disabled:opacity-40 shrink-0"
          >
            {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-elegant/40">{t('comments.loginToComment')}</p>
      )}
    </div>
  );
}

function CommentRow({
  comment, canDelete, onDelete, onVoteUpdate,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onVoteUpdate: (id: string, patch: Partial<Comment>) => void;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [votersOpen, setVotersOpen] = useState<'helpful' | 'unhelpful' | null>(null);
  const [voters, setVoters] = useState<{ helpful: AuthorIdentity[]; unhelpful: AuthorIdentity[] } | null>(null);
  const [reported, setReported] = useState(false);

  async function handleReport() {
    if (!user || reported) return;
    try {
      await api.reportComment(comment.id);
      setReported(true);
    } catch {
      // silencieux
    }
  }

  async function vote(value: 'helpful' | 'unhelpful') {
    if (!user) return;
    const res = comment.myVote === value ? await api.removeVote(comment.id) : await api.voteOnComment(comment.id, value);
    onVoteUpdate(comment.id, res.data as Partial<Comment>);
  }

  async function openVoters(kind: 'helpful' | 'unhelpful') {
    if (votersOpen === kind) { setVotersOpen(null); return; }
    setVotersOpen(kind);
    if (!voters) {
      const res = await api.getCommentVoters(comment.id);
      setVoters(res.data);
    }
  }

  return (
    <div>
      <div className="flex items-start gap-2.5">
        {comment.author.avatarUrl ? (
          <img src={comment.author.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-forest-50 flex items-center justify-center shrink-0">
            <UserCircle2 size={16} className="text-forest-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="bg-graylight rounded-2xl px-3 py-2 inline-block max-w-full">
            <p className="text-xs font-semibold text-elegant">{comment.author.name}</p>
            <p className="text-sm text-elegant/80 break-words">{comment.content}</p>
          </div>

          <div className="flex items-center gap-3 mt-1 pl-1">
            <button
              onClick={() => vote('helpful')}
              className={`flex items-center gap-1 text-xs transition ${comment.myVote === 'helpful' ? 'text-forest-600 font-semibold' : 'text-elegant/40 hover:text-elegant'}`}
            >
              <ThumbsUp size={12} /> 👍🏽
            </button>
            <button
              onClick={() => vote('unhelpful')}
              className={`flex items-center gap-1 text-xs transition ${comment.myVote === 'unhelpful' ? 'text-red-500 font-semibold' : 'text-elegant/40 hover:text-elegant'}`}
            >
              <ThumbsDown size={12} /> 👎🏽
            </button>
            {canDelete && (
              <button onClick={() => onDelete(comment.id)} className="text-xs text-elegant/30 hover:text-red-500 transition">
                <Trash2 size={12} />
              </button>
            )}
            {!canDelete && user && (
              <button
                onClick={handleReport}
                disabled={reported}
                title={reported ? t('comments.reported', 'Signalé') : t('comments.report', 'Signaler')}
                className={`text-xs transition ${reported ? 'text-gold-600' : 'text-elegant/25 hover:text-red-500'}`}
              >
                {reported ? <Check size={12} /> : <Flag size={12} />}
              </button>
            )}
          </div>

          {(comment.helpfulCount > 0 || comment.unhelpfulCount > 0) && (
            <div className="pl-1 mt-1 space-y-0.5">
              {comment.helpfulCount > 0 && (
                <button onClick={() => openVoters('helpful')} className="block text-xs text-elegant/50 hover:text-forest-600 transition">
                  {t('comments.foundHelpful', { count: comment.helpfulCount })}
                </button>
              )}
              {comment.unhelpfulCount > 0 && (
                <button onClick={() => openVoters('unhelpful')} className="block text-xs text-elegant/50 hover:text-red-500 transition">
                  {t('comments.foundUnhelpful', { count: comment.unhelpfulCount })}
                </button>
              )}
            </div>
          )}

          {votersOpen && voters && (
            <div className="pl-1 mt-1.5 flex flex-wrap gap-2">
              {voters[votersOpen].map((v) => (
                <span key={v.id} className="flex items-center gap-1.5 bg-graylight rounded-full pl-1 pr-2.5 py-1">
                  {v.avatarUrl ? (
                    <img src={v.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <UserCircle2 size={16} className="text-forest-400" />
                  )}
                  <span className="text-xs text-elegant/70">{v.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
