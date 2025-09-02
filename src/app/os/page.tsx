
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals, getPopulatedOperations } from '@/lib/data';
import type { PopulatedRental, PopulatedOperation, UserAccount } from '@/lib/types';
import { isBefore, isAfter, isToday, parseISO, startOfToday, format, addDays } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalCardActions } from '@/app/rentals/rental-card-actions';
import { OperationCardActions } from '@/app/operations/operation-card-actions';
import { Truck, Calendar, User, ShieldAlert, Search, Plus, Minus, ChevronDown, Hash, Home, Container, Workflow, Building } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditAssignedUserDialog } from '@/app/rentals/edit-assigned-user-dialog';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type RentalStatus = 'Pendente' | 'Ativo' | 'Em Atraso' | 'Agendado' | 'Encerra hoje';
type RentalStatusFilter = RentalStatus | 'Todas';

// --- Helper Functions ---
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

// --- Skeleton Component ---
function OSCardSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                 <Card key={i} className="h-full flex flex-col">
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
                             <Skeleton className="h-5 w-full" />
                             <Skeleton className="h-5 w-3/4" />
                        </div>
                        <div className="flex flex-col md:flex-row w-full gap-2 mt-4">
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

// --- Main Page Component ---
export default function OSPage() {
  const { user, accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [rentals, setRentals] = useState<PopulatedRental[]>([]);
  const [operations, setOperations] = useState<PopulatedOperation[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const permissions = userAccount?.permissions;
  const canAccessRentals = isSuperAdmin || permissions?.canAccessRentals;
  const canAccessOperations = isSuperAdmin || permissions?.canAccessOperations;
  const canEditRentals = isSuperAdmin || permissions?.canEditRentals;
  
  useEffect(() => {
    if (authLoading) return;
    if (!accountId || (!canAccessRentals && !canAccessOperations)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const userIdToFilter = canEditRentals ? undefined : user?.uid;

    const unsubscribers: (() => void)[] = [];

    if (canAccessRentals) {
      if (canEditRentals) {
         // getTeamMembers(accountId, setTeamMembers); // Assuming you might need this
      }
      const unsub = getPopulatedRentals(
        accountId,
        (data) => setRentals(data),
        (err) => { console.error("Rental subscription error:", err); setError(err); },
        userIdToFilter
      );
      unsubscribers.push(unsub);
    }
    
    if (canAccessOperations) {
        const unsub = getPopulatedOperations(
            accountId,
            (data) => setOperations(data),
            (err) => { console.error("Operation subscription error:", err); setError(err); },
            userIdToFilter
        )
        unsubscribers.push(unsub);
    }

    setLoading(false);
    
    return () => unsubscribers.forEach(unsub => unsub());

  }, [authLoading, accountId, user, userAccount, canAccessRentals, canAccessOperations, canEditRentals]);


  const combinedItems = useMemo(() => {
    const rentalItems = canAccessRentals ? rentals.map(r => ({ ...r, itemType: 'rental' as const, sortDate: r.rentalDate })) : [];
    const operationItems = canAccessOperations ? operations.map(o => ({ ...o, itemType: 'operation' as const, sortDate: o.startDate! })) : [];
    
    const allItems = [...rentalItems, ...operationItems];

    let filtered = allItems;
    
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(item => {
            const clientName = item.client?.name?.toLowerCase() || '';
            const assignedName = (item.itemType === 'rental' ? item.assignedToUser?.name?.toLowerCase() : item.driver?.name?.toLowerCase()) || '';
            const id = `OS${item.sequentialId}`.toLowerCase();
            return clientName.includes(lowercasedTerm) || assignedName.includes(lowercasedTerm) || id.includes(lowercasedTerm);
        });
    }

    return filtered.sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());

  }, [rentals, operations, searchTerm, canAccessRentals, canAccessOperations]);

  if (authLoading || (loading && (canAccessRentals || canAccessOperations))) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <h1 className="text-3xl font-headline font-bold mb-8">Ordens de Serviço</h1>
            <OSCardSkeleton />
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

  if (!canAccessRentals && !canAccessOperations && !loading) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Acesso Negado</AlertTitle>
                <AlertDescription>
                    Você não tem permissão para visualizar Ordens de Serviço.
                </AlertDescription>
            </Alert>
        </div>
    )
  }

  if (combinedItems.length === 0 && !loading && !searchTerm) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
             <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Truck className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-headline mb-2">Nenhuma OS encontrada</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
                Você ainda não tem nenhuma OS agendada ou em andamento. Comece cadastrando uma nova.
            </p>
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
                placeholder="Buscar por cliente, responsável ou nº da OS..."
                className="pl-9 bg-card"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="space-y-4">
        {combinedItems.length > 0 ? combinedItems.map((item) => {
            if (item.itemType === 'rental') {
                const rental = item as PopulatedRental;
                const status = getRentalStatus(rental);
                return (
                    <Accordion type="single" collapsible className="w-full" key={`rental-${rental.id}`}>
                         <AccordionItem value={rental.id} className="border-none">
                            <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                                 <span className="absolute top-2 left-3 text-xs font-mono font-bold text-muted-foreground/80">
                                    AL{rental.sequentialId}
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
                                            {canEditRentals ? (
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
                )
            } else {
                const op = item as PopulatedOperation;
                return (
                     <Accordion type="single" collapsible className="w-full" key={`op-${op.id}`}>
                         <AccordionItem value={op.id} className="border-none">
                            <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                                <span className="absolute top-2 left-3 text-xs font-mono font-bold text-muted-foreground/80">
                                    OP{op.sequentialId}
                                </span>
                                <CardHeader className="pb-4">
                                     <div className="pt-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <CardTitle className="text-lg">{op.operationTypeName || op.type}</CardTitle>
                                             {/* Add status badge here if operations get statuses */}
                                        </div>
                                         <CardDescription className="text-sm mt-4">
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-y-2 gap-x-4">
                                                <div className="space-y-1.5">
                                                     <div className="flex items-center gap-1.5">
                                                        <Building className="h-4 w-4"/> {op.client?.name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="h-4 w-4"/> {op.driver?.name}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                 <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                </AccordionTrigger>
                                <AccordionContent className="p-4">
                                    <OperationCardActions operation={op} />
                                </AccordionContent>
                            </Card>
                        </AccordionItem>
                    </Accordion>
                )
            }
        }) : (
            <div className="text-center py-16 bg-card rounded-lg border">
                <p className="text-muted-foreground">Nenhuma OS encontrada para a busca aplicada.</p>
            </div>
        )}
      </div>
    </div>
  );
}
