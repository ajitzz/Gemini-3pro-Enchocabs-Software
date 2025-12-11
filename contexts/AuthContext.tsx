
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, UserRole } from '../types';
import { storageService } from '../services/storageService';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginWithGoogleToken: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to interact with the Auth API directly
const getApiBase = () => {
    // Check for Vite dev mode or specific local hostnames
    const isLocal = ((import.meta as any).env && (import.meta as any).env.DEV) || 
                    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    
    if (isLocal) return '/api';
    
    const env = (import.meta as any).env || {};
    if (env.VITE_API_URL) {
        return env.VITE_API_URL.replace(/\/$/, '');
    }
    // Fallback to the production backend if VITE_API_URL is not set
    return 'https://enchocabs-software-orginal-gemini3pro-1.onrender.com/api';
};

const authApi = {
    login: async (token: string) => {
        const API_BASE = getApiBase();
        console.log("Authentication attempting to reach:", API_BASE + '/auth/google');
        
        const response = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: `Server error ${response.status}` }));
            throw new Error(err.error || 'Authentication failed');
        }
        return response.json();
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('driver_app_session');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load session", e);
      localStorage.removeItem('driver_app_session');
    }
    setLoading(false);
  }, []);

  const loginWithGoogleToken = async (token: string) => {
    setLoading(true);
    try {
        // Send token to backend for verification and role assignment
        const userData = await authApi.login(token);
        
        // Save session
        localStorage.setItem('driver_app_session', JSON.stringify(userData));
        setUser(userData);

    } catch (error: any) {
        console.error("Login failed:", error);
        throw error;
    } finally {
        setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('driver_app_session');
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogleToken, logout, isAuthenticated: !!user }}>
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
