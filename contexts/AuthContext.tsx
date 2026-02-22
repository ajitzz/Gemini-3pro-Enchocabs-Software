
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AdminAccess, AuthUser, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { getApiBase } from '../lib/apiBase';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginWithGoogleToken: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- CONFIGURATION ---
const ADMIN_CACHE_KEY = 'driver_app_admin_cache_v1';
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const VALIDATION_GRACE_MS = 2 * 60 * 1000; // 2 minutes after login/validation
const WARMUP_TIMEOUT_MS = 4000;

// Access ENV directly here to avoid scope issues in nested functions
const env = (import.meta as any).env || {};
const CLIENT_ID_FROM_ENV = env.VITE_GOOGLE_CLIENT_ID || "";

const authApi = {
    login: async (token: string) => {
        const API_BASE = getApiBase();
        const clientId = CLIENT_ID_FROM_ENV;
        
        console.log("Authentication attempting to reach:", API_BASE + '/auth/google');
        
        const response = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, clientId })
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
            throw new Error(err.error || 'Authentication failed');
        }
        return response.json();
    }
};

const warmupBackend = async () => {
  const API_BASE = getApiBase();
  const healthBase = API_BASE.replace(/\/api$/, '');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS);

  try {
    await fetch(`${healthBase}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
  } catch (error) {
    console.warn('Backend warmup skipped:', error);
  } finally {
    window.clearTimeout(timeout);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminCache, setAdminCache] = useState<{ admins: AdminAccess[]; fetchedAt: number } | null>(() => {
    try {
      const cached = localStorage.getItem(ADMIN_CACHE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed?.admins && parsed?.fetchedAt) return parsed;
    } catch (error) {
      console.error('Failed to parse admin cache', error);
      localStorage.removeItem(ADMIN_CACHE_KEY);
    }
    return null;
  });
  const lastValidationRef = useRef<number>(Date.now());
  const normalizeEmail = (email?: string) => (email || '').trim().toLowerCase();

  const persistAdminCache = useCallback((cache: { admins: AdminAccess[]; fetchedAt: number } | null) => {
    if (!cache) {
      localStorage.removeItem(ADMIN_CACHE_KEY);
      return;
    }

    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cache));
  }, []);

  const updateAdminCache = useCallback((admins: AdminAccess[]) => {
    const cache = { admins, fetchedAt: Date.now() };
    setAdminCache(cache);
    persistAdminCache(cache);
  }, [persistAdminCache]);

  const clearAdminCache = useCallback(() => {
    setAdminCache(null);
    persistAdminCache(null);
  }, [persistAdminCache]);

  const getFreshCachedAdmins = useCallback(() => {
    if (!adminCache) return null;
    const isFresh = Date.now() - adminCache.fetchedAt < ADMIN_CACHE_TTL;
    return isFresh ? adminCache.admins : null;
  }, [adminCache]);

  const fetchAndCacheAdmins = useCallback(async () => {
    const admins = await storageService.getAuthorizedAdmins();
    updateAdminCache(admins);
    return admins;
  }, [updateAdminCache]);

  // Load session from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('driver_app_session');
      if (stored) {
        setUser(JSON.parse(stored));
        lastValidationRef.current = Date.now();
      }
    } catch (e) {
      console.error("Failed to load session", e);
      localStorage.removeItem('driver_app_session');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    warmupBackend();
  }, []);

  const loginWithGoogleToken = async (token: string) => {
    setLoading(true);
    try {
        // Send token to backend for verification and role assignment
        const userData = await authApi.login(token);

        // Save session
        localStorage.setItem('driver_app_session', JSON.stringify(userData));
        setUser(userData);
        lastValidationRef.current = Date.now();

    } catch (error: any) {
        console.error("Login failed:", error);
        throw error;
    } finally {
        setLoading(false);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('driver_app_session');
    clearAdminCache();
  }, [clearAdminCache]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    const now = Date.now();
    if (now - lastValidationRef.current < VALIDATION_GRACE_MS) {
      return true;
    }

    try {
      if (user.role === 'admin') {
        const isAuthorized = (admins: AdminAccess[] | null) =>
          !!admins && admins.some(a => normalizeEmail(a.email) === normalizeEmail(user.email));

        const freshCachedAdmins = getFreshCachedAdmins();
        const fallbackAdmins = adminCache?.admins || null;

        if (isAuthorized(freshCachedAdmins)) {
          lastValidationRef.current = now;
          return true;
        }

        if (!freshCachedAdmins && isAuthorized(fallbackAdmins)) {
          // Use stale cache to keep the UI responsive, refresh in the background
          fetchAndCacheAdmins().catch(error => console.error('Background admin refresh failed:', error));
          lastValidationRef.current = now;
          return true;
        }

        const admins = await fetchAndCacheAdmins();
        const authorized = isAuthorized(admins);
        lastValidationRef.current = Date.now();

        if (!authorized) {
          logout();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to validate session:', error);

      const hasCachedAccess = adminCache?.admins?.some(a => normalizeEmail(a.email) === normalizeEmail(user.email));
      if (hasCachedAccess) {
        lastValidationRef.current = Date.now();
        return true;
      }

      // Fail closed so revoked admins cannot continue if the check fails on Vercel
      logout();
      return false;
    }
  }, [adminCache, fetchAndCacheAdmins, getFreshCachedAdmins, logout, user]);

  useEffect(() => {
    if (!user || user.role === 'super_admin') return;

    let isMounted = true;

    const validate = async () => {
      const stillValid = await refreshSession();
      if (!stillValid && isMounted) {
        setLoading(false);
      }
    };

    validate();
    const interval = setInterval(validate, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshSession, user]);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogleToken, logout, isAuthenticated: !!user, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
