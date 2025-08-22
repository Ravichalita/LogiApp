
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
    const { accountId, userAccount } = useAuth();
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const isAdmin = userAccount?.role === 'admin';

    useEffect(() => {
        if (accountId && isAdmin) {
            setLoading(true);
            const unsubscribe = getTeamMembers(accountId, (data) => {
                setTeam(data);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setLoading(false);
        }
    }, [accountId, isAdmin]);

    if (!isAdmin && !loading) {
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
            <div className="mb-6">
                 <h1 className="text-3xl font-headline font-bold">Equipe</h1>
                 <p className="text-muted-foreground mt-1">Gerencie os membros e as permissões da sua conta.</p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Membros da Equipe</CardTitle>
                    <CardDescription>
                        Usuários que têm acesso à esta conta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <TeamListSkeleton /> : (
                        team.length > 0 ? (
                            <Accordion type="multiple" className="space-y-4">
                                {team.map(member => (
                                    <AccordionItem value={member.id} key={member.id} className="border rounded-lg shadow-sm">
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
