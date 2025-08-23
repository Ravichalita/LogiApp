
'use client';

import React, { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { getAuth, onAuthStateChanged, User, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
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
  
  const userDocUnsubscribe = useRef<() => void | null>(null);

  const logout = useCallback(async () => {
    if (userDocUnsubscribe.current) {
        userDocUnsubscribe.current();
        userDocUnsubscribe.current = null;
    }
    setLoading(true);
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    setRole(null);
    await signOut(auth);
    // No need to set loading false here, onAuthStateChanged will handle it
  }, [auth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (userDocUnsubscribe.current) {
          userDocUnsubscribe.current();
      }

      if (!firebaseUser) {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      if (!firebaseUser.emailVerified) {
          setUser(firebaseUser);
          setLoading(false);
          return;
      }

      setUser(firebaseUser);

      try {
        // Force refresh to ensure we have the latest claims after login/signup
        const tokenResult = await getIdTokenResult(firebaseUser, true);
        const claimsAccountId = tokenResult.claims.accountId as string | undefined;

        if (!claimsAccountId) {
            // This should ideally not happen if the backend logic is correct.
            // It indicates a severe problem (e.g., failed signup transaction).
            console.error("Critical: accountId claim is missing after token refresh. Logging out.");
            await logout();
            return;
        }
        
        // The token claim is the single source of truth for security rules.
        setAccountId(claimsAccountId);
        
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubscribe.current = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
                 const userData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                 
                 // Invariant check: The user document's accountId MUST match the token claim.
                 if (!userData.accountId || userData.accountId !== claimsAccountId) {
                    console.error("User doc accountId is missing or divergent from claims. Forcing logout for security.");
                    logout(); // Do not proceed.
                    return; 
                 }
                 
                 setUserAccount(userData);
                 setRole(userData.role);
                 setLoading(false); // Only now is the auth state considered complete and valid.
            } else {
                console.error("User document not found, which should not happen after signup. Logging out.");
                logout();
            }
        }, async (error) => {
            console.error("Error listening to user document:", error);
            // If we can't read the user doc due to permissions, it's a critical state error.
            await logout();
        });

      } catch (error) {
        console.error("Critical error during auth state processing:", error);
        await logout();
      }
    });

    return () => unsubscribe();
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

    