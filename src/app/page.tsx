

'use client';

import { useEffect, useState, useMemo, useContext, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals, fetchTeamMembers } from '@/lib/data';
import type { PopulatedRental, UserAccount, Rental } from '@/lib/types';
import { isBefore, isAfter, isToday, parseISO, startOfToday, format, addDays } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalCardActions } from './rentals/rental-card-actions';
import { Truck, Calendar, User, ShieldAlert, Search, Plus, Minus, ChevronDown, Hash } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditAssignedUserDialog } from './rentals/edit-assigned-user-dialog';

type RentalStatus = 'Pendente' | 'Ativo' | 'Em Atraso' | 'Agendado' | 'Encerra hoje';
type RentalStatusFilter = RentalStatus | 'Todas';
type OsTypeFilter = 'all' | 'rental' | 'operation';

export function getRentalStatus(rental: PopulatedRental): { text: RentalStatus; variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning', order: number } {
  const today = startOfToday();
  const rentalDate = parseISO(rental.rentalDate);
  const returnDate = parseISO(rental.returnDate);

  if (isAfter(today, returnDate)) {
    return { text: 'Em Atraso', variant: 'destructive', order: 1 };
  }
  if (isToday(returnDate)) {
    return { text: 'Encerra hoje', variant: 'warning', order: 2 };
  }
  if (isToday(rentalDate) || (isAfter(today, rentalDate) && isBefore(today, returnDate))) {
     return { text: 'Ativo', variant: 'success', order: 3 };
  }
  if (isBefore(today, rentalDate)) {
    return { text: 'Pendente', variant: 'secondary', order: 4 };
  }
  return { text: 'Agendado', variant: 'secondary', order: 5 }; // Should not happen in active rentals list often
}

const statusFilterOptions: { label: string, value: RentalStatusFilter }[] = [
    { label: "Todas", value: 'Todas' },
    { label: "Pendente", value: 'Pendente' },
    { label: "Ativo", value: 'Ativo' },
    { label: "Encerra hoje", value: 'Encerra hoje' },
    { label: "Em Atraso", value: 'Em Atraso' },
];

const osTypeFilterOptions: { label: string, value: OsTypeFilter }[] = [
    { label: 'Todas as OS', value: 'all' },
    { label: 'Aluguéis', value: 'rental' },
    { label: 'Operações', value: 'operation' },
];


function RentalCardSkeleton() {
    return (
        <div className="space-y-4">
                 <Card className="h-full flex flex-col">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3 mt-1" />
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full mt-1" />
                                <div className="flex flex-col gap-2 w-full">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full mt-1" />
                                <div className="flex flex-col gap-2 w-full">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-5 w-3/4" />
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full mt-1" />
                                <div className="flex flex-col gap-2 w-full">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-5 w-1/2" />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row w-full gap-2 mt-4">
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
                 <Card className="h-full flex flex-col">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3 mt-1" />
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full mt-1" />
                                <div className="flex flex-col gap-2 w-full">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full mt-1" />
                                <div className="flex flex-col gap-2 w-full">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-5 w-3/4" />
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full mt-1" />
                                <div className="flex flex-col gap-2 w-full">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-5 w-1/2" />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row w-full gap-2 mt-4">
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
        </div>
    )
}

