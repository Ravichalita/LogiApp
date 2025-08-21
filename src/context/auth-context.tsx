
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
      setLoading(true);
      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
              setUser(firebaseUser);
              setUserAccount(userAccountData);
              setAccountId(userAccountData.accountId);
            } else {
              // This can happen in a brief moment after signup before the server action completes.
              // Instead of logging an error, we wait. If it persists, it's a real issue.
              // For now, we treat it as "loading account data".
              console.warn("User document not found for UID:", firebaseUser.uid, "- This might be temporary after signup.");
              setUser(firebaseUser); // Set the user, but account is null
              setUserAccount(null);
              setAccountId(null);
            }
          } catch (error) {
            console.error("Error fetching user document:", error);
            await signOut(auth);
            setUser(null);
            setUserAccount(null);
            setAccountId(null);
          }
        } else {
          // Email not verified
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
    
    // If not logged in and not on a public page, redirect to login
    if (!user && !isPublicRoute) {
      router.push('/login');
    } 
    // If logged in, email is verified, but account data is still loading, wait.
    // Except if we are on an auth page, then we can redirect away.
    else if (user && user.emailVerified && !accountId && !isPublicRoute) {
       // Still loading account details, do nothing, show spinner
    }
    // If logged in and on an auth page, redirect to home
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

  const isAuthPage = publicRoutes.some(route => pathname.startsWith(route));
  // Show a global spinner if we are loading auth state or account data, but not on public pages
  if (loading || (user && !accountId && !isAuthPage)) {
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
