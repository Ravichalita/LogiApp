
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { UserAccount } from '@/lib/types';
import { getTeamMembers } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TeamActions } from './team-actions';
import { ShieldAlert } from 'lucide-react';

function TeamTableSkeleton() {
    return (
         <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="w-[64px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(2)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
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
                    {loading ? <TeamTableSkeleton /> : (
                         <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>E-mail</TableHead>
                                        <TableHead>Função</TableHead>
                                        <TableHead><span className="sr-only">Ações</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {team.length > 0 ? team.map(member => (
                                        <TableRow key={member.id}>
                                            <TableCell className="font-medium">{member.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{member.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                                                    {member.role === 'admin' ? 'Admin' : 'Viewer'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                               <TeamActions member={member} />
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                Nenhum membro na equipe ainda.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                         </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
