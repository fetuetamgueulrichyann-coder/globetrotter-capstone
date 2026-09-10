import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCircle2, Users, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, type Conversation, resolveImageUrl } from '../lib/api';
import { useMessaging } from '../lib/messagingContext';

/**
 * Pour l'instant, MboaTrip n'a qu'une seule source de notifications : les
 * messages non lus. Cette page les liste sous forme de flux de
 * notifications ; cliquer dessus ouvre la conversation correspondante et la
 * marque comme lue (comportement déjà géré par la page Messages).
 */
export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUnread } = useMessaging();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getConversations()
      .then((res) => setConversations(res.data.filter((c) => c.unreadCount > 0)))
      .finally(() => setLoading(false));
  }, []);

  function open(conversationId: string) {
    refreshUnread();
    navigate(`/messages?conversation=${conversationId}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2.5 mb-6">
        <Bell size={20} className="text-forest-600" />
        <h1 className="font-display text-2xl font-bold text-elegant">{t('notifications.title', 'Notifications')}</h1>
      </div>

      {loading ? (
        <p className="text-sm text-elegant/40">{t('common.loading')}</p>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={32} className="mx-auto mb-3 text-elegant/15" />
          <p className="text-sm text-elegant/40">{t('notifications.empty', "Rien de nouveau — tu n'as aucune notification pour l'instant.")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map((c) => (
            <button
              key={c.id} onClick={() => open(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-black/5 hover:border-forest-300 transition text-left"
            >
              {c.type === 'group' ? (
                <div className="w-10 h-10 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
              ) : c.otherUser?.avatarUrl ? (
                <img src={resolveImageUrl(c.otherUser.avatarUrl)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <UserCircle2 size={36} className="text-forest-400 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-elegant truncate">
                  {c.type === 'group'
                    ? t('notifications.newInGroup', '{{title}} — nouveaux messages', { title: c.title || t('messages.generalGroup', 'Discussion générale') })
                    : t('notifications.newFrom', '{{name}} t\'a écrit', { name: c.otherUser?.name || t('common.unknownUser', 'Utilisateur') })}
                </p>
                <p className="text-xs text-elegant/45 truncate">{c.lastMessage?.content}</p>
              </div>
              <span className="w-5 h-5 rounded-full bg-forest-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {c.unreadCount > 9 ? '9+' : c.unreadCount}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
