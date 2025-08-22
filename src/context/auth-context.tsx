
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onIdTokenChanged, User, signOut, getIdTokenResult } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount, UserRole } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';

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
      if (firebaseUser) {
        try {
          // Get token result to access custom claims
          const tokenResult = await getIdTokenResult(firebaseUser);
          const claims = tokenResult.claims as { accountId?: string; role?: UserRole };
          
          if (claims.accountId && claims.role) {
            setAccountId(claims.accountId);
            setRole(claims.role);
            setUser(firebaseUser);
          } else {
            // This can happen briefly after signup before claims are set.
            // Force a refresh to get the new claims.
            await firebaseUser.getIdToken(true);
            const refreshedTokenResult = await getIdTokenResult(firebaseUser);
            const refreshedClaims = refreshedTokenResult.claims as { accountId?: string; role?: UserRole };

            if (refreshedClaims.accountId && refreshedClaims.role) {
                setAccountId(refreshedClaims.accountId);
                setRole(refreshedClaims.role);
                setUser(firebaseUser);
            } else {
                 // If claims are still not present, something is wrong.
                 console.error("Claims não encontradas no token. Deslogando.");
                 await signOut(auth);
            }
          }
        } catch (error) {
          console.error("Erro ao obter custom claims:", error);
          await signOut(auth);
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
  }, [auth]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeDoc = onSnapshot(userDocRef, 
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUserAccount(userAccountData);
        } else {
          console.error("Documento do usuário não encontrado. Deslogando.");
          signOut(auth);
        }
        setLoading(false); 
      }, 
      (error) => {
        console.error("Erro ao buscar documento do usuário:", error);
        signOut(auth);
        setLoading(false);
      }
    );

    return () => unsubscribeDoc();
  }, [user, auth, db]);

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

  if (loading && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  // If user is authenticated but doesn't have an accountId claim, show an error/wait screen.
  if (user && !accountId && !loading && !isAuthPage) {
      return (
          <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
               <Spinner size="large" />
               <p className="text-muted-foreground">Configurando sua conta... <br/>Se esta tela persistir, tente sair e entrar novamente.</p>
               <Button onClick={logout} variant="outline">Sair</Button>
          </div>
      )
  }

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
