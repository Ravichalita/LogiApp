'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onIdTokenChanged, User, signOut, getIdTokenResult, getIdToken } from 'firebase/auth';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
        setLoading(true);
        if (firebaseUser) {
             // Force refresh the token to get latest claims after signup/login
            await getIdToken(firebaseUser, true);
            const tokenResult = await getIdTokenResult(firebaseUser);
            const claims = tokenResult.claims as { role?: UserRole; accountId?: string };

            setUser(firebaseUser);
            setRole(claims.role || null);
            
            // The accountId from the claim is used for security rules.
            // The accountId from the user document is used for data fetching on the client.
            // We wait for the user document to be loaded before setting loading to false.
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const unsubscribeDoc = onSnapshot(userDocRef, (userDocSnap) => {
                if (userDocSnap.exists()) {
                    const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                    setUserAccount(userAccountData);
                    setAccountId(userAccountData.accountId);
                } else {
                    console.warn("Documento do usuário ainda não existe, aguardando...");
                }
                setLoading(false); // Done loading once we have the document snapshot (or know it doesn't exist)
            }, (error) => {
                console.error("Erro ao buscar documento do usuário:", error);
                signOut(auth);
                setLoading(false);
            });
            return () => unsubscribeDoc();

        } else {
            setUser(null);
            setUserAccount(null);
            setAccountId(null);
            setRole(null);
            setLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [auth, db]);


  useEffect(() => {
    if (loading) return;

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));
    const isVerifyRoute = pathname.startsWith('/verify-email');
    const isInviteFlow = pathname.startsWith('/signup') && !!user;

    if (user) {
      if (!user.emailVerified && !isVerifyRoute) {
        router.push('/verify-email');
      } else if (user.emailVerified && (isVerifyRoute || (isNonAuthRoute && !isInviteFlow))) {
        router.push('/');
      }
    } else {
      if (!isNonAuthRoute) {
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router]);

  const logout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const isAuthPage = nonAuthRoutes.includes(pathname) || pathname === '/verify-email';
  
  // While loading, and not on an auth page, show a full-screen spinner.
  if (loading && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  // If authenticated but accountId is still missing after loading, something is wrong.
  if (user && !accountId && !loading && !isAuthPage) {
      return (
          <div className="flex h-screen flex-col items-center justify-center gap-4 text-center p-4">
               <Spinner size="large" />
               <p className="text-muted-foreground">Configurando sua conta... <br/>Este processo pode levar um momento. Se esta tela persistir, tente sair e entrar novamente.</p>
               <Button onClick={logout} variant="outline">Sair</Button>
          </div>
      )
  }

  // If not loading, render children.
  return (
    <AuthContext.Provider value={{ user, userAccount, accountId, role, loading, logout }}>
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
