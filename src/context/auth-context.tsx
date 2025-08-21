
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebase } from '@/lib/firebase';
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

const publicRoutes = ['/login', '/signup'];
// Add verify-email to the list of routes that DON'T require an authenticated user.
const nonAuthRoutes = ['/login', '/signup', '/verify-email'];

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { auth, db } = getFirebase();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
          if (!firebaseUser.emailVerified && !pathname.startsWith('/verify-email')) {
             router.push('/verify-email');
             setLoading(false);
             return;
          }

          if(firebaseUser.emailVerified && pathname.startsWith('/verify-email')) {
             router.push('/');
          }
          
          // Retry mechanism to handle the race condition with Firebase Function trigger
          let userDocSnap;
          for (let i = 0; i < 3; i++) {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                  break; 
              }
              await delay(i === 0 ? 1500 : 2000); // Wait 1.5s, then 2s
          }


          if (userDocSnap && userDocSnap.exists()) {
            const userAccountData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
            setUser(firebaseUser);
            setUserAccount(userAccountData);
            setAccountId(userAccountData.accountId);
          } else {
            console.error("User document not found in Firestore for UID:", firebaseUser.uid);
            await signOut(auth);
            setUser(null);
            setUserAccount(null);
            setAccountId(null);
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
  }, [auth, db]); 

  useEffect(() => {
    if (loading) return;

    const isNonAuthRoute = nonAuthRoutes.some(route => pathname.startsWith(route));
    
    if (!user && !isNonAuthRoute) {
      router.push('/login');
    } 
    else if (user && publicRoutes.some(route => pathname.startsWith(route))) {
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
  
  const isAppLoading = loading || (!user && !nonAuthRoutes.some(route => pathname.startsWith(route)));

  if (isAppLoading) {
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
