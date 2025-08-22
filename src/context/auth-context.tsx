
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const nonAuthRoutes = ['/login', '/signup'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
             // Force refresh the token to get the latest custom claims.
             // This is crucial after signup to ensure the `accountId` claim is present.
            await firebaseUser.getIdToken(true);
            setUser(firebaseUser);
        } else {
            setUser(null);
            setUserAccount(null);
            setAccountId(null);
            setLoading(false);
        }
    });

    return () => unsubscribeAuth();
  }, [auth]);


  useEffect(() => {
    if (!user) return;
    
    // User is authenticated, listen to their document in Firestore for profile info
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeDoc = onSnapshot(userDocRef, 
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUserAccount(userAccountData);
          setAccountId(userAccountData.accountId);
        } else {
          // This can happen in a race condition during signup/cleanup.
          // Logging out prevents being stuck in a bad state.
          console.error("User document not found for authenticated user. Logging out.");
          signOut(auth);
        }
        setLoading(false); // Finish loading once we have the user doc (or confirmed it's missing)
      }, 
      (error) => {
        console.error("Error fetching user document:", error);
        signOut(auth); // Log out on critical errors
        setLoading(false);
      }
    );

    return () => unsubscribeDoc();
  }, [user, auth, db]);


  useEffect(() => {
    if (loading) return;

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));
    const isVerifyRoute = pathname.startsWith('/verify-email');
    
    // Allow an already logged-in user (admin) to access the signup page to invite others
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

  // Show a global loader while we are verifying auth state and fetching user profile
  if (loading && !isAuthPage) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userAccount, accountId, loading, logout }}>
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