export default function HomePage() {
  const { user, accountId, userAccount, loading: authLoading } = useAuth();
  const [rentals, setRentals] = useState<PopulatedRental[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserAccount[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('Todas');
  const [osTypeFilter, setOsTypeFilter] = useState<OsTypeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const isAdmin = userAccount?.role === 'admin';
  const canEdit = isAdmin || userAccount?.permissions?.canEditRentals;

  useEffect(() => {
    // Wait for the auth context to be ready and have an accountId
    if (authLoading || !accountId) {
      return;
    }

    setLocalLoading(true);
    const canViewAll = userAccount?.role === 'admin' || userAccount?.permissions?.canEditRentals;
    const userIdToFilter = canViewAll ? undefined : user?.uid;

    if (canEdit) {
        fetchTeamMembers(accountId).then(setTeamMembers);
    }

    const unsubscribe = getPopulatedRentals(
      accountId,
      (data) => {
        setRentals(data);
        setError(null);
        setLocalLoading(false);
      },
      (err) => {
        console.error("Rental subscription error:", err);
        setError(err);
        setLocalLoading(false);
      },
      userIdToFilter
    );

    return () => unsubscribe();
  }, [authLoading, accountId, user, userAccount, canEdit]);


  const filteredAndSortedRentals = useMemo(() => {
    let filtered = rentals;

    if (osTypeFilter !== 'all') {
        filtered = filtered.filter(rental => (rental.osType || 'rental') === osTypeFilter);
    }

    if (statusFilter !== 'Todas') {
        filtered = filtered.filter(rental => {
            const status = getRentalStatus(rental);
            return status.text === statusFilter;
        });
    }

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(rental => 
            rental.client?.name.toLowerCase().includes(lowercasedTerm) ||
            rental.dumpster?.name.toLowerCase().includes(lowercasedTerm) ||
            rental.assignedToUser?.name.toLowerCase().includes(lowercasedTerm) ||
            String(rental.sequentialId).includes(lowercasedTerm)
        );
    }

    return filtered.sort((a, b) => {
        const statusA = getRentalStatus(a);
        const statusB = getRentalStatus(b);
        if (statusA.order !== statusB.order) {
            return statusA.order - statusB.order;
        }
        return parseISO(a.rentalDate).getTime() - parseISO(b.rentalDate).getTime();
    });
  }, [rentals, statusFilter, osTypeFilter, searchTerm]);

  if (authLoading || localLoading) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <h1 className="text-3xl font-headline font-bold mb-8">Ordens de Serviço</h1>
            <RentalCardSkeleton />
        </div>
    )
  }
  
  if (error) {
       return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
             <div className="p-4 bg-destructive/10 rounded-full mb-4">
                <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold font-headline mb-2">Erro de Permissão</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
                Não foi possível carregar as ordens de serviço. Verifique suas permissões de acesso e recarregue a página. Se o problema persistir, contate o administrador.
            </p>
             <Button onClick={() => window.location.reload()}>
                Recarregar Página
            </Button>
        </div>
    )
  }

  if (!accountId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
        <h2 className="text-2xl font-bold font-headline mb-2">Sem conta vinculada.</h2>
      </div>
    )
  }

  if (rentals.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
             <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Truck className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-headline mb-2">Nenhuma ordem de serviço encontrada</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
                Você ainda não tem nenhuma OS agendada ou em andamento. Comece cadastrando uma nova.
            </p>
            <Button asChild>
                <Link href="/rentals/new">
                    Gerar OS
                </Link>
            </Button>
        </div>
    )
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-headline font-bold mb-8">Ordens de Serviço</h1>

      <div className="space-y-4 mb-6">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Buscar por cliente, caçamba, usuário ou nº da OS..."
                className="pl-9 bg-card"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className='flex flex-wrap gap-2'>
            {osTypeFilterOptions.map(option => (
                 <Button
                    key={option.value}
                    variant={osTypeFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOsTypeFilter(option.value)}
                    className="text-xs h-7"
                >
                    {option.label}
                </Button>
            ))}
        </div>
        {osTypeFilter !== 'operation' && (
            <div className="flex flex-wrap gap-2">
                {statusFilterOptions.map(option => (
                    <Button
                        key={option.value}
                        variant={statusFilter === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(option.value)}
                        className="text-xs h-7"
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        )}
      </div>

      <div className="space-y-4">
        {filteredAndSortedRentals.length > 0 ? filteredAndSortedRentals.map((rental) => {
            const status = getRentalStatus(rental);
            return (
            <Accordion type="single" collapsible className="w-full" key={rental.id}>
                <AccordionItem value={rental.id} className="border-none">
                <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                    <span className="absolute top-2 left-3 text-xs font-mono font-bold text-muted-foreground/80">
                        {rental.sequentialId}
                    </span>
                    <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <CardTitle className="text-xl font-headline">{rental.dumpster?.name}</CardTitle>
                        <div className="flex flex-col items-end gap-1 ml-2">
                            <Badge variant={status.variant} className="text-center">{status.text}</Badge>
                        </div>
                    </div>
                    <p className="text-muted-foreground mt-2">
                        Cliente: <span className="font-semibold text-foreground">{rental.client?.name}</span>
                    </p>
                    <div className="text-sm text-muted-foreground mt-2 flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5" /> 
                            {canEdit ? (
                                <EditAssignedUserDialog rental={rental} teamMembers={teamMembers}>
                                    <span className="cursor-pointer hover:underline">{rental.assignedToUser?.name}</span>
                                </EditAssignedUserDialog>
                            ) : (
                                <span>{rental.assignedToUser?.name}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-right">
                            <Calendar className="h-5 w-5" />
                            <span>Retirada em {format(parseISO(rental.returnDate), "dd/MM/yy", { locale: ptBR })}</span>
                        </div>
                    </div>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-between pt-0 pb-0">
                        <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                           <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                        </AccordionTrigger>
                        <AccordionContent className="p-4">
                            <RentalCardActions rental={rental} status={status} />
                        </AccordionContent>
                    </CardContent>
                </Card>
                </AccordionItem>
            </Accordion>
            );
        }) : (
            <div className="text-center py-16 bg-card rounded-lg border">
                <p className="text-muted-foreground">Nenhuma OS encontrada para a busca e filtro aplicados.</p>
            </div>
        )}
      </div>
    </div>
  );
}
