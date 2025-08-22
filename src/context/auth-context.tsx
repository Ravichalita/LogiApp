
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
        setUser(firebaseUser); // Set user immediately
         const tokenResult = await getIdTokenResult(firebaseUser);
         const claims = tokenResult.claims as { role?: UserRole };
         setRole(claims.role || null);
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
    
    // User is authenticated, now get their profile from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeDoc = onSnapshot(userDocRef, 
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUserAccount(userAccountData);
          setAccountId(userAccountData.accountId); // Get accountId from Firestore doc
          setRole(userAccountData.role); // Also update role from Firestore
        } else {
          // This might happen if the user doc is not created yet
          console.warn("Documento do usuário ainda não existe, aguardando...");
        }
        // Defer setting loading to false until we have account data or timeout
        if (userDocSnap.exists() || !user) {
            setLoading(false);
        }
      }, 
      (error) => {
        console.error("Erro ao buscar documento do usuário:", error);
        signOut(auth); // Log out on error
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

  // If user is authenticated but doesn't have an accountId, show a waiting screen.
  if (user && !accountId && !loading && !isAuthPage) {
      return (
          <div className="flex h-screen flex-col items-center justify-center gap-4 text-center p-4">
               <Spinner size="large" />
               <p className="text-muted-foreground">Configurando sua conta... <br/>Este processo pode levar um momento. Se esta tela persistir, tente sair e entrar novamente.</p>
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
