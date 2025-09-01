
"use client";

import { BarChart, MoreVertical, ShieldCheck, Users, Megaphone, Settings, Download, Bell, User } from "lucide-react";
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
     {
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
      label: "Configurações",
      shouldRender: isAdmin || permissions?.canAccessSettings,
    },
  ];
  
  const userActions = [
     {
      href: "/account",
      icon: <User className="mr-2 h-4 w-4" />,
      label: "Sua Conta",
      component: Link,
      shouldRender: true,
    },
    {
      href: "/settings",
      icon: <Settings className="mr-2 h-4 w-4" />,
      label: "Configurações",
      component: Link,
      shouldRender: isMobile && (isAdmin || permissions?.canAccessSettings), // Only for mobile dropdown
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

  const visibleNavActions = navActions.filter((action) => action.shouldRender);
  const visibleUserActions = userActions.filter((action) => action.shouldRender);


  if (!isClient) {
    return null;
  }

  if (isMobile) {
    // On mobile, the combined list goes into the dropdown
    const allMobileActions = [
        ...visibleNavActions,
        // Add separator if both lists have items
        ...(visibleNavActions.length > 0 && visibleUserActions.length > 0 ? [{isSeparator: true}] : []),
        ...visibleUserActions
    ];
    
    if (allMobileActions.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">Mais opções</span>
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
            
            {userActions.filter(a => a.shouldRender).map((action, index) => {
              if ('component' in action) {
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
                 // For components like InstallPwaMenuItem, which is a DropdownMenuItem itself
                return <ActionComponent key={action.label} />
              }
              return null;
            })}

        </DropdownMenuContent>
        </DropdownMenu>
    );
  }

  // Desktop view
  return (
    <>
      {visibleNavActions.map((action) => (
        <Button key={action.href} variant="ghost" size="icon" asChild>
          <Link href={action.href}>
            {action.icon}
            <span className="sr-only">{action.label}</span>
          </Link>
        </Button>
      ))}
    </>
  );
}
