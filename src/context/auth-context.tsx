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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.emailVerified) {
          setUser(user);
          // Fetch user profile from Firestore to get accountId and role
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
              const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
              setUserAccount(userAccountData);
              setAccountId(userAccountData.accountId);
          } else {
             // This case might happen during the signup process before the user doc is created
             console.log("User document doesn't exist yet.");
          }
        } else {
          setUser(null);
          setUserAccount(null);
          setAccountId(null);
          if (!pathname.startsWith('/verify-email')) {
             router.push('/verify-email');
          }
        }
      } else {
        setUser(null);
        setUserAccount(null);
        setAccountId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = publicRoutes.includes(pathname);
    
    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user && user.emailVerified && authRoutes.includes(pathname)) {
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

  if (loading || (!user && !publicRoutes.includes(pathname))) {
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
