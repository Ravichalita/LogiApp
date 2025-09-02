

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { AdminClientView, UserAccount } from '@/lib/types';
import { getAllClientAccountsAction } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AdminClientActions } from './client-actions';
import { ShieldAlert, Users, Plus, Minus, User, Mail, Shield, Settings, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NewItemDialog } from '@/components/new-item-dialog';
import { Separator } from '@/components/ui/separator';
import { ClientPermissionsForm } from './client-permissions-form';

const roleLabels: Record<UserAccount['role'], string> = {
    owner: 'Proprietário',
    admin: 'Admin',
    viewer: 'Visualizador'
};


function AdminClientListSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="border rounded-lg shadow-sm p-4 space-y-2 bg-card">
                    <div className="flex items-center justify-between">
                        <div className='space-y-1'>
                             <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-8 w-8" />
                    </div>
                     <div className="flex justify-between items-center mt-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                </div>
            ))}
        </div>
    );
}


export default function AdminClientsPage() {
    const { user, isSuperAdmin, loading: authLoading } = useAuth();
    const [clients, setClients] = useState<AdminClientView[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!isSuperAdmin || !user) {
            setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const clientAccounts = await getAllClientAccountsAction(user.uid);
            setClients(clientAccounts);
            setLoadingData(false);
        }
        
        fetchData();

    }, [isSuperAdmin, authLoading, user]);

    const isLoading = authLoading || loadingData;

    if (!isLoading && !isSuperAdmin) {
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
        <div className="container mx-auto py-8 px-4 md:px-6">
             <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50">
                <NewItemDialog itemType="clientAdmin" />
            </div>
            <div className="mb-8">
                <h1 className="text-3xl font-headline font-bold">Painel de Clientes</h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie o acesso e as contas dos seus clientes.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Contas Cadastradas</CardTitle>
                    <CardDescription>Expanda cada conta para ver os detalhes e gerenciar permissões.</CardDescription>
                </CardHeader>
                 <CardContent>
                    {isLoading ? <AdminClientListSkeleton /> : (
                         <Accordion type="multiple" className="space-y-4">
                            {clients.length > 0 ? clients.map(client => {
                                const owner = client.members.find(m => m.role === 'owner');
                                return (
                                <AccordionItem value={client.accountId} key={client.accountId} className="border rounded-lg shadow-sm bg-card">
                                     <div className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">{client.ownerName}</div>
                                                <div className="text-sm text-muted-foreground">{client.ownerEmail}</div>
                                            </div>
                                            <AdminClientActions client={client} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2 items-center">
                                            <div className="text-left">
                                                Cadastrado em {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                            </div>
                                             <div className="flex justify-end items-center gap-2">
                                                {client.hasSeenWelcome ? (
                                                    <div className="flex items-center gap-1 text-green-600">
                                                        <CheckCircle className="h-3 w-3" />
                                                        <span>1º acesso em {client.firstAccessAt ? format(parseISO(client.firstAccessAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : 'OK'}</span>
                                                    </div>
                                                ) : (
                                                     <div className="flex items-center gap-1 text-amber-600">
                                                        <Clock className="h-3 w-3" />
                                                        <span>Aguardando 1º Acesso</span>
                                                    </div>
                                                )}
                                                <Badge variant={client.ownerStatus === 'ativo' ? 'success' : 'destructive'}>
                                                    {client.ownerStatus === 'ativo' ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                             </div>
                                        </div>
                                         <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 pt-3 justify-start group" hideChevron>
                                             <Plus className="h-4 w-4 mr-1 transition-transform duration-200 group-data-[state=open]:hidden" />
                                             <Minus className="h-4 w-4 mr-1 transition-transform duration-200 hidden group-data-[state=open]:block" />
                                            Ver Detalhes
                                        </AccordionTrigger>
                                    </div>
                                    <AccordionContent>
                                        <Separator />
                                         <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="team" className="border-b-0">
                                                <AccordionTrigger className="px-4 py-3 hover:no-underline font-medium text-base">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-5 w-5" />
                                                        Equipe ({client.members.length})
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                     <div className="px-4 pb-4 bg-muted/50">
                                                        {client.members.length > 0 ? (
                                                            <ul className="space-y-3 pt-4">
                                                                {client.members.map(member => (
                                                                    <li key={member.id} className="flex items-start gap-3 text-sm">
                                                                        <User className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                                                                        <div className="flex-grow">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-medium">{member.name}</span>
                                                                                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                                                                                    {roleLabels[member.role]}
                                                                                </Badge>
                                                                            </div>
                                                                            <p className="text-muted-foreground">{member.email}</p>
                                                                        </div>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground text-center pt-4">Nenhum membro na equipe.</p>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                            {owner && (
                                                <AccordionItem value="permissions" className="border-b-0">
                                                    <AccordionTrigger className="px-4 py-3 hover:no-underline font-medium text-base">
                                                         <div className="flex items-center gap-2">
                                                            <Settings className="h-5 w-5" />
                                                            Permissões da Conta
                                                        </div>
                                                    </AccordionTrigger>
                                                     <AccordionContent>
                                                        <ClientPermissionsForm client={owner} />
                                                     </AccordionContent>
                                                </AccordionItem>
                                            )}
                                        </Accordion>
                                    </AccordionContent>
                                </AccordionItem>
                                )
                            }) : (
                                 <div className="text-center py-16">
                                    <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
                                </div>
                            )}
                        </Accordion>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
