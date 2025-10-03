

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Menu, CheckCircle, ExternalLink, Calendar, LogOutIcon, Info } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DesktopHeaderActions, MobileHeaderActions } from "./header-actions";
import { ThemeToggle } from "./theme-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountSwitcher } from "./account-switcher";
import React, { useTransition } from "react";
import { Home, Container, Users, Truck, Workflow, Map } from 'lucide-react';
import { getGoogleAuthUrlAction, disconnectGoogleCalendarAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "./ui/spinner";
import { AboutDialog } from "./about-dialog";


const allNavLinks = [
  { href: '/os', label: 'OS', permission: ['canAccessRentals', 'canAccessOperations'] as const },
  { href: '/route-planning', label: 'Rotas', permission: ['canAccessRoutes'] as const },
  { href: '/dumpsters', label: 'Caçambas', permission: ['canAccessRentals'] as const },
  { href: '/fleet', label: 'Frota', permission: ['canAccessFleet'] as const },
  { href: '/clients', label: 'Clientes', permission: ['canAccessClients'] as const },
];

export function Header({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, userAccount, logout, isSuperAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = React.useState(false);
  const [isConnecting, startConnectTransition] = useTransition();
  const [isDisconnecting, startDisconnectTransition] = useTransition();
  const { toast } = useToast();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const permissions = userAccount?.permissions;
  
  const visibleNavLinks = allNavLinks.filter(link => {
    if (isSuperAdmin) return true;
    if (!permissions) return false;
    return link.permission.some(p => permissions[p]);
  });

  const renderNavLinks = () =>
    visibleNavLinks.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary",
          pathname === link.href ? "text-primary" : "text-muted-foreground"
        )}
      >
        {link.label}
      </Link>
    ));

  const handleConnectGoogleCalendar = () => {
    if (!user) return;
    startConnectTransition(async () => {
      try {
        const result = await getGoogleAuthUrlAction(user.uid);
        if (result.url) {
          window.location.href = result.url;
        } else {
          throw new Error(result.error || 'Não foi possível obter a URL de autenticação.');
        }
      } catch (error) {
        toast({
          title: 'Erro de Conexão',
          description: error instanceof Error ? error.message : 'Falha ao iniciar a conexão com o Google.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleDisconnectGoogleCalendar = () => {
    if (!user) return;
    startDisconnectTransition(async () => {
      try {
        const result = await disconnectGoogleCalendarAction(user.uid);
        if (result.message === 'success') {
          toast({
            title: 'Desconectado',
            description: 'Sua conta do Google Agenda foi desconectada.',
          });
        } else {
          throw new Error(result.error || 'Não foi possível desconectar.');
        }
      } catch(error) {
         toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Falha ao desconectar do Google Agenda.',
          variant: 'destructive',
        });
      }
    });
  };

  const isGoogleCalendarConnected = !!userAccount?.googleCalendar?.accessToken;


  // Hide header on auth pages
  if (!user || pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/verify-email') || pathname.startsWith('/restore-from-backup') || pathname.startsWith('/access-denied')) {
    return null;
  }

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b bg-card", className)}>
      <div className="container flex h-16 items-center">
        <div className="flex items-center">
                     <Link href="/os" className="mr-6 flex items-center space-x-2">
                     <Image 
                        src={isSuperAdmin ? "/super.svg" : "/192x192.png"} 
                        alt="LogiApp Logo" 
                        width={isSuperAdmin ? 40 : 28} 
                        height={isSuperAdmin ? 40 : 28} 
                     />
                <span className="font-bold inline-block text-primary">LogiApp</span>
            </Link>
          <nav className="hidden md:flex items-center space-x-6">{renderNavLinks()}</nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
          <AccountSwitcher />
          {!isMobile && <DesktopHeaderActions />}
          <ThemeToggle />
          
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Abrir menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <MobileHeaderActions />
            </DropdownMenuContent>
           </DropdownMenu>

           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                 <Avatar className="h-9 w-9">
                    {userAccount?.avatarUrl ? (
                        <AvatarImage src={userAccount.avatarUrl} alt={userAccount.name} />
                    ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground">
                            <UserIcon className="h-5 w-5" />
                        </AvatarFallback>
                    )}
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userAccount?.name || 'Usuário'}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                  <Link href="/account">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Sua Conta</span>
                  </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isGoogleCalendarConnected ? (
                <>
                    <DropdownMenuItem disabled>
                      <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                      <span>Google Agenda Conectado</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDisconnectGoogleCalendar} disabled={isDisconnecting}>
                      {isDisconnecting ? <Spinner size="small" className="mr-2" /> : <LogOutIcon className="mr-2 h-4 w-4" />}
                      <span>Desconectar</span>
                    </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={handleConnectGoogleCalendar} disabled={isConnecting}>
                    {isConnecting ? <Spinner size="small" className="mr-2" /> : <Calendar className="mr-2 h-4 w-4" />}
                    <span>Conectar Google Agenda</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <AboutDialog />
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
