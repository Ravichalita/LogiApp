"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Users, BarChart, Settings, ShieldCheck, Download } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { TestNotificationMenuItem } from "./test-notification-menu-item";
import { InstallPwaMenuItem } from "./install-pwa-menu-item";


const navLinks = [
  { href: "/", label: "Ordens de Serviço" },
  { href: "/dumpsters", label: "Caçambas" },
  { href: "/clients", label: "Clientes" },
];

export function Header() {
  const pathname = usePathname();
  const { user, userAccount, logout, isSuperAdmin } = useAuth();
  const isAdmin = userAccount?.role === 'admin' || userAccount?.role === 'owner';
  const permissions = userAccount?.permissions;

  const renderNavLinks = () =>
    navLinks.map((link) => (
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

  // Hide header on auth pages
  if (!user || pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/verify-email')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card">
      <div className="container flex h-16 items-center">
        <div className="flex items-center">
            <Link href="/" className="mr-6 flex items-center space-x-2">
                <svg viewBox="0 0 60 60" className="h-6 w-6 fill-current">
                    <path xmlns="http://www.w3.org/2000/svg" className="cls-1" d="M56.24,18.81c0-2.02-1.09-3.91-2.84-4.92L31.09,1.01c-1.75-1.01-3.93-1.01-5.68,0L3.1,13.9c-1.75,1.01-2.84,2.9-2.84,4.92v25.76c0,2.02,1.1,3.91,2.85,4.92l22.31,12.88c.88.51,1.86.76,2.84.76.98,0,1.97-.25,2.84-.76l22.31-12.89c1.75-1.01,2.84-2.9,2.84-4.92v-25.76ZM51.88,46.84l-22.31,12.89c-.81.47-1.81.47-2.62,0l-22.31-12.88c-.81-.47-1.31-1.34-1.31-2.27v-25.76c0-.93.49-1.8,1.3-2.27L26.93,3.66c.4-.23.86-.35,1.31-.35.45,0,.91.12,1.31.35l22.31,12.88c.81.47,1.31,1.34,1.31,2.27v25.76c0,.93-.49,1.8-1.3,2.27ZM46.69,19.23l-16.87-9.73c-.97-.56-2.17-.56-3.14,0l-8.43,4.87c-.54.31-.51,1.08.04,1.39,0,0,.01,0,.02,0l17.38,9.86c1,.57,1.62,1.63,1.62,2.78v19.65s0,.01,0,.02c0,.66.68,1.1,1.26.76l8.12-4.69c.97-.56,1.57-1.6,1.57-2.72v-19.48c0-1.12-.6-2.16-1.58-2.72Z"/>
                </svg>
            </Link>
          <nav className="hidden md:flex items-center space-x-6">{renderNavLinks()}</nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
            {isSuperAdmin && (
                 <Button variant="ghost" size="icon" asChild className="inline-flex">
                    <Link href="/admin/clients">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="sr-only">Admin Clientes</span>
                    </Link>
                </Button>
            )}

            {(isAdmin || permissions?.canAccessSettings) && (
                 <Button variant="ghost" size="icon" asChild className="inline-flex">
                    <Link href="/settings">
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Ajustes</span>
                    </Link>
                </Button>
            )}

            {(isAdmin || permissions?.canAccessFinance) && (
                 <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
                    <Link href="/finance">
                        <BarChart className="h-5 w-5" />
                        <span className="sr-only">Estatísticas</span>
                    </Link>
                </Button>
            )}

            <ThemeToggle />

            {(isAdmin || permissions?.canAccessTeam) && (
              <Button variant="ghost" size="icon" asChild className="inline-flex">
                  <Link href="/team">
                      <Users className="h-5 w-5" />
                      <span className="sr-only">Equipe</span>
                  </Link>
              </Button>
            )}
            
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-9 w-9">
                   <AvatarFallback className="bg-primary text-primary-foreground">
                    <UserIcon className="h-5 w-5" />
                  </AvatarFallback>
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
              <InstallPwaMenuItem />
              <TestNotificationMenuItem />
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
