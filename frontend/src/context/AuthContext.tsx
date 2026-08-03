import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchApi, getStoredToken, setStoredToken } from '../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  role_name: string;
  is_active: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  /** True while the stored token is being exchanged for a profile on boot. */
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  // Start in a loading state whenever a token is present: without this the
  // guarded routes see isAuthenticated === false on the first render and
  // bounce a signed in admin straight back to the login screen.
  const [loading, setLoading] = useState<boolean>(() => Boolean(getStoredToken()));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchApi('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
      })
      .catch(() => {
        if (cancelled) return;
        // Token expired or revoked: clear it so the guard sends us to login
        setStoredToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username_or_email: string, password: string) => {
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username_or_email, password }),
    });

    if (!res?.access_token) {
      throw new Error('Reponse de connexion invalide.');
    }

    setStoredToken(res.access_token);
    if (res.refresh_token) {
      try {
        // Same tab scoped as the access token
        sessionStorage.setItem('lucea_admin_refresh', res.refresh_token);
      } catch {
        /* ignore */
      }
    }

    // Load the profile before flipping state so the redirect that follows
    // lands on a fully authenticated context.
    const profile = await fetchApi('/auth/me', {
      headers: { Authorization: `Bearer ${res.access_token}` },
    });

    setUser(profile);
    setToken(res.access_token);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    const refresh = sessionStorage.getItem('lucea_admin_refresh');
    if (refresh) {
      // Best effort revoke, the local session is cleared either way
      fetchApi('/auth/logout', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => undefined);
      sessionStorage.removeItem('lucea_admin_refresh');
    }
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        logout,
        isAuthenticated: Boolean(token && user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
