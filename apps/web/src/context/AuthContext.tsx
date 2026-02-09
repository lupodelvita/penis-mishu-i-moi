'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
// Using require to avoid TS check issues if type defs aren't fully loaded yet 
// but in a real project we'd use import { jwtDecode } from "jwt-decode";
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  username: string;
  role: 'USER' | 'ADMIN';
  licenseTier: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check localStorage on mount
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const decoded: any = jwtDecode(token);
            // Verify expiry
            if (decoded.exp * 1000 < Date.now()) {
                logout();
            } else {
                setUser({
                    id: decoded.userId,
                    username: decoded.username || 'User', // JWT payload might need username update
                    role: decoded.role,
                    licenseTier: decoded.licenseTier || 'OBSERVER'
                });
            }
        } catch (e) {
            logout();
        }
    }
    setLoading(false);
  }, []);

  const login = (token: string) => {
    localStorage.setItem('token', token);
    const decoded: any = jwtDecode(token);
    setUser({
        id: decoded.userId,
        username: decoded.username || 'User', // Backend needs to ensure this is in token or fetch /me
        role: decoded.role,
        licenseTier: decoded.licenseTier || 'OBSERVER'
    });
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/auth/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
