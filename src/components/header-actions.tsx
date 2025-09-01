
"use client";

import { BarChart, Menu, ShieldCheck, Users, Megaphone, Settings, Download, Bell, User } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import React from "react";
import { InstallPwaMenuItem } from "./install-pwa-menu-item";
import { TestNotificationMenuItem } from "./test-notification-menu-item";

export function HeaderActions() {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = React.useState(false);
  const { userAccount, isSuperAdmin } = useAuth();
  const isAdmin = userAccount?.role === "admin" || userAccount?.role === "owner";
  const permissions = userAccount?.permissions;

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const navActions = [
    {
      href: "/admin/clients",
      icon: <ShieldCheck className="h-5 w-5" />,
      label: "Admin Clientes",
      shouldRender: isSuperAdmin,
    },
    {
      href: "/finance",
      icon: <BarChart className="h-5 w-5" />,
      label: "Estatísticas",
      shouldRender: isAdmin || permissions?.canAccessFinance,
    },
    {
      href: "/notifications-studio",
      icon: <Megaphone className="h-5 w-5" />,
      label: "Notificações Personalizadas",
      shouldRender:
        isSuperAdmin || (isAdmin || permissions?.canAccessNotificationsStudio),
    },
    {
      href: "/team",
      icon: <Users className="h-5 w-5" />,
      label: "Equipe",
      shouldRender: isAdmin || permissions?.canAccessTeam,
    },
  ];
  
  const userActions = [
    {
      href: "/settings",
      icon: <Settings className="mr-2 h-4 w-4" />,
      label: "Configurações",
      component: Link,
      shouldRender: isAdmin || permissions?.canAccessSettings,
    },
    {
      href: "#",
      icon: <Download className="mr-2 h-4 w-4" />,
      label: "Instalar App",
      component: InstallPwaMenuItem,
      shouldRender: true,
    },
     {
      href: "#",
      icon: <Bell className="mr-2 h-4 w-4" />,
      label: "Testar Notificações",
      component: TestNotificationMenuItem,
      shouldRender: true,
    },
  ]

  const visibleDesktopActions = navActions.filter((action) => action.shouldRender);
  const visibleMobileActions = [...navActions, ...userActions].filter((action) => action.shouldRender);

  if (!isClient) {
    return null;
  }

  if (isMobile) {
    if (visibleMobileActions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menu</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            {navActions.filter(a => a.shouldRender).map(action => (
                 <DropdownMenuItem key={action.href} asChild>
                    <Link href={action.href}>
                        {React.cloneElement(action.icon, {className: "mr-2 h-4 w-4"})}
                        <span>{action.label}</span>
                    </Link>
                </DropdownMenuItem>
            ))}
            
            {(navActions.filter(a => a.shouldRender).length > 0 && userActions.filter(a => a.shouldRender).length > 0) && <DropdownMenuSeparator />}
            
            {userActions.filter(a => a.shouldRender).map((action) => {
              const ActionComponent = action.component;
              if (ActionComponent === Link) {
                  return (
                  <DropdownMenuItem key={action.href} asChild>
                      <Link href={action.href}>
                      {action.icon}
                      <span>{action.label}</span>
                      </Link>
                  </DropdownMenuItem>
                  )
              }
               return <ActionComponent key={action.label} />
            })}

        </DropdownMenuContent>
        </DropdownMenu>
    );
  }

  // Desktop view
  return (
    <>
      {visibleDesktopActions.map((action) => (
        <Button key={action.href} variant="ghost" size="icon" asChild>
          <Link href={action.href}>
            {action.icon}
            <span className="sr-only">{action.label}</span>
          </Link>
        </Button>
      ))}
      {(isAdmin || permissions?.canAccessSettings) && (
           <Button variant="ghost" size="icon" asChild>
              <Link href="/settings">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Configurações</span>
              </Link>
          </Button>
      )}
    </>
  );
}
