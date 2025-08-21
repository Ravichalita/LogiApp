
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser); // Set Firebase user immediately
      if (!firebaseUser) {
        // If no user, reset everything and finish loading
        setUserAccount(null);
        setAccountId(null);
        setLoading(false);
      }
      // Note: We don't fetch the user doc here directly. 
      // This will be handled by the second useEffect, triggered by `user` state change.
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!user) {
      // Not logged in, no need to fetch user doc
      return;
    }

    // User is logged in, now fetch their user document from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUserDoc = onSnapshot(userDocRef, 
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUserAccount(userAccountData);
          setAccountId(userAccountData.accountId);
        } else {
          // This case might happen if the user doc creation failed.
          // Log out to prevent being stuck.
          console.error("User document not found for authenticated user. Logging out.");
          signOut(auth);
        }
        setLoading(false); // Finish loading once we have the user doc (or tried to get it)
      }, 
      (error) => {
        console.error("Error fetching user document:", error);
        // This likely means a permission error on the user doc itself.
        // The most common cause is a user trying to access the app before their custom claims are set.
        // We log them out to allow for a clean retry.
        signOut(auth);
        setLoading(false);
      }
    );

    return () => unsubUserDoc();
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
