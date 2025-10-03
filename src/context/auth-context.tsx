

'use client';

import React, { createContext, useCallback, useEffect, useRef, useState, useContext } from 'react';
import { getAuth, onAuthStateChanged, User, signOut, getIdTokenResult } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { getFirebase, setupFcm, getFirebaseIdToken, cleanupFcm } from '@/lib/firebase-client';
import type { UserAccount, UserRole, Account, Permissions } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { createFirestoreBackupAction, checkAndSendDueNotificationsAction, sendFirstLoginNotificationToSuperAdminAction } from '@/lib/actions';
import { ensureUserDocument } from '@/lib/data-server';
import { differenceInDays, parseISO } from 'date-fns';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { sendNotification } from '@/lib/notifications-client';


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
  accountId: string | null; // This will be the effective accountId (impersonated if active)
  realAccountId: string | null; // The user's actual accountId
  loading: boolean;
  logout: () => Promise<void>;
  role: UserRole | null;
  isSuperAdmin: boolean;
  impersonatedAccountId: string | null;
  setImpersonatedAccountId: (accountId: string) => void;
  clearImpersonation: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isPwaInstalled: boolean;
  handleInstall: () => void;
  accountMissing: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userAccount: null,
  accountId: null,
  realAccountId: null,
  loading: true,
  logout: async () => {},
  role: null,
  isSuperAdmin: false,
  impersonatedAccountId: null,
  setImpersonatedAccountId: () => {},
  clearImpersonation: () => {},
  deferredPrompt: null,
  isPwaInstalled: false,
  handleInstall: () => {},
  accountMissing: false,
});

