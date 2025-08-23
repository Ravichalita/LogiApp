
'use client';

import React, { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { getAuth, onAuthStateChanged, User, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebase, getFirebaseIdToken } from '@/lib/firebase-client';
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
    await signOut(auth);
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

      // User is logged in and verified.
      setUser(firebaseUser);

      try {
        let tokenResult = await getIdTokenResult(firebaseUser);
        let claimsAccountId = tokenResult.claims.accountId as string | undefined;

        if (!claimsAccountId) {
            // Claims are missing. This can happen for a new user.
            // Call server to ensure documents and claims are created.
            await fetch('/api/ensure-user', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${await firebaseUser.getIdToken()}` },
            });
            // Force refresh the token to get the new claims.
            tokenResult = await getIdTokenResult(firebaseUser, true);
            claimsAccountId = tokenResult.claims.accountId as string | undefined;
            
            if (!claimsAccountId) {
                throw new Error("accountId claim is still missing after server-side check.");
            }
        }
        
        setAccountId(claimsAccountId);
        
        // Now that we have a guaranteed accountId, listen to the user document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubscribe.current = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
                 const userData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                 setUserAccount(userData);
                 setRole(userData.role);
                 setAccountId(userData.accountId); // Can be redundant but ensures consistency
            } else {
                console.error("User document not found. Logging out.");
                logout();
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to user document:", error);
            setLoading(false);
        });

      } catch (error) {
        console.error("Critical error during auth state processing:", error);
        await logout();
        setLoading(false);
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
