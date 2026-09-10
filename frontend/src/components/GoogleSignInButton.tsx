import { useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '857814601767-2d36ai64gmn8d5qtraeq6f9do7cv3fbi.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Bouton "Se connecter avec Google" — utilise Google Identity Services
 * (script officiel Google), qui gère toute la boîte de dialogue de
 * connexion. On récupère juste un ID token à la fin, envoyé au backend pour
 * vérification — aucun secret ne transite jamais côté navigateur.
 */
export default function GoogleSignInButton({ onError }: { onError?: (message: string) => void }) {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (window.google?.accounts?.id) { setScriptReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptReady || !buttonRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        try {
          await loginWithGoogle(resp.credential);
          window.location.href = '/';
        } catch (err) {
          onError?.(err instanceof ApiRequestError ? err.message : 'La connexion Google a échoué.');
        }
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline', size: 'large', width: 320, text: 'continue_with', locale: 'fr',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady]);

  return <div ref={buttonRef} className="w-full flex justify-center" />;
}
