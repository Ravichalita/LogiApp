'use client';

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export function NewRentalFAB() {
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return (
        <Button
            asChild
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-16 w-16 rounded-full shadow-lg z-50"
        >
            <Link href="/rentals/new">
                <Plus className="h-8 w-8" />
                <span className="sr-only">Novo Aluguel</span>
            </Link>
        </Button>
    )
}
