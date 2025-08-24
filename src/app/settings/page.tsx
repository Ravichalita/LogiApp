
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { Account } from '@/lib/types';
import { getAccount } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RentalPricesForm } from '@/app/finance/rental-prices-form';
import { ResetButton } from '@/app/finance/reset-button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function SettingsPage() {
    const { accountId, userAccount, loading: authLoading } = useAuth();
    const [account, setAccount] = useState<Account | null>(null);
    const [loadingData, setLoadingData] = useState(true);

    const isAdmin = userAccount?.role === 'admin';

    useEffect(() => {
        if (authLoading || !accountId) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const accountData = await getAccount(accountId!);
            setAccount(accountData);
            setLoadingData(false);
        }
        
        fetchData();

    }, [accountId, authLoading]);

    const isLoading = authLoading || loadingData;

    if (!isLoading && !isAdmin) {
         return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                 <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>
                       Você não tem permissão para visualizar esta página. Apenas administradores podem acessar as configurações.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="mb-8">
                 <h1 className="text-3xl font-headline font-bold">Configurações</h1>
                 <p className="text-muted-foreground mt-1">Gerencie as configurações da sua conta.</p>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">Tabela de Preços da Diária</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading || !account ? <Skeleton className="h-40 w-full" /> : <RentalPricesForm account={account} />}
                    </CardContent>
                </Card>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="danger-zone" className="border border-destructive rounded-lg">
                        <AccordionTrigger className="p-4 text-destructive hover:no-underline [&[data-state=open]>svg]:rotate-180">
                            <div className="flex items-center gap-2">
                                 <TriangleAlert className="h-5 w-5" />
                                <span className="font-headline text-lg">Zona de Perigo</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="px-4 pb-4">
                             <p className="text-sm text-muted-foreground mb-4">
                                A ação abaixo é irreversível. Tenha certeza absoluta antes de prosseguir.
                            </p>
                            {accountId && <ResetButton accountId={accountId} />}
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}
