
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Users, BarChart, Settings, ShieldCheck, Download, Megaphone, MoreVertical } from "lucide-react";
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

  const userActions = (
    <>
      {isSuperAdmin && (
        <DropdownMenuItem asChild>
          <Link href="/admin/clients">
            <ShieldCheck />
            <span>Painel de Clientes</span>
          </Link>
        </DropdownMenuItem>
      )}
      {(isAdmin || permissions?.canAccessFinance) && (
        <DropdownMenuItem asChild>
          <Link href="/finance">
            <BarChart />
            <span>Estatísticas</span>
          </Link>
        </DropdownMenuItem>
      )}
      {(isSuperAdmin || (isAdmin || permissions?.canAccessNotificationsStudio)) && (
        <DropdownMenuItem asChild>
          <Link href="/notifications-studio">
            <Megaphone />
            <span>Notificações</span>
          </Link>
        </DropdownMenuItem>
      )}
      {(isAdmin || permissions?.canAccessTeam) && (
        <DropdownMenuItem asChild>
          <Link href="/team">
            <Users />
            <span>Equipe</span>
          </Link>
        </DropdownMenuItem>
      )}
    </>
  )

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card">
      <div className="container flex h-16 items-center">
        <div className="flex items-center">
           <Link href="/" className="mr-6 flex items-center space-x-2">
             <Image src="/192x192.png" alt="LogiApp Logo" width={28} height={28} />
             <span className="font-bold inline-block text-primary">LogiApp</span>
            </Link>
          <nav className="hidden md:flex items-center space-x-6">{renderNavLinks()}</nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
            {/* Desktop Icons */}
            <div className="hidden md:flex items-center space-x-1">
              {isSuperAdmin && (
                   <Button variant="ghost" size="icon" asChild>
                      <Link href="/admin/clients">
                          <ShieldCheck className="h-5 w-5" />
                          <span className="sr-only">Admin Clientes</span>
                      </Link>
                  </Button>
              )}
              {(isAdmin || permissions?.canAccessFinance) && (
                   <Button variant="ghost" size="icon" asChild>
                      <Link href="/finance">
                          <BarChart className="h-5 w-5" />
                          <span className="sr-only">Estatísticas</span>
                      </Link>
                  </Button>
              )}
               {(isSuperAdmin || (isAdmin || permissions?.canAccessNotificationsStudio)) && (
                  <Button variant="ghost" size="icon" asChild>
                      <Link href="/notifications-studio">
                          <Megaphone className="h-5 w-5" />
                          <span className="sr-only">Notificações</span>
                      </Link>
                  </Button>
              )}
              {(isAdmin || permissions?.canAccessTeam) && (
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/team">
                        <Users className="h-5 w-5" />
                        <span className="sr-only">Equipe</span>
                    </Link>
                </Button>
              )}
            </div>

            <ThemeToggle />

            {/* Mobile Dropdown */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Mais opções</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Ações Rápidas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {userActions}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
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
              {(isAdmin || permissions?.canAccessSettings) && (
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configurações</span>
                  </Link>
                </DropdownMenuItem>
              )}
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
