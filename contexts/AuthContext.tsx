
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, UserRole } from '../types';
import { storageService } from '../services/storageService';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginWithGoogle: (simulatedEmail?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAIL = 'enchoenterprises@gmail.com';

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

  const loginWithGoogle = async (simulatedEmail?: string) => {
    setLoading(true);
    try {
        // --- SIMULATED GOOGLE AUTH FLOW ---
        const email = simulatedEmail?.toLowerCase().trim();
        
        if (!email) throw new Error("Email required for simulation.");
        
        let role: UserRole | null = null;
        let driverId: string | undefined = undefined;
        let name = email.split('@')[0];

        // 1. Check Super Admin (Strict Check)
        if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
            role = 'super_admin';
            name = 'Encho (Super Admin)';
        }

        // 2. Check Authorized Admins
        if (!role) {
            const admins = await storageService.getAuthorizedAdmins();
            const adminUser = admins.find(a => a.email.toLowerCase() === email);
            if (adminUser) {
                role = 'admin';
                name = 'Admin User';
            }
        }

        // 3. Check Drivers
        if (!role) {
            const drivers = await storageService.getDrivers();
            // Ensure we handle potential missing email fields in legacy data
            const driver = drivers.find(d => d.email && d.email.toLowerCase() === email);
            
            if (driver) {
                if (driver.terminationDate) {
                    throw new Error("Access Denied: This driver account has been terminated.");
                }
                role = 'driver';
                name = driver.name;
                driverId = driver.id;
            }
        }

        if (!role) {
            throw new Error(`Access Denied: Email '${email}' is not registered in the system. Contact Super Admin.`);
        }

        const authUser: AuthUser = {
            email,
            name,
            role,
            photoURL: `https://ui-avatars.com/api/?name=${name}&background=random`,
            driverId
        };

        // Update state and storage
        localStorage.setItem('driver_app_session', JSON.stringify(authUser));
        setUser(authUser);

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
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, isAuthenticated: !!user }}>
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
