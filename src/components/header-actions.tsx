
"use client";

import { BarChart, MoreVertical, ShieldCheck, Users, Megaphone } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";

export function HeaderActions() {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = React.useState(false);
  const { userAccount, isSuperAdmin } = useAuth();
  const isAdmin = userAccount?.role === "admin" || userAccount?.role === "owner";
  const permissions = userAccount?.permissions;

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const actions = [
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

  const visibleActions = actions.filter((action) => action.shouldRender);

  if (!isClient) {
    return null;
  }

  if (isMobile) {
    if (visibleActions.length === 0) {
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
            {visibleActions.map((action) => (
            <DropdownMenuItem key={action.href} asChild>
                <Link href={action.href}>
                {action.icon}
                <span className="ml-2">{action.label}</span>
                </Link>
            </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
        </DropdownMenu>
    );
  }

  return (
    <>
      {visibleActions.map((action) => (
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
