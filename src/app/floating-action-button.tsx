
'use client';

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Workflow, Container } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewItemDialog } from "./new-item-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils";

export function FloatingActionButton() {
    const { user, userAccount, isSuperAdmin } = useAuth();
    const pathname = usePathname();
    const isAdmin = userAccount?.role === 'admin' || userAccount?.role === 'owner';

    if (!user || pathname === '/admin/superadmins') {
        return null;
    }

    const pagesToHideFab = [
        '/rentals/new', 
        '/clients/new',
        '/operations/new',
        '/finance', 
        '/settings', 
        '/admin/clients', 
        '/notifications-studio',
    ];
    
    // Check for pages where the FAB should be hidden entirely FIRST.
    if (pagesToHideFab.includes(pathname) || pathname.startsWith('/edit')) {
        return null;
    }

    const getFabContent = () => {
        const permissions = userAccount?.permissions;
        const canAccessOps = isSuperAdmin || permissions?.canAccessOperations;
        const canAccessRentals = isSuperAdmin || permissions?.canAccessRentals;

        switch (pathname) {
            case '/fleet':
                if (isAdmin || isSuperAdmin || permissions?.canEditFleet) {
                    return <NewItemDialog itemType="fleet" />;
                }
                return null;
            case '/dumpsters':
                if (isAdmin || permissions?.canEditDumpsters) {
                    return <NewItemDialog itemType="dumpster" />;
                }
                return null;
            case '/clients':
                 if (isAdmin || permissions?.canAddClients) {
                    return (
                        <Button asChild className="h-16 w-16 rounded-full shadow-lg">
                            <Link href="/clients/new">
                                <Plus className="h-8 w-8" />
                                <span className="sr-only">Novo Cliente</span>
                            </Link>
                        </Button>
                    );
                }
                return null;
            case '/team':
                if (isAdmin || permissions?.canAccessTeam) {
                    return <NewItemDialog itemType="team" />;
                }
                return null;
            case '/os':
            default:
                // Do not show the FAB on any page that is not explicitly handled above
                if (pathname !== '/os') return null;

                return (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="h-16 w-16 rounded-full shadow-lg">
                                <Plus className="h-8 w-8" />
                                <span className="sr-only">Nova OS</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="mb-2">
                             <DropdownMenuItem asChild className="py-3">
                                 <Link 
                                    href="/rentals/new"
                                    aria-disabled={!canAccessRentals} 
                                    className={cn("relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", !canAccessRentals && "pointer-events-none opacity-50")}
                                >
                                    <Container className="mr-2 h-4 w-4" />
                                    <span>Novo Aluguel</span>
                                 </Link>
                             </DropdownMenuItem>
                             <DropdownMenuItem asChild className="py-3">
                                 <Link 
                                    href="/operations/new"
                                    aria-disabled={!canAccessOps} 
                                    className={cn("relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", !canAccessOps && "pointer-events-none opacity-50")}
                                >
                                    <Workflow className="mr-2 h-4 w-4" />
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
        <div className="fab-container fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
            {content}
        </div>
    )
}
