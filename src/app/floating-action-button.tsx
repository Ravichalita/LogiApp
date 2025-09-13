
'use client';

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Workflow, Container, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewItemDialog } from "@/components/new-item-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils";

export function FloatingActionButton({ className }: { className?: string }) {
    const { user, userAccount, isSuperAdmin } = useAuth();
    const pathname = usePathname();
    const isAdmin = userAccount?.role === 'admin' || userAccount?.role === 'owner';

    if (!user) {
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
    
    // Specific pages that have their own FAB logic
    const fabPages: string[] = ['/fleet'];

    if (pathname.startsWith('/edit') || (pagesToHideFab.some(path => pathname.startsWith(path)) && !fabPages.includes(pathname))) {
        return null;
    }

    const getFabContent = () => {
        const permissions = userAccount?.permissions;
        const canAccessOps = isSuperAdmin || permissions?.canAccessOperations;
        const canAccessRentals = isSuperAdmin || permissions?.canAccessRentals;
        const canAddClients = isSuperAdmin || permissions?.canAddClients;

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
            case '/team':
                if (isAdmin || permissions?.canAccessTeam) {
                    return <NewItemDialog itemType="team" />;
                }
                return null;
            case '/os':
            case '/clients':
            default:
                 // Only show on /os and /clients, hide on others by default
                if (pathname !== '/os' && pathname !== '/clients') {
                    return null;
                }
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
                              <DropdownMenuItem asChild className="py-3">
                                 <Link 
                                    href="/clients/new"
                                    aria-disabled={!canAddClients} 
                                    className={cn("relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", !canAddClients && "pointer-events-none opacity-50")}
                                >
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Novo Cliente</span>
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
        <div className={cn("fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6", className)}>
            {content}
        </div>
    )
}
