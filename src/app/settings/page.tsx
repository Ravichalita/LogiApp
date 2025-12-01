
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { Account } from '@/lib/types';
import { getAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RentalPricesForm } from '@/app/finance/rental-prices-form';
import { ResetAllDataButton, ResetActiveRentalsButton, ResetActiveOperationsButton, ResetCompletedRentalsButton, ResetCompletedOperationsButton } from '@/app/settings/reset-button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, TriangleAlert, Cog, Tag, HardDrive, Pin, Workflow, DollarSign, Calendar } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BackupRestore } from './backup-restore';
import { BackupSettingsForm } from './backup-settings-form';
import { Separator } from '@/components/ui/separator';
import { BaseAddressForm } from './base-address-form';
import { OperationTypesForm } from './operation-types-form';
import { CostSettingsForm } from './cost-settings-form';
import { RecurrencePanel } from './recurrence-panel';


import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Suspense } from 'react';

function GoogleAuthFeedbackContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const error = searchParams.get('error');
    const success = searchParams.get('success');

    useEffect(() => {
        if (error) {
            let title = 'Erro na Autenticação com Google';
            let description = 'Ocorreu um erro desconhecido. Tente novamente.';

            switch (error) {
                case 'access_denied':
                    title = 'Acesso Negado';
                    description = 'Você negou o acesso à sua conta do Google. Se desejar, pode tentar novamente.';
                    break;
                case 'invalid_grant':
                    title = 'Erro de Configuração';
                    description = 'A autenticação falhou. Isso pode ser devido a uma configuração incorreta no Google Cloud Console (ex: URI de redirecionamento inválido) ou um problema com os tokens de acesso. Verifique as configurações e tente reconectar.';
                    break;
                 case 'google_auth_failed':
                    description = 'A autenticação com o Google falhou. Por favor, tente novamente.';
                    break;
                default:
                    description = `Ocorreu um erro: ${error}. Por favor, tente novamente.`;
                    break;
            }

            toast({
                title: title,
                description: description,
                variant: 'destructive',
                duration: 10000,
            });
        }

        if (success === 'google_auth_complete') {
            toast({
                title: 'Conexão Bem-sucedida!',
                description: 'Sua conta foi conectada ao Google Agenda com sucesso.',
                variant: 'success',
            });
        }
    }, [error, success, toast]);

    return null; // This component does not render anything itself
}

function GoogleAuthFeedback() {
    return (
        <Suspense fallback={null}>
            <GoogleAuthFeedbackContent />
        </Suspense>
    );
}


export default function SettingsPage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [account, setAccount] = useState<Account | null>(null);
    const [loadingData, setLoadingData] = useState(true);

    const canAccessSettings = isSuperAdmin || userAccount?.permissions?.canAccessSettings;

    useEffect(() => {
        if (authLoading || !accountId || !canAccessSettings) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        const unsub = getAccount(accountId, (accountData) => {
            setAccount(accountData);
            if (loadingData) setLoadingData(false);
        });

        return () => unsub();

    }, [accountId, authLoading, canAccessSettings, loadingData]);

    const isLoading = authLoading || loadingData;

    if (!isLoading && !canAccessSettings) {
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
    
    const permissions = userAccount?.permissions;

    return (
        <div className="bg-background min-h-full">
            <GoogleAuthFeedback />
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-headline font-bold">Configurações</h1>
                    <p className="text-muted-foreground mt-1">Gerencie as configurações da sua conta.</p>
                </div>

                <Accordion type="multiple" className="space-y-4">
                     {(isSuperAdmin || permissions?.canAccessOperations) && (
                        <AccordionItem value="base-address" className="border rounded-lg bg-card">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <Pin className="h-6 w-6" />
                                    <div className="text-left">
                                        <h3 className="font-headline text-lg font-semibold">Endereços da Base</h3>
                                        <p className="text-sm text-muted-foreground font-normal">Defina os endereços de onde saem os caminhões.</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Separator />
                                <div className="p-4">
                                    {isLoading || !account ? <Skeleton className="h-24 w-full" /> : <BaseAddressForm account={account} />}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                     )}
                    
                     {(isSuperAdmin || permissions?.canAccessOperations) && (
                        <>
                        <AccordionItem value="operation-types" className="border rounded-lg bg-card">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <Workflow className="h-6 w-6" />
                                    <div className="text-left">
                                        <h3 className="font-headline text-lg font-semibold">Tipos de Operação</h3>
                                        <p className="text-sm text-muted-foreground font-normal">Personalize os tipos de operações disponíveis.</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Separator />
                                <div className="p-4">
                                    {isLoading || !account ? <Skeleton className="h-40 w-full" /> : <OperationTypesForm account={account} />}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="costs" className="border rounded-lg bg-card">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <DollarSign className="h-6 w-6" />
                                    <div className="text-left">
                                        <h3 className="font-headline text-lg font-semibold">Custo Operacional por Km</h3>
                                        <p className="text-sm text-muted-foreground font-normal">Defina os custos por Km para cada base e tipo de caminhão.</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Separator />
                                <div className="p-4">
                                    {isLoading || !account ? <Skeleton className="h-40 w-full" /> : <CostSettingsForm account={account} />}
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="recurrence" className="border rounded-lg bg-card">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-6 w-6" />
                                    <div className="text-left">
                                        <h3 className="font-headline text-lg font-semibold">OS Recorrentes</h3>
                                        <p className="text-sm text-muted-foreground font-normal">Gerencie suas Ordens de Serviço recorrentes.</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Separator />
                                <div className="p-4">
                                     <RecurrencePanel />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        </>
                     )}

                    {(isSuperAdmin || permissions?.canAccessRentals) && (
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
                    )}
                    
                    {(isSuperAdmin || permissions?.canAccessSettings) && (
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
                    )}

                    {(isSuperAdmin || permissions?.canAccessSettings) && (
                        <AccordionItem value="danger-zone" className="border border-destructive/50 rounded-lg bg-card">
                            <AccordionTrigger className="p-4 text-destructive hover:no-underline [&[data-state=open]>svg]:rotate-180">
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
                                    {accountId && <ResetActiveRentalsButton accountId={accountId} />}
                                    {accountId && <ResetActiveOperationsButton accountId={accountId} />}
                                    {accountId && <ResetCompletedRentalsButton accountId={accountId} />}
                                    {accountId && <ResetCompletedOperationsButton accountId={accountId} />}
                                    {accountId && <ResetAllDataButton accountId={accountId} />}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )}
                </Accordion>
            </div>
        </div>
    );
}
