
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount, UserRole } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ensureUserDocumentOnClient } from '@/lib/actions';

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
  const [authLoading, setAuthLoading] = useState(true);
  const [userDocLoading, setUserDocLoading] = useState(true);
  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
        setAuthLoading(true);
        setUserDocLoading(true);

        if (firebaseUser) {
            setUser(firebaseUser);
            // Force refresh the token to get custom claims
            await firebaseUser.getIdToken(true);
            setAuthLoading(false); // Auth part is done, now wait for user doc

            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const unsubscribeDoc = onSnapshot(userDocRef, async (userDocSnap) => {
                if (userDocSnap.exists()) {
                    const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                    setUserAccount(userAccountData);
                    setAccountId(userAccountData.accountId);
                    setRole(userAccountData.role);
                } else {
                    try {
                        const token = await firebaseUser.getIdToken();
                        await fetch('/api/ensure-user', { headers: { Authorization: `Bearer ${token}` } });
                    } catch (error) {
                        console.error("Failed to ensure user document on client:", error);
                        signOut(auth);
                    }
                }
                setUserDocLoading(false); // User doc part is done
            }, (error) => {
                console.error("Erro ao buscar documento do usuário:", error);
                signOut(auth);
                setUserDocLoading(false);
            });
            return () => unsubscribeDoc();

        } else {
            setUser(null);
            setUserAccount(null);
            setAccountId(null);
            setRole(null);
            setAuthLoading(false);
            setUserDocLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [auth, db]);

  const loading = authLoading || userDocLoading;

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

  const logout = async () => {
    await signOut(auth);
    // Reset state immediately on logout
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    setRole(null);
    router.push('/login');
  };
  
  const isAuthPage = publicRoutes.some(route => pathname.startsWith(route));
  
  if (loading && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  if (user && !accountId && !loading && !isAuthPage) {
      return (
          <div className="flex h-screen flex-col items-center justify-center gap-4 text-center p-4">
               <Spinner size="large" />
               <p className="text-muted-foreground">Configurando sua conta... <br/>Este processo pode levar um momento. Se esta tela persistir, tente sair e entrar novamente.</p>
               <Button onClick={logout} variant="outline">Sair</Button>
          </div>
      )
  }

  const contextValue = {
    user,
    userAccount,
    accountId,
    role,
    loading: loading,
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
