import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from './api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string, preferences: string[]) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Plus de vérification de token en localStorage : le cookie httpOnly
    // (invisible pour JS) est automatiquement envoyé par le navigateur si
    // présent. On tente simplement /me — 401 = pas connecté, c'est normal.
    api.me()
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    // Connexion unique pour tous les comptes, y compris l'administrateur :
    // le backend renvoie le rôle dans l'utilisateur, et c'est à l'appelant
    // (page Login) de rediriger vers /admin si role === 'admin'.
    const res = await api.login({ email, password });
    setUser(res.data.user);
    return res.data.user;
  }

  async function loginWithGoogle(credential: string) {
    const res = await api.googleLogin(credential);
    setUser(res.data.user);
  }

  async function register(name: string, email: string, password: string, preferences: string[]) {
    const res = await api.register({ name, email, password, preferences });
    setUser(res.data.user);
  }

  function logout() {
    setUser(null);
    api.logout().catch(() => {});
  }

  async function refresh() {
    try {
      const res = await api.me();
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider');
  return ctx;
}
