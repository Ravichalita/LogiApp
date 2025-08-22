
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount, UserRole } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';

interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  role: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const nonAuthRoutes = ['/login', '/signup'];
const publicRoutes = [...nonAuthRoutes, '/verify-email'];


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    setRole(null);
    router.push('/login');
  }, [auth, router]);

  useEffect(() => {
    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          // Force refresh the token to get custom claims. This is crucial.
          await firebaseUser.getIdToken(true);
          setUser(firebaseUser);

          // Now that we have a fresh token, ensure the user document exists on the server.
          // This call also sets custom claims if they are missing.
          const res = await fetch('/api/ensure-user', {
              method: 'POST',
              headers: { Authorization: `Bearer ${idToken}` },
          });

          if (!res.ok) {
             throw new Error('Falha ao garantir o documento do usuário.');
          }
          
          const { accountId: userAccountId } = await res.json();

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const unsubscribeDoc = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
              const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
              setUserAccount(userAccountData);
              setAccountId(userAccountData.accountId);
              setRole(userAccountData.role);
              setLoading(false); // All data is loaded, stop loading.
            } else {
               // This should ideally not happen after ensure-user call, but as a fallback:
               console.error("User document not found after server-side check.");
               logout();
            }
          }, (error) => {
            console.error("Erro ao buscar documento do usuário:", error);
            logout();
          });
          return () => unsubscribeDoc();

        } catch (error) {
          console.error("[ensureUserDocumentOnClient] Error:", error);
          logout();
        }
      } else {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, db, logout]);

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
    role,
    loading,
    logout,
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
