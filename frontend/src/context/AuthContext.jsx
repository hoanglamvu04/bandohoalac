import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.getMe()
      .then(({ user: me }) => setUser(me))
      .catch(() => api.setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const { token, user: loggedInUser } = await api.login(credentials);
    api.setToken(token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user: newUser } = await api.register(payload);
    api.setToken(token);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
  }, []);

  const isModerator = ['CTV', 'MODERATOR', 'ADMIN'].includes(user?.role);
  const isCtv = user?.role === 'CTV';
  const ctvLevel = Number(user?.ctvLevel || 1);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, isModerator, isCtv, ctvLevel, setUser }),
    [user, loading, login, register, logout, isModerator, isCtv, ctvLevel]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
