import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Search, ArrowLeft, UserCircle2, MessageCircle, Trash2, Users, Mic, Square, X as XIcon, Phone, Video, PhoneMissed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, type Conversation, type ChatMessage, resolveImageUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getMessagingSocket } from '../lib/messagingSocket';
import { useMessaging } from '../lib/messagingContext';
import { useCall } from '../lib/callContext';
import type { AuthorIdentity } from '../types';

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Messages() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { refreshUnread } = useMessaging();
  const { startCall } = useCall();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupResults, setGroupResults] = useState<AuthorIdentity[]>([]);
  const [groupMembers, setGroupMembers] = useState<AuthorIdentity[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AuthorIdentity[]>([]);
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const active = conversations.find((c) => c.id === activeId) || null;
  const isGroup = active?.type === 'group';

  const loadConversations = useCallback(() => {
    api.getConversations().then((res) => setConversations(res.data));
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Ouverture directe depuis un profil croisé sur le fil : /messages?with=<userId>
  useEffect(() => {
    const withUserId = searchParams.get('with');
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      setActiveId(conversationId);
      setSearchParams({}, { replace: true });
      return;
    }
    if (!withUserId) return;
    api.startConversation(withUserId).then((res) => {
      setActiveId(res.data.id);
      loadConversations();
      setSearchParams({}, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!activeId) return;
    setOtherTyping(false);
    api.getConversationMessages(activeId).then((res) => {
      setMessages(res.data);
      refreshUnread(); // la lecture marque les messages comme lus côté serveur
    });
  }, [activeId, refreshUnread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Coupe proprement le micro si la page est quittée pendant un enregistrement
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        cancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // ---- Temps réel : réutilise le socket partagé (connecté par MessagingProvider) ----
  useEffect(() => {
    const socket = getMessagingSocket();
    function onNewMessage(payload: { conversationId: string; message: ChatMessage }) {
      if (payload.conversationId === activeId) {
        setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
        setOtherTyping(false);
      }
      loadConversations();
    }
    function onMessageDeleted(payload: { conversationId: string; message: ChatMessage }) {
      if (payload.conversationId === activeId) {
        setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? payload.message : m)));
      }
      loadConversations();
    }
    function onUserTyping(payload: { conversationId: string; userId: string }) {
      if (payload.conversationId !== activeId || payload.userId === user?.id) return;
      setOtherTyping(true);
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
      stopTypingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
    }
    socket.on('new_message', onNewMessage);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('user_typing', onUserTyping);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('user_typing', onUserTyping);
    };
  }, [activeId, loadConversations, user?.id]);

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!activeId || !active) return;
    // Ne ré-émet pas à chaque frappe : au plus une fois toutes les 1,5s.
    if (typingTimeoutRef.current) return;
    const socket = getMessagingSocket();
    socket.emit('typing', { conversationId: activeId, recipientId: active.otherUserId });
    typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 1500);
  }

  // ---- Recherche "alternative" pour démarrer une conversation ----
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const handle = setTimeout(() => {
      api.searchUsers(query.trim()).then((res) => setResults(res.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  // ---- Recherche de membres à ajouter lors de la création d'un groupe ----
  useEffect(() => {
    if (groupQuery.trim().length < 2) { setGroupResults([]); return; }
    const handle = setTimeout(() => {
      api.searchUsers(groupQuery.trim()).then((res) => setGroupResults(res.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [groupQuery]);

  async function handleCreateGroup() {
    if (!groupTitle.trim() || groupMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const res = await api.createGroup(groupTitle.trim(), groupMembers.map((m) => m.id));
      setActiveId(res.data.id);
      setGroupCreateOpen(false);
      setGroupTitle('');
      setGroupMembers([]);
      setGroupQuery('');
      setGroupResults([]);
      loadConversations();
    } finally {
      setCreatingGroup(false);
    }
  }

  async function openWith(userId: string) {
    const res = await api.startConversation(userId);
    setActiveId(res.data.id);
    setNewChatOpen(false);
    setQuery('');
    setResults([]);
    loadConversations();
  }

  async function handleSend() {
    if (!draft.trim() || !activeId || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft('');
    try {
      const res = await api.sendMessage(activeId, content);
      setMessages((prev) => [...prev, res.data]);
      loadConversations();
    } finally {
      setSending(false);
    }
  }

  // ---- Message vocal ----
  async function startRecording() {
    if (!activeId) return;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const duration = recordSeconds;
        setIsRecording(false);
        setRecordSeconds(0);
        if (cancelledRef.current || audioChunksRef.current.length === 0 || !activeId) return;

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setSending(true);
        try {
          const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
          const res = await api.sendVoiceMessage(activeId, blob, duration, ext);
          setMessages((prev) => [...prev, res.data]);
          loadConversations();
        } finally {
          setSending(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setMicError(t('messages.micDenied', "Impossible d'accéder au micro. Vérifie les autorisations de ton navigateur."));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function cancelRecording() {
    cancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  }

  async function handleDeleteConversation(conversationId: string, isGroupChat: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    const confirmText = isGroupChat
      ? t('messages.confirmLeaveGroup', 'Quitter ce groupe ?')
      : t('messages.confirmDeleteConversation', 'Supprimer cette conversation ? Elle ne sera supprimée que pour toi.');
    if (!window.confirm(confirmText)) return;
    await api.deleteConversation(conversationId);
    if (activeId === conversationId) setActiveId(null);
    loadConversations();
  }

  async function handleDeleteMessage(messageId: string) {
    if (!activeId) return;
    if (!window.confirm(t('messages.confirmDeleteMessage', 'Supprimer ce message ?'))) return;
    const res = await api.deleteMessage(activeId, messageId);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? res.data : m)));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[75vh] min-h-[500px] rounded-2xl overflow-hidden border border-black/5 bg-white shadow-sm">
        {/* ---------- LISTE DES CONVERSATIONS ---------- */}
        <div className={`border-r border-black/5 flex-col ${activeId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-black/5 flex items-center justify-between">
            <h1 className="font-display font-bold text-elegant">{t('messages.title', 'Messages')}</h1>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setGroupCreateOpen((v) => !v); setNewChatOpen(false); }}
                className="w-8 h-8 rounded-full bg-graylight text-forest-600 flex items-center justify-center hover:bg-forest-100 transition"
                title={t('messages.newGroup', 'Créer un groupe')}
              >
                <Users size={15} />
              </button>
              <button
                onClick={() => { setNewChatOpen((v) => !v); setGroupCreateOpen(false); }}
                className="w-8 h-8 rounded-full bg-forest-600 text-white flex items-center justify-center hover:bg-forest-700 transition"
                title={t('messages.newConversation', 'Nouveau message')}
              >
                <Search size={15} />
              </button>
            </div>
          </div>

          {groupCreateOpen && (
            <div className="p-3 border-b border-black/5 space-y-2.5">
              <input
                autoFocus value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} maxLength={100}
                placeholder={t('messages.groupNamePlaceholder', 'Nom du groupe')}
                className="w-full px-3 py-2 rounded-lg bg-graylight text-sm outline-none"
              />

              {groupMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {groupMembers.map((m) => (
                    <span key={m.id} className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full bg-forest-50 text-forest-700 text-xs font-medium">
                      {m.avatarUrl ? (
                        <img src={resolveImageUrl(m.avatarUrl)} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <UserCircle2 size={14} />
                      )}
                      {m.name}
                      <button onClick={() => setGroupMembers((prev) => prev.filter((x) => x.id !== m.id))} className="text-forest-400 hover:text-forest-700">
                        <XIcon size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                value={groupQuery} onChange={(e) => setGroupQuery(e.target.value)}
                placeholder={t('messages.searchPlaceholder', 'Rechercher un utilisateur par nom…')}
                className="w-full px-3 py-2 rounded-lg bg-graylight text-sm outline-none"
              />
              {groupResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto">
                  {groupResults.filter((u) => !groupMembers.some((m) => m.id === u.id)).map((u) => (
                    <button key={u.id}
                      onClick={() => { setGroupMembers((prev) => [...prev, u]); setGroupQuery(''); setGroupResults([]); }}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-graylight transition text-left">
                      {u.avatarUrl ? (
                        <img src={resolveImageUrl(u.avatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <UserCircle2 size={28} className="text-forest-400" />
                      )}
                      <span className="text-sm font-medium text-elegant">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !groupTitle.trim() || groupMembers.length === 0}
                className="w-full py-2 rounded-lg bg-forest-600 text-white text-sm font-semibold disabled:opacity-40 transition"
              >
                {creatingGroup ? t('common.loading') : t('messages.createGroup', 'Créer le groupe')}
              </button>
            </div>
          )}

          {newChatOpen && (
            <div className="p-3 border-b border-black/5">
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={t('messages.searchPlaceholder', 'Rechercher un utilisateur par nom…')}
                className="w-full px-3 py-2 rounded-lg bg-graylight text-sm outline-none"
              />
              {results.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {results.map((u) => (
                    <button key={u.id} onClick={() => openWith(u.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-graylight transition text-left">
                      {u.avatarUrl ? (
                        <img src={resolveImageUrl(u.avatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <UserCircle2 size={28} className="text-forest-400" />
                      )}
                      <span className="text-sm font-medium text-elegant">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && !newChatOpen && (
              <div className="p-6 text-center text-sm text-elegant/40">
                <MessageCircle size={28} className="mx-auto mb-2 text-elegant/20" />
                {t('messages.empty', "Aucune conversation pour l'instant. Écris à quelqu'un depuis son profil sur le fil, ou cherche-le ici.")}
              </div>
            )}
            {conversations.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={`w-full group flex items-center gap-3 px-4 py-3 hover:bg-graylight transition text-left border-b border-black/[0.03] ${activeId === c.id ? 'bg-graylight' : ''}`}>
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-elegant truncate">
                      {c.type === 'group' ? (c.title || t('messages.generalGroup', 'Discussion générale')) : (c.otherUser?.name || t('common.unknownUser', 'Utilisateur'))}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-forest-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-elegant/45 truncate">{c.lastMessage?.content || t('messages.noMessagesYet', 'Nouvelle conversation')}</p>
                </div>
                {c.id !== 'general' && (
                  <span
                    role="button"
                    onClick={(e) => handleDeleteConversation(c.id, c.type === 'group', e)}
                    className="opacity-0 group-hover:opacity-100 md:opacity-40 md:group-hover:opacity-100 shrink-0 p-1.5 rounded-lg text-elegant/40 hover:text-red-600 hover:bg-red-50 transition"
                    title={c.type === 'group' ? t('messages.leaveGroup', 'Quitter le groupe') : t('messages.deleteConversation', 'Supprimer la conversation')}
                  >
                    {c.type === 'group' ? <XIcon size={15} /> : <Trash2 size={15} />}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ---------- FENÊTRE DE DISCUSSION ---------- */}
        <div className={`flex-col ${activeId ? 'flex' : 'hidden md:flex'}`}>
          {active ? (
            <>
              <div className="p-4 border-b border-black/5 flex items-center gap-3">
                <button onClick={() => setActiveId(null)} className="md:hidden text-elegant/50">
                  <ArrowLeft size={18} />
                </button>
                {isGroup ? (
                  <div className="w-9 h-9 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                ) : active.otherUser?.avatarUrl ? (
                  <img src={resolveImageUrl(active.otherUser.avatarUrl)} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <UserCircle2 size={32} className="text-forest-400" />
                )}
                <div>
                  <p className="font-semibold text-elegant text-sm">
                    {isGroup ? (active.title || t('messages.generalGroup', 'Discussion générale')) : active.otherUser?.name}
                  </p>
                  {isGroup && (
                    <p className="text-[11px] text-elegant/40">{t('messages.generalGroupSubtitle', 'Ouvert à tous les membres de MboaTrip')}</p>
                  )}
                </div>
                {!isGroup && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => startCall(active.id, 'audio', active.otherUser)}
                      className="w-9 h-9 rounded-full bg-graylight text-forest-600 hover:bg-forest-100 transition flex items-center justify-center"
                      title={t('messages.callAudio', 'Appel vocal')}
                    >
                      <Phone size={16} />
                    </button>
                    <button
                      onClick={() => startCall(active.id, 'video', active.otherUser)}
                      className="w-9 h-9 rounded-full bg-graylight text-forest-600 hover:bg-forest-100 transition flex items-center justify-center"
                      title={t('messages.callVideo', 'Appel vidéo')}
                    >
                      <Video size={16} />
                    </button>
                  </div>
                )}
              </div>
              {otherTyping && !isGroup && (
                <p className="px-4 pt-2 text-xs text-forest-600 font-medium flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-forest-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-forest-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-forest-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {t('messages.typing', 'est en train d\'écrire…')}
                </p>
              )}

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-graylight/40">
                {messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  const showGroupAvatar = isGroup && !mine;
                  return (
                    <div key={m.id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {showGroupAvatar && (
                        m.sender?.avatarUrl ? (
                          <img src={resolveImageUrl(m.sender.avatarUrl)} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mb-0.5" />
                        ) : (
                          <UserCircle2 size={22} className="text-forest-400 shrink-0 mb-0.5" />
                        )
                      )}
                      <div className={`group relative max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        mine ? 'bg-forest-600 text-white rounded-br-sm' : 'bg-white text-elegant border border-black/5 rounded-bl-sm'
                      }`}>
                        {isGroup && !mine && (
                          <p className="text-[11px] font-semibold mb-0.5 text-forest-600">{m.sender?.name || t('common.unknownUser', 'Utilisateur')}</p>
                        )}
                        {m.type === 'voice' && !m.deleted ? (
                          <div className="flex items-center gap-2 min-w-[180px]">
                            <audio controls preload="none" src={resolveImageUrl(m.audioUrl || '')} className="h-9 max-w-[220px]" />
                            {!!m.durationSeconds && <span className="text-[11px] opacity-70 shrink-0">{formatDuration(m.durationSeconds)}</span>}
                          </div>
                        ) : m.type === 'call' && !m.deleted ? (
                          <div className="flex items-center gap-1.5">
                            {m.callStatus === 'missed' || m.callStatus === 'declined' ? (
                              <PhoneMissed size={14} className="text-red-500 shrink-0" />
                            ) : m.callKind === 'video' ? (
                              <Video size={14} className="shrink-0" />
                            ) : (
                              <Phone size={14} className="shrink-0" />
                            )}
                            <span>
                              {m.content}
                              {m.callStatus === 'completed' && !!m.durationSeconds && ` · ${formatDuration(m.durationSeconds)}`}
                            </span>
                          </div>
                        ) : (
                          <p className={m.deleted ? 'italic opacity-60' : ''}>{m.content}</p>
                        )}
                        {mine && !m.deleted && (
                          <button
                            onClick={() => handleDeleteMessage(m.id)}
                            className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-elegant/30 hover:text-red-600 transition"
                            title={t('messages.deleteMessage', 'Supprimer ce message')}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {micError && <p className="px-3 pt-2 text-xs text-red-500">{micError}</p>}

              <div className="p-3 border-t border-black/5 flex items-center gap-2">
                {isRecording ? (
                  <>
                    <button
                      onClick={cancelRecording}
                      className="w-10 h-10 rounded-full bg-graylight text-elegant/50 flex items-center justify-center hover:text-red-600 transition shrink-0"
                      title={t('messages.cancelRecording', "Annuler l'enregistrement")}
                    >
                      <XIcon size={16} />
                    </button>
                    <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      {t('messages.recording', 'Enregistrement…')} {formatDuration(recordSeconds)}
                    </div>
                    <button
                      onClick={stopRecording}
                      className="w-10 h-10 rounded-full bg-forest-600 text-white flex items-center justify-center hover:bg-forest-700 transition shrink-0"
                      title={t('messages.stopAndSend', 'Arrêter et envoyer')}
                    >
                      <Square size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      value={draft}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder={t('messages.writePlaceholder', 'Écrire un message…')}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-graylight text-sm outline-none"
                    />
                    {draft.trim() ? (
                      <button
                        onClick={handleSend} disabled={sending}
                        className="w-10 h-10 rounded-full bg-forest-600 text-white flex items-center justify-center hover:bg-forest-700 transition disabled:opacity-40 shrink-0"
                      >
                        <Send size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={startRecording} disabled={sending}
                        className="w-10 h-10 rounded-full bg-forest-600 text-white flex items-center justify-center hover:bg-forest-700 transition disabled:opacity-40 shrink-0"
                        title={t('messages.recordVoice', 'Enregistrer un message vocal')}
                      >
                        <Mic size={16} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center text-elegant/30 text-sm">
              {t('messages.selectConversation', 'Choisis une conversation pour commencer')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

