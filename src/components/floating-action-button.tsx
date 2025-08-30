
'use client';

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewItemDialog } from "./new-item-dialog";

export function FloatingActionButton() {
    const { user, userAccount } = useAuth();
    const pathname = usePathname();
    const isAdmin = userAccount?.role === 'admin';

    if (!user) {
        return null;
    }

    // Don't show FAB on these pages
    if (pathname.startsWith('/rentals/new') || pathname.startsWith('/clients/new') || pathname.startsWith('/finance') || pathname.startsWith('/settings') || pathname.startsWith('/admin/clients') || pathname.startsWith('/notifications-studio')) {
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
            case '/':
            default:
                return (
                    <Button asChild className="h-16 w-16 rounded-full shadow-lg">
                        <Link href="/rentals/new">
                            <Plus className="h-8 w-8" />
                            <span className="sr-only">Gerar OS</span>
                        </Link>
                    </Button>
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
