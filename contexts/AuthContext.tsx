
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
const authApi = {
    login: async (token: string) => {
        const isLocal = window.location.hostname === 'localhost';
        const API_BASE = isLocal ? '/api' : 'https://enchocabs-software-orginal-gemini3pro-1.onrender.com/api';
        
        const response = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        if (!response.ok) {
            const err = await response.json();
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
