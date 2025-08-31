

'use client';

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Replace } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewItemDialog } from "./new-item-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CacambaIcon } from "./icons/cacamba-icon";

export function FloatingActionButton() {
    const { user, userAccount } = useAuth();
    const pathname = usePathname();
    const isAdmin = userAccount?.role === 'admin' || userAccount?.role === 'owner';

    if (!user) {
        return null;
    }

    const pagesToHideFab = [
        '/rentals/new', 
        '/clients/new',
        '/finance', 
        '/settings', 
        '/admin/clients', 
        '/notifications-studio',
        '/trucks',
    ];

    if (pagesToHideFab.some(path => pathname.startsWith(path)) || pathname.includes('/edit')) {
        return null;
    }

    const getFabContent = () => {
        const permissions = userAccount?.permissions;

        switch (pathname) {
            case '/dumpsters':
                if (isAdmin || permissions?.canEditDumpsters) {
                    return <NewItemDialog itemType="dumpster" />;
                }
                return null;
            case '/clients':
                 if (isAdmin || permissions?.canEditClients) {
                    return <NewItemDialog itemType="client" />;
                }
                return null;
            case '/team':
                if (isAdmin || permissions?.canAccessTeam) {
                    return <NewItemDialog itemType="team" />;
                }
                return null;
            case '/':
            default:
                return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="h-16 w-16 rounded-full shadow-lg">
                            <Plus className="h-8 w-8" />
                            <span className="sr-only">Gerar OS</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="mb-2">
                        <DropdownMenuItem asChild>
                          <Link href="/rentals/new">
                            <CacambaIcon className="mr-2 h-4 w-4" />
                            <span>Aluguel de Caçamba</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                           <Link href="/rentals/new-operation">
                                <Replace className="mr-2 h-4 w-4" />
                                <span>Nova Operação</span>
                           </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                );
        }
    }

    const content = getFabContent();
    if (!content) return null;

    return (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
            {content}
        </div>
    )
}
