
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { UserAccount } from '@/lib/types';
import { getTeamMembers } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TeamActions } from './team-actions';
import { ShieldAlert, ChevronDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { UserPermissionsForm } from './user-permissions-form';

function TeamListSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="border rounded-lg shadow-sm p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className='space-y-1'>
                             <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-8 w-8" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                </div>
            ))}
        </div>
    );
}

export default function TeamPage() {
    const { accountId, userAccount, loading: authLoading } = useAuth();
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const isAdmin = userAccount?.role === 'admin';
    const canAccess = isAdmin || userAccount?.permissions?.canAccessTeam;

    useEffect(() => {
        if (authLoading || !accountId || !canAccess) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        setLoadingData(true);
        const unsubscribe = getTeamMembers(accountId, (data) => {
            setTeam(data);
            setLoadingData(false);
        });
        return () => unsubscribe();
        
    }, [accountId, canAccess, authLoading]);

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
        <div className="container mx-auto py-8 px-4 md:px-6">
             <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="font-headline">Gerenciamento da Equipe</CardTitle>
                    <CardDescription>
                        Adicione, remova e defina permissões para os membros da sua equipe.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <TeamListSkeleton /> : (
                        team.length > 0 ? (
                            <Accordion type="multiple" className="space-y-4">
                                {team.map(member => (
                                    <AccordionItem value={member.id} key={member.id} className="border rounded-lg shadow-sm bg-card">
                                        <div className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium">{member.name}</div>
                                                    <div className="text-sm text-muted-foreground">{member.email}</div>
                                                </div>
                                                <TeamActions member={member} />
                                            </div>
                                             <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="mt-2">
                                                {member.role === 'admin' ? 'Admin' : 'Viewer'}
                                             </Badge>
                                            <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 pt-3 justify-start [&>svg]:ml-1">
                                                Gerenciar Permissões
                                            </AccordionTrigger>
                                        </div>
                                        <AccordionContent>
                                            <UserPermissionsForm member={member} />
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Nenhum membro na equipe ainda.</p>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
