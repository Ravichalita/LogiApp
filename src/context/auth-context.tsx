
'use client';

import React, { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { getAuth, onAuthStateChanged, User, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getFirebase, setupFcm } from '@/lib/firebase-client';
import type { UserAccount, UserRole, Account } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { createFirestoreBackupAction, checkAndSendDueNotificationsAction } from '@/lib/actions';
import { ensureUserDocument } from '@/lib/data-server';
import { differenceInDays, parseISO } from 'date-fns';
import { WelcomeDialog } from '@/components/welcome-dialog';


interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface AuthContextType {
  user: User | null;
  userAccount: UserAccount | null;
  accountId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
  role: UserRole | null;
  isSuperAdmin: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isPwaInstalled: boolean;
  handleInstall: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userAccount: null,
  accountId: null,
  loading: true,
  logout: async () => {},
  role: null,
  isSuperAdmin: false,
  deferredPrompt: null,
  isPwaInstalled: false,
  handleInstall: () => {},
});

const nonAuthRoutes = ['/login', '/signup'];
const publicRoutes = [...nonAuthRoutes, '/verify-email'];

// Define o email do Super Admin. Somente este usuário poderá criar novas contas de cliente.
const SUPER_ADMIN_EMAIL = 'contato@econtrol.com.br';

