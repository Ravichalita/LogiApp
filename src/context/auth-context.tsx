
'use client';

import React, { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { getAuth, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
    await signOut(auth);
    // onAuthStateChanged will handle clearing local state
  }, [auth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (userDocUnsubscribe.current) {
          userDocUnsubscribe.current(); // Unsubscribe from previous user doc listener
      }

      if (!firebaseUser) {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      // If user is not verified, we set the user and stop loading.
      // The routing effect will handle redirection.
      if (!firebaseUser.emailVerified) {
          setUser(firebaseUser);
          setLoading(false);
          return;
      }

      // User is logged in and verified.
      setUser(firebaseUser);

      // We need to get the accountId from claims to fetch the user document.
      // Let's try getting it, forcing a refresh to ensure we have the latest claims.
      try {
        const tokenResult = await firebaseUser.getIdTokenResult(true);
        const claimsAccountId = tokenResult.claims.accountId as string | undefined;

        if (!claimsAccountId) {
            // This can happen for a brand new user whose claims are not yet propagated.
            // Or if something went wrong during signup. Let's call ensure-user as a fallback.
            await fetch('/api/ensure-user', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${await firebaseUser.getIdToken()}` },
            });
            // Force refresh again after ensuring user
            const refreshedTokenResult = await firebaseUser.getIdTokenResult(true);
            const newClaimsAccountId = refreshedTokenResult.claims.accountId as string | undefined;
            if (!newClaimsAccountId) {
                throw new Error("accountId claim is still missing after ensure-user call.");
            }
            setAccountId(newClaimsAccountId);
        } else {
            setAccountId(claimsAccountId);
        }
        
        // Now that we have accountId, listen to the user document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubscribe.current = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
                 const userData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                 setUserAccount(userData);
                 setRole(userData.role);
                 // We already have the accountId from claims, but this confirms it.
                 setAccountId(userData.accountId);
            } else {
                // This state can happen if the user was deleted from firestore but not auth.
                // Log them out to prevent a broken state.
                console.error("User document not found. Logging out.");
                logout();
            }
            setLoading(false); // We have our user data, stop loading.
        }, (error) => {
            console.error("Error listening to user document:", error);
            setLoading(false);
            // Don't logout on permission errors, as it might be a temporary state.
            // The UI should handle showing an error state.
        });


      } catch (error) {
        console.error("Critical error during auth state change:", error);
        await logout();
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
