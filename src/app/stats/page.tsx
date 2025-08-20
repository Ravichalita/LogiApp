
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { StatsDisplay } from './stats-display';
import type { CompletedRental } from '@/lib/types';
import { getCompletedRentals } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';

function StatsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader><Skeleton className="h-5 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-8 w-20" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-5 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardHeader></Card>
                <Card><CardHeader><Skeleton className="h-5 w-32 mb-2" /><Skeleton className="h-8 w-20" /></CardHeader></Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-6 w-48" /></CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[350px] w-full" />
                </CardContent>
            </Card>
        </div>
    )
}


export default function StatsPage() {
    const { user } = useAuth();
    const [completedRentals, setCompletedRentals] = useState<CompletedRental[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setLoading(true);
            const unsubscribe = getCompletedRentals(user.uid, (data) => {
                setCompletedRentals(data);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setCompletedRentals([]);
            setLoading(false);
        }
    }, [user]);

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <h1 className="text-3xl font-headline font-bold mb-6">Estatísticas</h1>
            {loading ? (
                <StatsSkeleton />
            ) : completedRentals.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-lg border">
                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold font-headline">Nenhum dado para exibir</h2>
                    <p className="mt-2 text-muted-foreground">Finalize aluguéis para começar a ver as estatísticas.</p>
                </div>
            ) : (
                <StatsDisplay rentals={completedRentals} />
            )}
        </div>
    );
}
