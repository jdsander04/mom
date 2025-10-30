import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AuthContextType {
  token: string | null;
  user: any | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, email: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  avatarUrl: string | null;
  refreshAvatar: () => Promise<void>;
  setAvatarUrl: (url: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);

  const setAvatarObjectUrl = (url: string | null) => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
    if (url) lastObjectUrlRef.current = url;
    setAvatarUrl(url);
  };

  const refreshAvatar = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/users/me/profile-image/file/', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        setAvatarObjectUrl(null);
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      try {
        await preloadImage(objUrl);
        setAvatarObjectUrl(objUrl);
      } catch {
        setAvatarObjectUrl(null);
      }
      if (user) {
        // Keep raw URL in user for compatibility; actual display uses blob URL
        const updated = { ...user };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
      }
    } catch {
      setAvatarObjectUrl(null);
    }
  };

  useEffect(() => {
    // On mount, attempt to load avatar from API if logged in
    if (token) {
      refreshAvatar();
    } else {
      setAvatarObjectUrl(null);
    }
    return () => {
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    };
  }, [token]);

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      let errorMessage = 'Login failed';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `Login failed (${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await refreshAvatar();
  };

  const signup = async (username: string, password: string, email: string) => {
    const response = await fetch('/api/auth/signup/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    });
    
    if (!response.ok) {
      let errorMessage = 'Signup failed';
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = `Signup failed (${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await refreshAvatar();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAvatarObjectUrl(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, login, signup, logout, isAuthenticated, avatarUrl, refreshAvatar, setAvatarUrl: setAvatarObjectUrl }}>
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
