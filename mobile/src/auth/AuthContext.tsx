import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { clearStoredSession, CurrentUser, getCurrentUser } from '../api/client';
import { registerDeviceForPush } from '../notifications/registerDevice';
import { onUnauthorized } from './authEvents';

interface AuthContextValue {
  /** null while the initial session check (useEffect below) hasn't resolved yet. */
  user: CurrentUser | null;
  /** True only during that initial check — never true again afterward, even while signed out. */
  loading: boolean;
  signIn: (user: CurrentUser) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Single source of truth for "is anyone logged in, and as what role" — the
 * thing RootNavigator needs to decide between the Auth stack and the
 * role-based app shell (one app, not separate apps per role, per this
 * task's own requirement). Login/Register screens call `signIn` after
 * `storeSession` succeeds instead of navigating directly, since Home/
 * Dashboard/etc. now live in a completely different top-level navigator
 * that a plain `navigation.replace(...)` can no longer reach.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getCurrentUser();
      if (!cancelled) {
        setUser(stored);
        setLoading(false);
        // specs/009 FR-001/FR-003 — keeps an already-logged-in device's
        // token current across app restarts, not just at the moment of
        // sign-in (registration trigger is a client-side detail per the
        // spec's own Assumptions).
        if (stored) {
          void registerDeviceForPush();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any authenticated API call coming back 401 (expired/invalid token)
  // fires this, from client.ts's onResponse middleware — for every screen,
  // every role, without each one needing its own 401 handling. The client
  // already cleared the stored session by the time this fires; just drop
  // `user` to null, which flips RootNavigator over to AuthNavigator/Login.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const signIn = useCallback((nextUser: CurrentUser) => {
    setUser(nextUser);
    void registerDeviceForPush();
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredSession();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
