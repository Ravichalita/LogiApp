
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { Account } from '@/lib/types';
import { getAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RentalPricesForm } from '@/app/finance/rental-prices-form';
import { ResetAllDataButton, ResetFinancialDataButton } from '@/app/finance/reset-button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, TriangleAlert, Cog, Tag, HardDrive } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BackupRestore } from './backup-restore';
import { BackupSettingsForm } from './backup-settings-form';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
    const { accountId, userAccount, loading: authLoading } = useAuth();
    const [account, setAccount] = useState<Account | null>(null);
    const [loadingData, setLoadingData] = useState(true);

    const isAdmin = userAccount?.role === 'admin';
    const canAccess = isAdmin || userAccount?.permissions?.canAccessSettings;

    useEffect(() => {
        if (authLoading || !accountId || !canAccess) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        const unsub = getAccount(accountId, (accountData) => {
            setAccount(accountData);
            if (loadingData) setLoadingData(false);
        });

        return () => unsub();

    }, [accountId, authLoading, canAccess, loadingData]);

    const isLoading = authLoading || loadingData;

    if (!isLoading && !canAccess) {
         return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                 <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>
                       Você não tem permissão para visualizar esta página.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="bg-background min-h-full">
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-headline font-bold">Configurações</h1>
                    <p className="text-muted-foreground mt-1">Gerencie as configurações da sua conta.</p>
                </div>

                <Accordion type="multiple" className="space-y-4">
                    <AccordionItem value="prices" className="border rounded-lg bg-card">
                        <AccordionTrigger className="p-4 hover:no-underline">
                            <div className="flex items-center gap-3">
                                <Tag className="h-6 w-6" />
                                <div className="text-left">
                                    <h3 className="font-headline text-lg font-semibold">Tabela de Preços da Diária</h3>
                                    <p className="text-sm text-muted-foreground font-normal">Edite os valores pré-definidos para os aluguéis.</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <Separator />
                            <div className="p-4">
                                {isLoading || !account ? <Skeleton className="h-40 w-full" /> : <RentalPricesForm account={account} />}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="backup" className="border rounded-lg bg-card">
                        <AccordionTrigger className="p-4 hover:no-underline">
                            <div className="flex items-center gap-3">
                                <HardDrive className="h-6 w-6" />
                                <div className="text-left">
                                    <h3 className="font-headline text-lg font-semibold">Backup e Restauração</h3>
                                    <p className="text-sm text-muted-foreground font-normal">Crie, restaure e configure cópias de segurança.</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <Separator />
                            <div className="p-4 space-y-6">
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="settings" className="border-b-0">
                                        <AccordionTrigger className="hover:no-underline font-medium text-base">
                                            <div className="flex items-center gap-2">
                                                <Cog className="h-5 w-5" />
                                                Configurar Backup Automático
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="pt-2">
                                                {isLoading || !account ? <Skeleton className="h-24 w-full" /> : <BackupSettingsForm account={account} />}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                                
                                {isLoading || !accountId ? <Skeleton className="h-40 w-full" /> : <BackupRestore accountId={accountId} />}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="danger-zone" className="border border-destructive/50 rounded-lg bg-card">
                        <AccordionTrigger className="p-4 text-[#ff1c00] hover:no-underline [&[data-state=open]>svg]:rotate-180">
                            <div className="flex items-center gap-2">
                                    <TriangleAlert className="h-5 w-5" />
                                    <span className="font-semibold">Reset</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="px-4 pb-4 space-y-4">
                                <p className="text-sm text-muted-foreground">
                                As ações abaixo são irreversíveis, mas os dados podem ser recuperados a partir de um backup existente.
                            </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {accountId && <ResetFinancialDataButton accountId={accountId} />}
                                {accountId && <ResetAllDataButton accountId={accountId} />}
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}
