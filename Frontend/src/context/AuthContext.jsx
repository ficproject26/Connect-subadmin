import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialize synchronously from localStorage so isAuthenticated is correct on first render.
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [token, setToken] = useState(() => authService.getToken());
  const [loading, setLoading] = useState(true);
  const [demoAdmins, setDemoAdmins] = useState([]);

  // Track whether initAuth has already run to prevent duplicate calls.
  const initRanRef = useRef(false);

  useEffect(() => {
    // Only run once on mount, NOT on every token change.
    // Running on token changes caused a second /auth/me call immediately after
    // login which could 401 and wipe the token before navigate() fired.
    if (initRanRef.current) return;
    initRanRef.current = true;

    let isMounted = true;

    async function initAuth() {
      const storedToken = authService.getToken();
      try {
        if (storedToken) {
          const res = await authService.getMe();
          if (isMounted && res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('ams_user', JSON.stringify(res.user));
          }
        }
      } catch (err) {
        // Only clear session on definitive 401 (invalid/expired token).
        // Do NOT clear on network errors (ECONNREFUSED, timeout, 503) — backend
        // may still be starting up and the token is valid.
        const is401 =
          err?.status === 401 ||
          (err?.message || '').toLowerCase().includes('unauthorized') ||
          (err?.message || '').toLowerCase().includes('invalid token') ||
          (err?.message || '').toLowerCase().includes('token expired');

        if (is401) {
          console.warn('Session expired or invalid on startup, logging out.');
          authService.logout();
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        } else {
          // Backend unreachable — keep session alive, user can still use the app
          // if they were previously authenticated.
          console.warn(
            'Backend unreachable during startup auth check, preserving session:',
            err?.message || err
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadDemoAdmins(retries = 2) {
      try {
        const res = await authService.getDemoAdmins();
        if (isMounted && res.success && Array.isArray(res.admins)) {
          setDemoAdmins(res.admins);
        }
      } catch (e) {
        if (isMounted && retries > 0) {
          setTimeout(() => loadDemoAdmins(retries - 1), 1200);
        }
      }
    }

    initAuth();
    loadDemoAdmins();

    return () => {
      isMounted = false;
    };
  }, []); // ← empty deps: runs only on mount

  /**
   * Login: calls authService, then atomically updates React state.
   * After this resolves, isAuthenticated is guaranteed to be true,
   * so navigate() in Login.jsx will succeed without a redirect loop.
   */
  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.success && res.token && res.user) {
      // authService.login() already persisted token + user to localStorage.
      // Now sync React state so isAuthenticated flips to true before we navigate.
      setToken(res.token);
      setUser(res.user);
      return res;
    }
    throw new Error(res.message || 'Login failed');
  };

  /** Demo / 1-click quick login */
  const loginAsRole = async (email) => {
    return await login(email, 'admin123');
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
    // Use window.location to ensure a full context reset after logout.
    window.location.href = '/login';
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginAsRole,
        logout,
        demoAdmins,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
