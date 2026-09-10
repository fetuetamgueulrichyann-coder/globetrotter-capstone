import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, UserCircle2 } from 'lucide-react';
import { useCall } from '../lib/callContext';
import { resolveImageUrl } from '../lib/api';

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Sonnerie générée directement (deux tonalités simples, façon téléphone
 * classique) via l'API Web Audio — pas besoin d'un fichier audio à charger.
 * "incoming" = sonnerie d'appel entrant (répétée), "outgoing" = tonalité de
 * retour d'appel ("ça sonne chez l'autre").
 */
function useRingtone(kind: 'incoming' | 'outgoing' | null) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function stop() {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    }

    if (!kind) { stop(); return; }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return; // navigateur trop ancien : pas de sonnerie, l'appel reste fonctionnel

    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    function beep(freq: number, duration: number, startAt: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.15, startAt + 0.02);
      gain.gain.linearRampToValueAtTime(0, startAt + duration - 0.02);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + duration);
    }

    function playPattern() {
      const now = ctx.currentTime;
      if (kind === 'incoming') {
        beep(880, 0.4, now);
        beep(880, 0.4, now + 0.5);
      } else {
        beep(440, 1, now);
      }
    }

    playPattern();
    intervalRef.current = setInterval(playPattern, kind === 'incoming' ? 2000 : 3000);

    return stop;
  }, [kind]);
}

export default function CallOverlay() {
  const {
    phase, call, localStream, remoteStream, isMuted, isCameraOff, durationSeconds, errorMessage,
    acceptCall, declineCall, endCall, toggleMute, toggleCamera,
  } = useCall();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [visibleError, setVisibleError] = useState<string | null>(null);

  useRingtone(phase === 'incoming' ? 'incoming' : phase === 'outgoing' ? 'outgoing' : null);

  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => {
    if (call?.kind === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (call?.kind === 'audio' && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream, call?.kind]);

  useEffect(() => {
    if (!errorMessage) return;
    setVisibleError(errorMessage);
    const t = setTimeout(() => setVisibleError(null), 4000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  if (phase === 'idle') {
    return visibleError ? (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-elegant text-white text-sm px-4 py-2.5 rounded-full shadow-lg">
        {visibleError}
      </div>
    ) : null;
  }

  const isVideo = call?.kind === 'video';
  const peerName = call?.peer?.name || 'Utilisateur';

  return (
    <div className="fixed inset-0 z-[300] bg-elegant flex flex-col">
      {isVideo && phase === 'active' ? (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
          <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-4 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20 shadow-lg" />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          {call?.peer?.avatarUrl ? (
            <img src={resolveImageUrl(call.peer.avatarUrl)} alt="" className="w-28 h-28 rounded-full object-cover mb-5" />
          ) : (
            <UserCircle2 size={112} className="text-white/30 mb-5" />
          )}
          <p className="text-xl font-semibold">{peerName}</p>
          <p className="text-sm text-white/50 mt-2">
            {phase === 'outgoing' && 'Appel en cours…'}
            {phase === 'incoming' && (isVideo ? 'Appel vidéo entrant…' : 'Appel vocal entrant…')}
            {phase === 'connecting' && 'Connexion…'}
            {phase === 'active' && formatDuration(durationSeconds)}
          </p>
        </div>
      )}

      {isVideo && phase === 'active' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white text-sm font-medium bg-black/30 pl-1.5 pr-3 py-1 rounded-full">
          {call?.peer?.avatarUrl ? (
            <img src={resolveImageUrl(call.peer.avatarUrl)} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <UserCircle2 size={22} className="text-white/60" />
          )}
          {peerName} · {formatDuration(durationSeconds)}
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay hidden={isVideo} />

      <div className="pb-10 pt-6 flex items-center justify-center gap-5">
        {phase === 'incoming' ? (
          <>
            <button onClick={declineCall} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 transition flex items-center justify-center">
              <PhoneOff size={26} className="text-white" />
            </button>
            <button onClick={acceptCall} className="w-16 h-16 rounded-full bg-forest-600 hover:bg-forest-700 transition flex items-center justify-center animate-pulse">
              <Phone size={26} className="text-white" />
            </button>
          </>
        ) : (
          <>
            {(phase === 'connecting' || phase === 'active') && (
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-white text-elegant' : 'bg-white/15 text-white hover:bg-white/25'}`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            {isVideo && (phase === 'connecting' || phase === 'active') && (
              <button
                onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition ${isCameraOff ? 'bg-white text-elegant' : 'bg-white/15 text-white hover:bg-white/25'}`}
              >
                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 transition flex items-center justify-center">
              <PhoneOff size={26} className="text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
