import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, type ChatMessage } from './api';
import { useAuth } from './auth';
import { connectMessagingSocket, disconnectMessagingSocket, getMessagingSocket } from './messagingSocket';

interface MessagingContextValue {
  unreadCount: number;
  refreshUnread: () => void;
}

const MessagingContext = createContext<MessagingContextValue>({ unreadCount: 0, refreshUnread: () => {} });

export function useMessaging() {
  return useContext(MessagingContext);
}

/**
 * Connecte le socket de messagerie une seule fois pour toute l'app (dès que
 * l'utilisateur est connecté) et calcule le nombre total de messages non
 * lus, pour que le badge puisse s'afficher n'importe où (menu, barre de
 * nav) — pas seulement sur la page Messages elle-même. La page Messages
 * réutilise ce même socket partagé plutôt que d'en ouvrir un second.
 */
export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    if (!user) { setUnreadCount(0); return; }
    api.getConversations()
      .then((res) => setUnreadCount(res.data.reduce((sum, c) => sum + (c.unreadCount || 0), 0)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      disconnectMessagingSocket();
      setUnreadCount(0);
      return;
    }

    connectMessagingSocket();
    refreshUnread();

    const socket = getMessagingSocket();
    function onNewMessage(payload: { conversationId: string; message: ChatMessage }) {
      // Un message que j'envoie moi-même ne doit pas s'ajouter à mes non-lus.
      if (payload.message.senderId !== user?.id) {
        refreshUnread();
      }
    }
    socket.on('new_message', onNewMessage);
    return () => { socket.off('new_message', onNewMessage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <MessagingContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </MessagingContext.Provider>
  );
}
