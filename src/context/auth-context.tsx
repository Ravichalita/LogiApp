
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
          // Only fetch if userAccount is not already set for this user
          if (!userAccount || userAccount.id !== user.uid) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                setUserAccount(userAccountData);
                setAccountId(userAccountData.accountId);
            } else {
               console.log("User document doesn't exist yet.");
               // This can happen on first signup, log them out to be safe
               // or redirect to a waiting page. For now, we clear state.
               setUser(null);
               setUserAccount(null);
               setAccountId(null);
            }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

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

  if (loading || (!user && !publicRoutes.some(route => pathname.startsWith(route)))) {
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
