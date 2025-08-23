
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

  const logout = useCallback(async () => {
    await signOut(auth);
    // onAuthStateChanged will handle state clearing
  }, [auth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
        return;
      }

      // User is logged in, begin the auth flow
      setUser(firebaseUser);

      try {
        let tokenResult = await firebaseUser.getIdTokenResult();
        
        // Step 1: Check for custom claims. If missing, call API to create them.
        if (!tokenResult.claims.accountId) {
          const res = await fetch('/api/ensure-user', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${await firebaseUser.getIdToken()}` },
          });

          if (!res.ok) {
            throw new Error(`Failed to ensure user document: ${await res.text()}`);
          }
          
          // Step 2: Force refresh the token to get the new claims.
          tokenResult = await firebaseUser.getIdTokenResult(true);
        }

        const userAccountId = tokenResult.claims.accountId as string;
        
        // Step 3: Fetch the user document from Firestore using the now-guaranteed accountId.
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUserAccount(userData);
          setAccountId(userData.accountId);
          setRole(userData.role);
        } else {
            // This case should ideally not happen if ensure-user works correctly.
            // It's a fallback / error state.
            throw new Error("User document not found after ensure-user call.");
        }
      } catch (error) {
        console.error("Critical error during authentication flow:", error);
        // In case of error, log out the user to avoid being in a broken state.
        await logout();
      } finally {
        // Step 4: All steps are complete, set loading to false.
        setLoading(false);
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
