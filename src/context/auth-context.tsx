
'use client';

import React, { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { getAuth, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase-client';
import type { UserAccount, UserRole } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';


interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
  role: UserRole | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userAccount: null,
  accountId: null,
  loading: true,
  logout: async () => {},
  role: null,
});

const nonAuthRoutes = ['/login', '/signup'];
const publicRoutes = [...nonAuthRoutes, '/verify-email'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);

  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();

  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const logout = useCallback(async () => {
    try { 
        await signOut(auth); 
    }
    catch (e) { console.error('logout failed', e); }
  }, [auth]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mountedRef.current) return;
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      if (processingRef.current) {
        setLoading(false);
        return;
      }
      processingRef.current = true;

      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        const hasAccountClaim = Boolean(tokenResult.claims?.accountId);

        if (!hasAccountClaim) {
          try {
            const res = await fetch('/api/ensure-user', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${tokenResult.token}` },
            });
            if (!res.ok) {
              console.warn('ensure-user returned not-ok', res.status);
            } else {
              await firebaseUser.getIdToken(true);
            }
          } catch (e) {
            console.error('ensure-user error', e);
          }
        }

        try {
          const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          const data = userDocSnap.exists() ? { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount : null;
          if (mountedRef.current) {
            setUserAccount(data);
            setAccountId(data?.accountId ?? null);
            setRole(data?.role ?? null);
          }
        } catch (err) {
          console.error('failed to load user doc', err);
          if (mountedRef.current) {
            setUserAccount(null);
            setAccountId(null);
            setRole(null);
          }
        }
      } catch (err) {
        console.error('auth init top-level error', err);
        if (mountedRef.current) {
          setUserAccount(null);
          setAccountId(null);
          setRole(null);
        }
      } finally {
        processingRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    });

    return () => {
      try { unsub(); } catch (e) { /* ignore */ }
    };
  }, [logout, auth, db]);

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user) {
       if (!user.emailVerified && !pathname.startsWith('/verify-email')) {
         router.push('/verify-email');
       } else if (user.emailVerified && nonAuthRoutes.includes(pathname)) {
         router.push('/');
      }
    }
  }, [user, loading, pathname, router]);
  
  const isAuthPage = publicRoutes.some(route => pathname.startsWith(route));
  
  if (loading && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }


  const contextValue = {
    user,
    userAccount,
    accountId,
    loading,
    logout,
    role,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
