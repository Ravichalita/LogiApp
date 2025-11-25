
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import type { RecurrenceProfile, PopulatedOperation, PopulatedRental } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { MoreHorizontal, Trash2, Ban, CalendarOff, Pencil } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { getRecurrenceProfilesWithDetails } from '@/lib/data-server-actions';
import { cancelRecurrenceAction, deleteRecurrenceAction } from '@/lib/actions';

type RecurrenceProfileWithDetails = RecurrenceProfile & {
  details: PopulatedOperation | PopulatedRental | null;
};

function RecurrenceActions({ profile, onAction }: { profile: RecurrenceProfileWithDetails, onAction: (action: () => Promise<any>) => void }) {
    const { accountId } = useAuth();

    const handleCancel = () => {
        if (!accountId) return;
        onAction(async () => {
            const result = await cancelRecurrenceAction(accountId, profile.id);
            if (result.message === 'success') {
                toast({ title: 'Sucesso', description: 'A recorrência foi cancelada e não irá gerar novas OS.' });
            } else {
                toast({ title: 'Erro', description: result.error, variant: 'destructive' });
            }
        });
    }

    const handleDelete = () => {
        if (!accountId) return;
        onAction(async () => {
            const result = await deleteRecurrenceAction(accountId, profile.id);
            if (result.message === 'success') {
                toast({ title: 'Sucesso', description: 'A recorrência foi excluída permanentemente.' });
            } else {
                toast({ title: 'Erro', description: result.error, variant: 'destructive' });
            }
        });
    }

    const getEditLink = () => {
        if (!profile.details) return '/os';
        return profile.type === 'operation'
            ? `/operations/${profile.originalOrderId}/edit`
            : `/rentals/${profile.originalOrderId}/edit`;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={getEditLink()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Editar Original</span>
                    </Link>
                </DropdownMenuItem>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Ban className="mr-2 h-4 w-4" />
                            <span>Cancelar Recorrência</span>
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar Recorrência?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação irá impedir que novas OS sejam geradas a partir desta recorrência. As OS já existentes não serão afetadas. A recorrência ficará inativa.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCancel}>Confirmar Cancelamento</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                             <Trash2 className="mr-2 h-4 w-4" />
                            <span>Excluir Recorrência</span>
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Recorrência Permanentemente?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação é irreversível. A recorrência e seu histórico de geração serão excluídos. Nenhuma OS já criada será afetada.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Confirmar Exclusão</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </DropdownMenuContent>
        </DropdownMenu>
    );
}


export function RecurrencePanel() {
    const { accountId } = useAuth();
    const [profiles, setProfiles] = useState<RecurrenceProfileWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMutating, startTransition] = useTransition();

    useEffect(() => {
        if (accountId) {
            const fetchProfiles = async () => {
                setLoading(true);
                const fetchedProfiles = await getRecurrenceProfilesWithDetails(accountId);
                setProfiles(fetchedProfiles);
                setLoading(false);
            };
            fetchProfiles();
        }
    }, [accountId]);

    const activeProfiles = profiles.filter(p => p.status === 'active');

    if (loading) {
        return <Spinner />;
    }

    if (activeProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <CalendarOff className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma Recorrência Ativa</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Você ainda não possui nenhuma Ordem de Serviço recorrente.
                </p>
            </div>
        )
    }

    const getDayLabels = (days: number[]) => {
        const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return days.map(d => labels[d]).join(', ');
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>OS Recorrentes</CardTitle>
                <CardDescription>Gerencie suas Ordens de Serviço que se repetem automaticamente.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    {isMutating && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <Spinner />
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Frequência</TableHead>
                                <TableHead>Próxima Geração</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeProfiles.map((profile) => (
                                <TableRow key={profile.id}>
                                    <TableCell className="font-medium">
                                        {profile.details?.client?.name || profile.templateData?.client?.name || 'Cliente não encontrado'}
                                    </TableCell>
                                    <TableCell className="font-medium">{profile.details?.client?.name || 'Cliente não encontrado'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {profile.type === 'operation' ? 'Operação' : 'Aluguel'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{getDayLabels(profile.daysOfWeek)}</span>
                                            <span className="text-xs text-muted-foreground">às {profile.time}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{profile.nextRunDate && typeof profile.nextRunDate === 'string' ? format(parseISO(profile.nextRunDate), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <RecurrenceActions
                                            profile={profile}
                                            onAction={(action) => {
                                                startTransition(async () => {
                                                    await action();
                                                    if (accountId) {
                                                        const updatedProfiles = await getRecurrenceProfilesWithDetails(accountId);
                                                        setProfiles(updatedProfiles);
                                                    }
                                                });
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