const checkAndTriggerAutoBackup = (accountId: string, account: Account | null) => {
    if (!accountId || !account) return;

    const { lastBackupDate, backupPeriodicityDays, backupRetentionDays } = account;
    
    if (!lastBackupDate) {
        console.log("No previous backup found. Triggering initial automatic backup.");
        createFirestoreBackupAction(accountId, backupRetentionDays).catch(e => console.error("Auto-backup failed:", e));
        return;
    }

    const lastBackup = parseISO(lastBackupDate);
    const today = new Date();
    const daysSinceLastBackup = differenceInDays(today, lastBackup);
    
    if (daysSinceLastBackup >= (backupPeriodicityDays || 7)) {
        console.log(`Last backup was ${daysSinceLastBackup} days ago. Triggering automatic backup.`);
        createFirestoreBackupAction(accountId, backupRetentionDays).catch(e => console.error("Auto-backup failed:", e));
    }
}


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const sessionWorkPerformed = useRef(false); // Used for all once-per-session tasks
  const fcmSetupPerformed = useRef(false); // Prevent multiple FCM setup calls

  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();
  
  const userDocUnsubscribe = useRef<() => void | null>(null);
  const accountDocUnsubscribe = useRef<() => void | null>(null);

  const logout = useCallback(async () => {
    if (userDocUnsubscribe.current) userDocUnsubscribe.current();
    if (accountDocUnsubscribe.current) accountDocUnsubscribe.current();

    userDocUnsubscribe.current = null;
    accountDocUnsubscribe.current = null;
    
    setLoading(true);
    setUser(null);
    setUserAccount(null);
    setAccount(null);
    setAccountId(null);
    setRole(null);
    setIsSuperAdmin(false);
    sessionWorkPerformed.current = false; // Reset session work on logout
    fcmSetupPerformed.current = false; // Reset FCM setup on logout
    await signOut(auth);
    router.push('/login');
  }, [auth, router]);

   useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        
        const handleAppInstalled = () => {
            setIsPwaInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check if the app is already installed on load
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsPwaInstalled(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('PWA installation accepted');
        } else {
            console.log('PWA installation dismissed');
        }
        setDeferredPrompt(null);
    };
    
    const handleCloseWelcomeDialog = () => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { hasSeenWelcome: true }).catch(console.error);
        setShowWelcomeDialog(false);
    }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setIsSuperAdmin(false);
      sessionWorkPerformed.current = false; // Reset on user change
      fcmSetupPerformed.current = false;
      setShowWelcomeDialog(false);
      if (userDocUnsubscribe.current) userDocUnsubscribe.current();
      if (accountDocUnsubscribe.current) accountDocUnsubscribe.current();

      if (!firebaseUser) {
        setUser(null);
        setUserAccount(null);
        setAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      const isSuperAdminUser = firebaseUser.email === SUPER_ADMIN_EMAIL;
      
      if (!firebaseUser.emailVerified && !isSuperAdminUser) {
          setUser(firebaseUser);
          setLoading(false);
          return;
      }

      try {
        let tokenResult = await getIdTokenResult(firebaseUser);
        let claimsAccountId = tokenResult.claims.accountId as string | undefined;

        // *** RECOVERY LOGIC ***
        // If claims are missing, it might be a new super admin user who needs their account created.
        if (!claimsAccountId && isSuperAdminUser) {
            console.log("Super admin is missing claims. Attempting to ensure user document exists...");
            await ensureUserDocument({
                name: firebaseUser.displayName || 'Super Admin',
                email: firebaseUser.email!,
                // Password is not needed here as auth user already exists.
                // The server action will handle this case gracefully.
            });
            // Force refresh the token to get the new claims.
            tokenResult = await getIdTokenResult(firebaseUser, true);
            claimsAccountId = tokenResult.claims.accountId as string | undefined;

            if (!claimsAccountId) {
                // If claims are still missing after recovery attempt, something is critically wrong.
                console.error("Critical: Failed to set claims for super admin after recovery attempt. Logging out.");
                await logout();
                return;
            }
        } else if (!claimsAccountId && !isSuperAdminUser) {
            console.error("Critical: accountId claim is missing for non-superadmin. Logging out.");
            await logout();
            return;
        }

        const effectiveAccountId = claimsAccountId!;
        
        setUser(firebaseUser);
        setAccountId(effectiveAccountId);
        
        if (isSuperAdminUser) {
            setIsSuperAdmin(true);
        }
        
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubscribe.current = onSnapshot(userDocRef, (userDocSnap) => {
            if (userDocSnap.exists()) {
                 const userData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                 
                 if (!userData.accountId || userData.accountId !== effectiveAccountId) {
                    console.error("User doc accountId is missing or divergent from claims. Forcing logout for security.");
                    logout();
                    return; 
                 }
                 
                 setUserAccount(userData);
                 setRole(userData.role);

                 // Check if it's the first time the user sees this
                 if (!userData.hasSeenWelcome) {
                     setShowWelcomeDialog(true);
                 }

            } else {
                console.error("User document not found, which should not happen after login. Logging out.");
                logout();
            }
        }, async (error) => {
            console.error("Error listening to user document:", error);
            await logout();
        });

        const accountDocRef = doc(db, 'accounts', effectiveAccountId);
        accountDocUnsubscribe.current = onSnapshot(accountDocRef, async (accountSnap) => {
            if (accountSnap.exists()) {
                const accountData = { id: accountSnap.id, ...accountSnap.data() } as Account;
                setAccount(accountData);
            } else {
                console.error("Account document not found after claims were confirmed. Logging out.");
                logout();
            }
        }, async (error) => {
             console.error("Error listening to account document:", error);
             await logout();
        });

      } catch (error) {
        console.error("Critical error during auth state processing:", error);
        await logout();
      }
    });

    return () => unsubscribe();
  }, [auth, db, logout]);


  useEffect(() => {
    // This effect runs when all user and account data are loaded.
    // It's the ideal place for "once-per-session" tasks.
    if (user && userAccount && account && !sessionWorkPerformed.current) {
        
        // --- Perform all session tasks here ---
        checkAndTriggerAutoBackup(account.id, account);
        checkAndSendDueNotificationsAction(account.id);

        if (!fcmSetupPerformed.current) {
            setupFcm(user.uid);
            fcmSetupPerformed.current = true;
        }

        sessionWorkPerformed.current = true; // Mark as done for this session.
        setLoading(false); // Now we are truly done loading.
    }
  }, [user, userAccount, account]);


  useEffect(() => {
    if (loading) return;

    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user) {
       const isSuperAdminUser = user.email === SUPER_ADMIN_EMAIL;
       if (!user.emailVerified && !isSuperAdminUser) {
         if (!pathname.startsWith('/verify-email')) {
            router.push('/verify-email');
         }
       } else if ((user.emailVerified || isSuperAdminUser) && nonAuthRoutes.includes(pathname)) {
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
    isSuperAdmin,
    deferredPrompt,
    isPwaInstalled,
    handleInstall,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      <WelcomeDialog isOpen={showWelcomeDialog} onClose={handleCloseWelcomeDialog} />
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
