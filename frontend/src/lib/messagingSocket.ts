/**
 * Connexion temps réel à messaging-service, à travers edge-proxy (comme le
 * reste de l'API) — une connexion WebSocket persistante ne peut pas être
 * relayée par un simple proxy HTTP requête/réponse, edge-proxy a une règle
 * dédiée pour ça (voir backend/edge-proxy/nginx.conf, location
 * /socket.io/). Le REST (historique, liste des conversations) passe par le
 * Gateway normalement (voir lib/api.ts).
 *
 * `withCredentials: true` : le cookie httpOnly de session est envoyé
 * automatiquement à la requête de handshake, exactement comme pour les
 * appels API classiques — pas besoin (et impossible) de lire le JWT en JS.
 */
import { io, type Socket } from 'socket.io-client';

const MESSAGING_WS_URL = import.meta.env.VITE_MESSAGING_WS_URL || 'http://localhost:8000';

let socket: Socket | null = null;

export function getMessagingSocket(): Socket {
  if (!socket) {
    socket = io(MESSAGING_WS_URL, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectMessagingSocket() {
  const s = getMessagingSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectMessagingSocket() {
  socket?.disconnect();
}
