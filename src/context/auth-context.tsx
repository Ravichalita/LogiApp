
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';


interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicRoutes = ['/login', '/signup', '/verify-email'];
const authRoutes = ['/login', '/signup'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is authenticated with Firebase
        if (firebaseUser.emailVerified) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                setUser(firebaseUser);
                setUserAccount(userAccountData);
                setAccountId(userAccountData.accountId);
            } else {
                // This can happen briefly after signup before the server action completes.
                // We'll let the router logic handle redirection if needed, but for now, we're not fully "logged in".
                 console.warn("User document not found for UID:", firebaseUser.uid, "- This might be temporary after signup.");
                 // Keep user null until we have the account data.
                 setUser(null);
                 setUserAccount(null);
                 setAccountId(null);
            }
        } else {
          // Email not verified, redirect to verification page
          setUser(null);
          setUserAccount(null);
          setAccountId(null);
           if (!pathname.startsWith('/verify-email')) {
             router.push('/verify-email');
           }
        }
      } else {
        // No user logged in
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    
    // If we're not loading, and there's no user, and we're not on a public route, redirect to login.
    if (!user && !isPublicRoute) {
      router.push('/login');
    } 
    // If there is a user and they are on an auth page (login/signup), redirect to home.
    else if (user && authRoutes.some(route => pathname.startsWith(route))) {
      router.push('/');
    }
  }, [user, accountId, loading, pathname, router]);


  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    router.push('/login');
  };

  // The main loading condition for the app.
  if (loading) {
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
