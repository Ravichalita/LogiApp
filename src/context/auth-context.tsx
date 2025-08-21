
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import type { UserAccount } from '@/lib/types';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';


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
              // User exists in Auth but not in Firestore, something is wrong
              // This might happen if Firestore write fails during signup
              console.error("User document not found in Firestore for UID:", firebaseUser.uid);
              await signOut(auth); // Log them out to be safe
              setUser(null);
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
    
    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user && user.emailVerified && authRoutes.some(route => pathname.startsWith(route))) {
      router.push('/');
    }
  }, [user, loading, pathname, router]);


  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserAccount(null);
    setAccountId(null);
    router.push('/login');
  };

  const isAuthPage = publicRoutes.some(route => pathname.startsWith(route));
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
