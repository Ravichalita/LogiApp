
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

    if (!user) {
        return null;
    }

    // Don't show FAB on these pages
    if (pathname.startsWith('/rentals/new') || pathname.startsWith('/stats')) {
        return null;
    }


    const getFabContent = () => {
        switch (pathname) {
            case '/clients':
                return <NewItemDialog itemType="client" />;
            case '/dumpsters':
                return <NewItemDialog itemType="dumpster" />;
            case '/team':
                if (userAccount?.role !== 'admin') return null;
                return <NewItemDialog itemType="team" />;
            case '/':
            default:
                 return (
                    <Button asChild className="h-16 w-16 rounded-full shadow-lg">
                         <Link href="/rentals/new">
                            <Plus className="h-8 w-8" />
                            <span className="sr-only">Novo Aluguel</span>
                        </Link>
                    </Button>
                );
        }
    }

    return (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
            {getFabContent()}
        </div>
    )
}
