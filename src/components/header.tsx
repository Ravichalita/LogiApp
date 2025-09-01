
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
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
import { TestNotificationMenuItem } from "./test-notification-menu-item";
import { InstallPwaMenuItem } from "./install-pwa-menu-item";
import { HeaderActions } from "./header-actions";
import { ThemeToggle } from "./theme-toggle";


const navLinks = [
  { href: "/", label: "Ordens de Serviço" },
  { href: "/dumpsters", label: "Caçambas" },
  { href: "/clients", label: "Clientes" },
];

export function Header() {
  const pathname = usePathname();
  const { user, userAccount, logout } = useAuth();
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
                     <Image src="/192x192.png" alt="LogiApp Logo" width={28} height={28} />
                <span className="font-bold inline-block text-primary">LogiApp</span>
            </Link>
          <nav className="hidden md:flex items-center space-x-6">{renderNavLinks()}</nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
          <HeaderActions />
          <ThemeToggle />
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
