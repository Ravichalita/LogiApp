
"use client";

import { BarChart, Menu, ShieldCheck, Users, Megaphone, Settings, Download, Bell, User, History, UserCog, BarChart3 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenuItem,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import React from "react";
import { InstallPwaMenuItem } from "./install-pwa-menu-item";
import { TestNotificationMenuItem } from "./test-notification-menu-item";


const navActions = [
    {
    href: "/admin/superadmins",
    icon: <UserCog className="h-5 w-5" />,
    label: "Super Admins",
    shouldRender: (isSuperAdmin: boolean) => isSuperAdmin,
    },
    {
    href: "/admin/clients",
    icon: <ShieldCheck className="h-5 w-5" />,
    label: "Admin Clientes",
    shouldRender: (isSuperAdmin: boolean) => isSuperAdmin,
    },
    {
    href: "/finance",
    icon: <BarChart3 className="h-5 w-5" />,
    label: "Financeiro",
    shouldRender: (isSuperAdmin: boolean, permissions: any, isMobile: boolean) => permissions?.canAccessFinance && !isMobile,
    },
    {
    href: "/notifications-studio",
    icon: <Megaphone className="h-5 w-5" />,
    label: "Notificações Personalizadas",
    shouldRender: (isSuperAdmin: boolean, permissions: any) => isSuperAdmin || permissions?.canAccessNotificationsStudio,
    },
    {
    href: "/team",
    icon: <Users className="h-5 w-5" />,
    label: "Equipe",
    shouldRender: (isSuperAdmin: boolean, permissions: any) => permissions?.canAccessTeam,
    },
];

const userActions = [
    {
    href: "/settings",
    icon: <Settings className="mr-2 h-4 w-4" />,
    label: "Configurações",
    component: Link,
    shouldRender: (isSuperAdmin: boolean, permissions: any) => permissions?.canAccessSettings,
    },
    {
    href: "#",
    icon: <Download className="mr-2 h-4 w-4" />,
    label: "Instalar App",
    component: InstallPwaMenuItem,
    shouldRender: () => true,
    },
    {
    href: "#",
    icon: <Bell className="mr-2 h-4 w-4" />,
    label: "Testar Notificações",
    component: TestNotificationMenuItem,
    shouldRender: () => true,
    },
]

export function HeaderActions({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}

export function DesktopHeaderActions() {
    const { userAccount, isSuperAdmin } = useAuth();
    const permissions = userAccount?.permissions;

    return (
        <>
        {navActions.filter(action => action.shouldRender(isSuperAdmin, permissions, false)).map((action) => (
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

export function MobileHeaderActions() {
    const { userAccount, isSuperAdmin } = useAuth();
    const permissions = userAccount?.permissions;
    
    const mobileNavActions = navActions.filter(a => a.shouldRender(isSuperAdmin, permissions, true));
    const mobileUserActions = userActions.filter(a => a.shouldRender(isSuperAdmin, permissions));

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
