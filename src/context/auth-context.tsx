
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase-client';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
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
    // Use onIdTokenChanged to listen for auth changes AND token refreshes
    const unsubscribeAuth = onIdTokenChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            setUser(firebaseUser);
            // The rest of the logic (fetching user doc) will be triggered by the `user` state change
        } else {
            setUser(null);
            setUserAccount(null);
            setAccountId(null);
            setLoading(false); // No user, stop loading
        }
    });

    return () => unsubscribeAuth();
  }, [auth]);

  useEffect(() => {
    if (!user) {
      // If user is null (logged out), no need to fetch profile
      return;
    }
    
    // User is authenticated, listen to their document in Firestore for profile info
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeDoc = onSnapshot(userDocRef, 
      (userDocSnap) => {
        if (userDocSnap.exists()) {
          const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
          setUserAccount(userAccountData);
          setAccountId(userAccountData.accountId);
        } else {
          console.error("User document not found for authenticated user. Logging out.");
          signOut(auth);
        }
        // Finish loading only after we have the user and their profile (or lack thereof)
        setLoading(false); 
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
    if (loading) return; // Don't redirect until we are sure of the auth state

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));
    const isVerifyRoute = pathname.startsWith('/verify-email');
    
    // Special case: an existing user can access signup page to invite others
    const isInviteFlow = pathname.startsWith('/signup') && !!user;

    if (user) {
      if (!user.emailVerified && !isVerifyRoute) {
        router.push('/verify-email');
      } else if (user.emailVerified && (isVerifyRoute || (isNonAuthRoute && !isInviteFlow))) {
        router.push('/');
      }
    } else {
      // No user, but not on an auth-allowed page, so redirect to login
      if (!isNonAuthRoute) {
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router]);

  const logout = async () => {
    await signOut(auth);
    // Clear state immediately on logout
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    setLoading(true); // Set to loading while we redirect
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