const nonAuthRoutes = ['/login', '/signup'];
const publicRoutes = [...nonAuthRoutes, '/verify-email', '/restore-from-backup', '/privacy-policy', '/terms-of-service'];

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
  const [accountId, setAccountId] = useState<string | null>(null); // The effective (potentially impersonated) account ID
  const [realAccountId, setRealAccountId] = useState<string | null>(null); // The user's true account ID from claims
  const [impersonatedAccountId, setImpersonatedAccountIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [accountMissing, setAccountMissing] = useState(false);
  const sessionWorkPerformed = useRef(false); // Used for all once-per-session tasks
  
  const fcmUnsubscribe = useRef<() => void>(() => {});

  const { auth, db } = getFirebase();
  const router = useRouter();
  const pathname = usePathname();
  
  const userDocUnsubscribe = useRef<() => void | null>(null);
  const accountDocUnsubscribe = useRef<() => void | null>(null);

  const setImpersonatedAccountId = (newAccountId: string) => {
    if (isSuperAdmin) {
      localStorage.setItem('impersonatedAccountId', newAccountId);
      setImpersonatedAccountIdState(newAccountId);
      setAccountId(newAccountId);
    }
  };

  const clearImpersonation = () => {
    if (isSuperAdmin) {
      localStorage.removeItem('impersonatedAccountId');
      setImpersonatedAccountIdState(null);
      setAccountId(realAccountId);
    }
  };

  const logout = useCallback(async () => {
    if (userDocUnsubscribe.current) userDocUnsubscribe.current();
    if (accountDocUnsubscribe.current) accountDocUnsubscribe.current();

    userDocUnsubscribe.current = null;
    accountDocUnsubscribe.current = null;
    
    localStorage.removeItem('impersonatedAccountId'); // Clear impersonation on logout

    setLoading(true);
    setUser(null);
    setUserAccount(null);
    setAccount(null);
    setAccountId(null);
    setRealAccountId(null);
    setImpersonatedAccountIdState(null);
    setRole(null);
    setIsSuperAdmin(false);
    setAccountMissing(false);
    sessionWorkPerformed.current = false; // Reset session work on logout
    cleanupFcm(); // Clean up FCM listener on logout
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
        updateDoc(userRef, { 
            hasSeenWelcome: true,
            firstAccessAt: new Date().toISOString()
        }).catch(console.error);
        setShowWelcomeDialog(false);
    }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setIsSuperAdmin(false);
      sessionWorkPerformed.current = false; // Reset on user change
      setShowWelcomeDialog(false);
      setAccountMissing(false);

      if (userDocUnsubscribe.current) userDocUnsubscribe.current();
      if (accountDocUnsubscribe.current) accountDocUnsubscribe.current();
      cleanupFcm(); // Clean up previous FCM listener

      if (!firebaseUser) {
        setUser(null);
        setUserAccount(null);
        setAccount(null);
        setAccountId(null);
        setRole(null);
        setLoading(false);
        return;
      }
      
      const isInitialSuperAdminUser = firebaseUser.email === SUPER_ADMIN_EMAIL;
      
      if (!firebaseUser.emailVerified && !isInitialSuperAdminUser) {
          setUser(firebaseUser);
          setLoading(false);
          return;
      }

      try {
        await getFirebaseIdToken(); // Force refresh the token to get fresh claims.
        let tokenResult = await getIdTokenResult(firebaseUser);
        let claimsAccountId = tokenResult.claims.accountId as string | undefined;
        let claimsRole = tokenResult.claims.role as UserRole | undefined;

        // *** RECOVERY LOGIC ***
        if (!claimsAccountId && isInitialSuperAdminUser) {
            console.log("Super admin is missing claims. Attempting to ensure user document exists...");
            await ensureUserDocument({
                name: firebaseUser.displayName || 'Super Admin',
                email: firebaseUser.email!,
            }, null, 'superadmin'); // Pass role explicitly
            tokenResult = await getIdTokenResult(firebaseUser, true);
            claimsAccountId = tokenResult.claims.accountId as string | undefined;
            claimsRole = tokenResult.claims.role as UserRole | undefined;

            if (!claimsAccountId) {
                console.error("Critical: Failed to set claims for super admin after recovery attempt. Logging out.");
                await logout();
                return;
            }
        } else if (!claimsAccountId && !isInitialSuperAdminUser) {
            console.error("Critical: accountId claim is missing for non-superadmin. Logging out.");
            await logout();
            return;
        }

        const userIsSuperAdmin = claimsRole === 'superadmin';
        setIsSuperAdmin(userIsSuperAdmin);
        setRealAccountId(claimsAccountId!);

        let effectiveAccountId = claimsAccountId!;
        if (userIsSuperAdmin) {
            const storedImpersonationId = localStorage.getItem('impersonatedAccountId');
            if (storedImpersonationId) {
                effectiveAccountId = storedImpersonationId;
                setImpersonatedAccountIdState(storedImpersonationId);
            }
        }
        
        setUser(firebaseUser);
        setAccountId(effectiveAccountId);

        fcmUnsubscribe.current = await setupFcm(firebaseUser.uid);
        
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubscribe.current = onSnapshot(userDocRef, async (userDocSnap) => {
            if (userDocSnap.exists()) {
                 let userData = { id: userDocSnap.id, ...userDocSnap.data() } as UserAccount;
                 
                 // Divergent account ID security check
                 if (userData.role !== 'superadmin' && userData.accountId !== claimsAccountId) {
                    console.error("User doc accountId is divergent from claims. Forcing logout for security.");
                    logout();
                    return; 
                 }
                 
                if (userData.role === 'superadmin') {
                    // ** CRITICAL FIX: Ensure super admin permissions are always fully loaded **
                    userData.permissions = {
                        canAccessRentals: true,
                        canAccessOperations: true,
                        canAccessRoutes: true,
                        canAccessClients: true,
                        canAccessDumpsters: true,
                        canAccessFleet: true,
                        canAccessTeam: true,
                        canAccessFinance: true,
                        canAccessNotificationsStudio: true,
                        canAccessSettings: true,
                        canEditRentals: true,
                        canSeeServiceValue: true,
                        canEditOperations: true,
                        canEditDumpsters: true,
                        canEditFleet: true,
                        canAddClients: true,
                        canEditClients: true,
                        canUseAttachments: true,
                    };
                } else if (userData.role === 'admin') {
                    // If user is admin, fetch owner's permissions to ensure they are correct
                    const accountDoc = await getDoc(doc(db, 'accounts', userData.accountId));
                    if (accountDoc.exists()) {
                        const ownerId = accountDoc.data().ownerId;
                        if (ownerId) {
                            const ownerDoc = await getDoc(doc(db, 'users', ownerId));
                            if (ownerDoc.exists()) {
                                userData.permissions = ownerDoc.data().permissions as Permissions;
                            }
                        }
                    }
                }

                 setUserAccount(userData);
                 setRole(userData.role);

                 if (!userData.hasSeenWelcome) {
                     setShowWelcomeDialog(true);
                     sendNotification({
                         userId: userData.id,
                         title: "Bem-vindo ao LogiApp!",
                         body: "Instale o LogiApp na sua tela inicial para uma experiência melhor.",
                     });

                     if (userData.role !== 'superadmin') {
                        sendFirstLoginNotificationToSuperAdminAction(userData.name);
                     }
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
                setAccountMissing(false); 
            } else {
                console.error("Account document not found after claims were confirmed. Activating recovery mode.");
                setAccountMissing(true);
                setAccount(null);
                setUserAccount(null);
                setLoading(false);
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

    return () => {
        unsubscribe();
        if (fcmUnsubscribe.current) {
            fcmUnsubscribe.current();
        }
    };
  }, [auth, db, logout]);


  useEffect(() => {
    if (user && userAccount && account && !sessionWorkPerformed.current) {
        
        checkAndTriggerAutoBackup(account.id, account);
        checkAndSendDueNotificationsAction(account.id);

        sessionWorkPerformed.current = true; 
        setLoading(false); 
    }
  }, [user, userAccount, account]);


  useEffect(() => {
    if (loading) return;

    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    if (accountMissing && !pathname.startsWith('/restore-from-backup')) {
        router.push('/restore-from-backup');
        return;
    }


    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user) {
       const isSuperAdminUser = role === 'superadmin';
       if (!user.emailVerified && !isSuperAdminUser) {
         if (!pathname.startsWith('/verify-email')) {
            router.push('/verify-email');
         }
       } else if ((user.emailVerified || isSuperAdminUser) && nonAuthRoutes.includes(pathname)) {
         router.push('/os');
      }
    }
  }, [user, loading, pathname, router, accountMissing, role]);
  
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
    realAccountId,
    loading,
    logout,
    role,
    isSuperAdmin,
    impersonatedAccountId,
    setImpersonatedAccountId,
    clearImpersonation,
    deferredPrompt,
    isPwaInstalled,
    handleInstall,
    accountMissing,
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
