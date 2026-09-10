import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { api } from './api';
import type { AuthorIdentity } from '../types';
import { useAuth } from './auth';
import { getMessagingSocket } from './messagingSocket';

export type CallKind = 'audio' | 'video';
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

interface ActiveCall {
  callId: string;
  conversationId: string;
  kind: CallKind;
  peer: AuthorIdentity | null;
}

interface CallContextValue {
  phase: CallPhase;
  call: ActiveCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  durationSeconds: number;
  errorMessage: string | null;
  startCall: (conversationId: string, kind: CallKind, peer: AuthorIdentity | null) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

// STUN public (toujours disponible) + TURN optionnel configurable sans toucher au code.
// Sans TURN, certains appels entre réseaux mobiles très restrictifs peuvent échouer à se
// connecter : voir la note dans le README sur la configuration TURN recommandée en prod.
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }
  return servers;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const callRef = useRef<ActiveCall | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outgoingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCallerRef = useRef(false);

  useEffect(() => { callRef.current = call; }, [call]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescSetRef.current = false;
    isCallerRef.current = false;
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    if (outgoingTimeoutRef.current) clearTimeout(outgoingTimeoutRef.current);
    outgoingTimeoutRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setDurationSeconds(0);
  }, []);

  const resetToIdle = useCallback(() => {
    cleanup();
    setCall(null);
    setPhase('idle');
  }, [cleanup]);

  async function createPeerConnection(kind: CallKind) {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video' ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const remote = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && callRef.current) {
        getMessagingSocket().emit('call:ice', { callId: callRef.current.callId, candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setPhase('active');
        if (!durationTimerRef.current) {
          durationTimerRef.current = setInterval(() => setDurationSeconds((s) => s + 1), 1000);
        }
      }
      if (pc.connectionState === 'failed') {
        setErrorMessage("La connexion a échoué. Vérifie ta connexion internet et réessaie.");
        handleEndCall();
      }
    };

    return pc;
  }

  const startCall = useCallback(async (conversationId: string, kind: CallKind, peer: AuthorIdentity | null) => {
    if (phase !== 'idle' || !user) return;
    setErrorMessage(null);

    const socket = getMessagingSocket();
    if (!socket.connected) {
      // Avant, l'appli affichait quand même "Appel en cours..." pendant 45s
      // sans jamais prévenir que la connexion temps réel n'était même pas
      // active — on le détecte maintenant immédiatement.
      setErrorMessage("Connexion en temps réel indisponible. Vérifie ta connexion internet, ou réessaie dans un instant.");
      return;
    }

    isCallerRef.current = true;
    socket.emit('call:invite', { conversationId, kind });
    setCall({ callId: '', conversationId, kind, peer });
    setPhase('outgoing');

    // Si personne ne répond après 45s, on abandonne proprement côté appelant.
    outgoingTimeoutRef.current = setTimeout(() => {
      if (callRef.current) {
        getMessagingSocket().emit('call:cancel', { callId: callRef.current.callId });
      }
      setErrorMessage("Personne n'a répondu.");
      resetToIdle();
    }, 45000);
  }, [phase, user, resetToIdle]);

  const acceptCall = useCallback(async () => {
    if (!call || phase !== 'incoming') return;
    setPhase('connecting');
    try {
      await createPeerConnection(call.kind);
      getMessagingSocket().emit('call:accept', { callId: call.callId });
    } catch {
      setErrorMessage("Impossible d'accéder au micro/caméra. Vérifie les autorisations de ton navigateur.");
      getMessagingSocket().emit('call:decline', { callId: call.callId });
      resetToIdle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, phase, resetToIdle]);

  const declineCall = useCallback(() => {
    if (!call) return;
    getMessagingSocket().emit('call:decline', { callId: call.callId });
    resetToIdle();
  }, [call, resetToIdle]);

  function handleEndCall() {
    if (callRef.current?.callId) {
      getMessagingSocket().emit('call:end', { callId: callRef.current.callId });
    }
    resetToIdle();
  }

  const endCall = useCallback(() => {
    handleEndCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToIdle]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const next = !isCameraOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setIsCameraOff(next);
  }, [isCameraOff]);

  // ---- Écoute des événements de signalisation ----
  useEffect(() => {
    if (!user) return;
    const socket = getMessagingSocket();

    async function onIncoming(data: { callId: string; conversationId: string; kind: CallKind; callerId: string }) {
      if (callRef.current) {
        // Déjà en ligne ou déjà en train d'appeler : on ne peut pas gérer deux appels à la fois.
        socket.emit('call:decline', { callId: data.callId });
        return;
      }
      let peer: AuthorIdentity | null = null;
      try {
        const res = await api.getUserIdentity(data.callerId);
        peer = res.data;
      } catch { /* nom affiché restera générique si l'identité n'a pas pu être résolue */ }
      isCallerRef.current = false;
      setCall({ callId: data.callId, conversationId: data.conversationId, kind: data.kind, peer });
      setPhase('incoming');
    }

    function onRinging(data: { callId: string }) {
      setCall((prev) => (prev ? { ...prev, callId: data.callId } : prev));
    }

    function onAccepted(data: { callId: string }) {
      if (!callRef.current || data.callId !== callRef.current.callId) return;
      setPhase('connecting');
      (async () => {
        try {
          const pc = await createPeerConnection(callRef.current!.kind);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('call:offer', { callId: data.callId, sdp: offer });
        } catch {
          setErrorMessage("Impossible d'accéder au micro/caméra. Vérifie les autorisations de ton navigateur.");
          handleEndCall();
        }
      })();
    }

    async function onOffer(data: { callId: string; sdp: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc || !callRef.current || data.callId !== callRef.current.callId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      remoteDescSetRef.current = true;
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { callId: data.callId, sdp: answer });
    }

    async function onAnswer(data: { callId: string; sdp: RTCSessionDescriptionInit }) {
      const pc = pcRef.current;
      if (!pc || !callRef.current || data.callId !== callRef.current.callId) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      remoteDescSetRef.current = true;
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
      pendingCandidatesRef.current = [];
    }

    async function onIce(data: { callId: string; candidate: RTCIceCandidateInit }) {
      if (!callRef.current || data.callId !== callRef.current.callId) return;
      if (remoteDescSetRef.current && pcRef.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch { /* candidat obsolète, sans conséquence */ }
      } else {
        pendingCandidatesRef.current.push(data.candidate);
      }
    }

    function onDeclined() {
      setErrorMessage("Appel refusé.");
      resetToIdle();
    }

    function onBusy() {
      setErrorMessage('Cette personne est déjà en ligne.');
      resetToIdle();
    }

    function onEnded() {
      resetToIdle();
    }

    function onError(data: { message: string }) {
      setErrorMessage(data.message);
      resetToIdle();
    }

    socket.on('call:incoming', onIncoming);
    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:declined', onDeclined);
    socket.on('call:busy', onBusy);
    socket.on('call:ended', onEnded);
    socket.on('call:error', onError);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:declined', onDeclined);
      socket.off('call:busy', onBusy);
      socket.off('call:ended', onEnded);
      socket.off('call:error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, resetToIdle]);

  return (
    <CallContext.Provider value={{
      phase, call, localStream, remoteStream, isMuted, isCameraOff, durationSeconds, errorMessage,
      startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
}
