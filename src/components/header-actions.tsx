
"use client";

import { BarChart, Menu, ShieldCheck, Users, Megaphone, Settings, Download, Bell, User, History } from "lucide-react";
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
      icon: <History className="h-5 w-5" />,
      label: "Histórico",
      shouldRender: permissions?.canAccessFinance && !isMobile,
    },
    {
      href: "/notifications-studio",
      icon: <Megaphone className="h-5 w-5" />,
      label: "Notificações Personalizadas",
      shouldRender:
        isSuperAdmin || permissions?.canAccessNotificationsStudio,
    },
    {
      href: "/team",
      icon: <Users className="h-5 w-5" />,
      label: "Equipe",
      shouldRender: permissions?.canAccessTeam,
    },
  ];
  
  const userActions = [
    {
      href: "/settings",
      icon: <Settings className="mr-2 h-4 w-4" />,
      label: "Configurações",
      component: Link,
      shouldRender: permissions?.canAccessSettings,
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
  const visibleMobileActions = [...navActions, ...userActions].filter((action) => action.shouldRender && (action.href !== '/finance' || !isMobile));

  if (!isClient) {
    return null;
  }

  if (isMobile) {
    if (visibleMobileActions.length === 0) {
        return null;
    }

    const mobileNavActions = navActions.filter(a => a.shouldRender && a.href !== '/finance');
    const mobileUserActions = userActions.filter(a => a.shouldRender);

    return (
        <>
            {mobileNavActions.map(action => (
                 <DropdownMenuItem key={action.href} asChild>
                    <Link href={action.href}>
                        {React.cloneElement(action.icon, {className: "mr-2 h-4 w-4"})}
                        <span>{action.label}</span>
                    </Link>
                </DropdownMenuItem>
            ))}
            
            {(mobileNavActions.length > 0 && mobileUserActions.length > 0) && <DropdownMenuSeparator />}
            
            {mobileUserActions.map((action) => {
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
        </>
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
      {permissions?.canAccessSettings && (
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
