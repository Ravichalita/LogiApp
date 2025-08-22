
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount, UserRole } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';

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
  }, [auth]);

  useEffect(() => {
    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
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
      
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/ensure-user', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          throw new Error('Falha ao garantir o documento do usuário: ' + res.statusText);
        }

        await firebaseUser.getIdToken(true); // Force refresh token

        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
            const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
            setUserAccount(userAccountData);
            setAccountId(userAccountData.accountId);
            setRole(userAccountData.role);
        } else {
             console.error("User document not found in Firestore after server-side check.");
             setUserAccount(null);
             setAccountId(null);
             setRole(null);
        }

      } catch (error) {
        console.error("[AuthContext] Error:", error);
        setUserAccount(null);
        setAccountId(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, db]);

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

    