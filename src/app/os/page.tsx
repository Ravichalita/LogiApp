
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals, getPopulatedOperations, fetchTeamMembers } from '@/lib/data';
import type { PopulatedRental, PopulatedOperation, UserAccount, OperationType, Attachment } from '@/lib/types';
import { isBefore, isAfter, isToday, parseISO, startOfToday, format, addDays, isFuture, isWithinInterval } from 'date-fns';
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
import { Truck, Calendar, User, ShieldAlert, Search, Plus, Minus, ChevronDown, Hash, Home, Container, Workflow, Building, MapPin, FileText, DollarSign, TrendingDown, TrendingUp, Route, Clock, Sun, Cloudy, CloudRain, Snowflake, Map, Paperclip, Sparkles, MapPinned } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditAssignedUserDialog } from '@/app/rentals/edit-assigned-user-dialog';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import { EditOperationAssignedUserDialog } from '@/app/operations/edit-assigned-user-dialog';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import { addAttachmentToRentalAction, addAttachmentToOperationAction, deleteAttachmentAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';


type RentalStatus = 'Pendente' | 'Ativo' | 'Em Atraso' | 'Agendado' | 'Encerra hoje';
type OsTypeFilter = 'Todas' | 'Aluguel' | 'Operação';
type StatusFilter = 'Todas' | RentalStatus | 'Em Andamento' | 'Pendente' | 'Em Atraso';


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

function getOperationStatus(op: PopulatedOperation): { text: 'Pendente' | 'Em Andamento' | 'Em Atraso'; variant: 'secondary' | 'success' | 'destructive' } {
    if (!op.startDate || !op.endDate) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    const now = new Date();
    const startDate = parseISO(op.startDate);
    const endDate = parseISO(op.endDate);

    if (isAfter(now, endDate)) {
        return { text: 'Em Atraso', variant: 'destructive' };
    }
    if (isFuture(startDate)) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    if (isWithinInterval(now, { start: startDate, end: endDate })) {
        return { text: 'Em Andamento', variant: 'success' };
    }
    
    // Fallback for operations that have passed their end date but are not marked as completed
    return { text: 'Pendente', variant: 'secondary' };
}

function formatCurrency(value: number | undefined | null) {
    if (value === undefined || value === null) {
        return "N/A";
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

const formatDateRange = (start?: string, end?: string) => {
    if (!start || !end) {
        return "Período não definido";
    }
    try {
        const startDate = parseISO(start);
        const endDate = parseISO(end);
        
        const startFormat = isToday(startDate) ? "'Hoje às' HH:mm" : "dd/MM/yy 'às' HH:mm";
        const endFormat = isToday(endDate) ? "'Hoje às' HH:mm" : "dd/MM/yy 'às' HH:mm";
        
        return `${format(startDate, startFormat, { locale: ptBR })} - ${format(endDate, endFormat, { locale: ptBR })}`;
    } catch (error) {
        console.error("Error formatting date range:", error);
        return "Datas inválidas";
    }
}

const formatPhoneNumberForWhatsApp = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`;
    }
    return digits;
}

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 20 20"
        className="cls-1"
        {...props}
    >
      <path d="M10.01,0C4.5,0,.02,4.44,.02,9.92c0,1.77.47,3.5,1.37,5.01l-1.39,5.07,5.2-1.39h0c1.47.8,3.12,1.23,4.81,1.23,5.52,0,9.99-4.44,9.99-9.92S15.53,0,10.01,0ZM10.01,18.21c-1.69,0-3.26-.5-4.57-1.35l-3.11.83.83-3.03h0c-.95-1.35-1.5-2.98-1.5-4.75C1.66,5.34,5.4,1.63,10.01,1.63s8.35,3.71,8.35,8.29-3.74,8.29-8.35,8.29Z"/>
      <path d="M5.39,9.36c-.71-1.36-.65-2.83.51-3.83.46-.44,1.36-.4,1.62.16l.8,1.92c.1.21.09.42-.06.63-.19.22-.37.44-.56.66-.15.17-.22.31-.08.48.76,1.28,1.86,2.32,3.42,2.98.23.09.39.07.55-.12.24-.29.48-.59.72-.88.2-.26.39-.29.68-.17.66.31,1.98.94,1.98.94.49.37-.19,1.8-.79,2.16-.87.51-1.46.43-2.37.25-2.97-.59-5.28-3.13-6.43-5.18h0Z"/>
    </svg>
);

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

const typeFilterOptions: { label: string; value: OsTypeFilter }[] = [
    { label: "Todas", value: 'Todas' },
    { label: "Aluguéis", value: 'Aluguel' },
    { label: "Operações", value: 'Operação' },
];

const statusFilterOptions: { label: string; value: StatusFilter }[] = [
    { label: "Todos Status", value: 'Todas' },
    { label: "Pendentes", value: 'Pendente' },
    { label: "Em Andamento", value: 'Em Andamento' },
    { label: "Encerram Hoje", value: 'Encerra hoje' },
    { label: "Em Atraso", value: 'Em Atraso' },
];


// --- Main Page Component ---
export default function OSPage() {
  const { user, accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [rentals, setRentals] = useState<PopulatedRental[]>([]);
  const [operations, setOperations] = useState<PopulatedOperation[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [osTypeFilter, setOsTypeFilter] = useState<OsTypeFilter>('Todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todas');
  const router = useRouter();
  const { toast } = useToast();

  const permissions = userAccount?.permissions;
  const canAccessRentals = isSuperAdmin || permissions?.canAccessRentals;
  const canAccessOperations = isSuperAdmin || permissions?.canAccessOperations;
  const canAccessRoutes = isSuperAdmin || permissions?.canAccessRoutes;
  const canEditRentals = isSuperAdmin || permissions?.canEditRentals;
  const canEditOperations = isSuperAdmin || permissions?.canEditOperations;
  const canSeeFinance = isSuperAdmin || userAccount?.role === 'owner' || permissions?.canAccessFinance;
  const canUseAttachments = isSuperAdmin || permissions?.canUseAttachments;
  
  useEffect(() => {
    if (authLoading) return;
    if (!accountId || (!canAccessRentals && !canAccessOperations)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const isAdminView = isSuperAdmin || userAccount?.role === 'owner' || userAccount?.role === 'admin';
    const userIdToFilter = isAdminView ? undefined : user?.uid;

    const unsubscribers: (() => void)[] = [];

    if (canAccessRentals) {
      if (canEditRentals && teamMembers.length === 0) {
         fetchTeamMembers(accountId).then(setTeamMembers);
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
        if(teamMembers.length === 0) {
            fetchTeamMembers(accountId).then(setTeamMembers);
        }
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

  }, [authLoading, accountId, user, userAccount, canAccessRentals, canAccessOperations, canEditRentals, canEditOperations, isSuperAdmin, teamMembers.length]);


  const combinedItems = useMemo(() => {
    const rentalItems = canAccessRentals ? rentals.map(r => ({ ...r, itemType: 'rental' as const, sortDate: r.rentalDate })) : [];
    const operationItems = canAccessOperations ? operations.map(o => ({ ...o, itemType: 'operation' as const, sortDate: o.startDate! })) : [];
    
    let allItems = [...rentalItems, ...operationItems];

    if (osTypeFilter === 'Aluguel') {
      allItems = allItems.filter(item => item.itemType === 'rental');
    } else if (osTypeFilter === 'Operação') {
      allItems = allItems.filter(item => item.itemType === 'operation');
    }
    
    if (statusFilter !== 'Todas') {
        allItems = allItems.filter(item => {
            if (item.itemType === 'rental') {
                const status = getRentalStatus(item).text;
                if (statusFilter === 'Em Andamento') return status === 'Ativo';
                return status === statusFilter;
            }
            if (item.itemType === 'operation') {
                const status = getOperationStatus(item).text;
                if (statusFilter === 'Em Andamento' || statusFilter === 'Pendente' || statusFilter === 'Em Atraso') {
                    return status === statusFilter;
                }
                return false;
            }
            return false;
        });
    }

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        allItems = allItems.filter(item => {
            const clientName = item.client?.name?.toLowerCase() || '';
            const assignedName = (item.itemType === 'rental' ? item.assignedToUser?.name?.toLowerCase() : item.driver?.name?.toLowerCase()) || '';
            const id = (item.itemType === 'rental' ? `al${item.sequentialId}` : `op${item.sequentialId}`).toLowerCase();
            return clientName.includes(lowercasedTerm) || assignedName.includes(lowercasedTerm) || id.includes(lowercasedTerm);
        });
    }

    return allItems.sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());

  }, [rentals, operations, searchTerm, osTypeFilter, statusFilter, canAccessRentals, canAccessOperations]);
  
  const handleTypeFilterChange = (type: OsTypeFilter) => {
    setOsTypeFilter(type);
    setStatusFilter('Todas'); // Reset status filter when type changes
  };

  const handleAttachmentUploaded = async (item: PopulatedRental | PopulatedOperation, newAttachment: Attachment) => {
    if (!accountId) return;

    let result;
    let collectionName: 'rentals' | 'operations';

    if (item.itemType === 'rental') {
        collectionName = 'rentals';
        result = await addAttachmentToRentalAction(accountId, item.id, newAttachment, collectionName);
    } else {
        collectionName = 'operations';
        result = await addAttachmentToOperationAction(accountId, item.id, newAttachment, collectionName);
    }

    if (result.message === 'success') {
        const updateState = (prevItems: any[]) => prevItems.map(i => 
            i.id === item.id 
            ? { ...i, attachments: [...(i.attachments || []), newAttachment] } 
            : i
        );
        
        if (item.itemType === 'rental') {
            setRentals(updateState);
        } else {
            setOperations(updateState);
        }

        toast({ title: 'Sucesso!', description: 'Anexo adicionado.' });
    } else {
        toast({ title: 'Erro ao adicionar anexo', description: result.error, variant: 'destructive' });
    }
  };
  
  const handleAttachmentDeleted = async (item: PopulatedRental | PopulatedOperation, attachmentToDelete: Attachment) => {
    if (!accountId) return;
    
    const collectionName = item.itemType === 'rental' ? 'rentals' : 'operations';
    const result = await deleteAttachmentAction(accountId, item.id, collectionName, attachmentToDelete);

    if (result.message === 'success') {
        const updateState = (prevItems: any[]) => prevItems.map(i => {
            if (i.id === item.id) {
                return { ...i, attachments: (i.attachments || []).filter((att: Attachment) => att.url !== attachmentToDelete.url) };
            }
            return i;
        });
        
        if (item.itemType === 'rental') {
            setRentals(updateState);
        } else {
            setOperations(updateState);
        }

        toast({ title: 'Sucesso!', description: 'Anexo removido.' });
    } else {
        toast({ title: 'Erro ao remover anexo', description: result.error, variant: 'destructive' });
    }
  };


  const isLoading = authLoading || (loading && (canAccessRentals || canAccessOperations));

  if (isLoading) {
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

  if (combinedItems.length === 0 && !loading && !searchTerm && osTypeFilter === 'Todas' && statusFilter === 'Todas') {
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
       <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-headline font-bold">Ordens de Serviço</h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie suas ordens de aluguel e operações.
                </p>
            </div>
             {canAccessRoutes && (
                <>
                 <Button asChild variant="outline" className="hidden md:inline-flex">
                    <Link href="/route-planning">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Planejar Rota com IA
                    </Link>
                </Button>
                <Button asChild variant="default" className="md:hidden flex-col h-auto p-2">
                    <Link href="/route-planning">
                        <Sparkles className="h-6 w-6" />
                        <span className="text-xs">Rota IA</span>
                    </Link>
                </Button>
                </>
            )}
        </div>


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
        <div className="space-y-2">
             <div className="grid grid-cols-3 gap-2">
                {typeFilterOptions.map(option => (
                    <Button
                        key={option.value}
                        variant={osTypeFilter === option.value ? "selected" : "outline"}
                        onClick={() => handleTypeFilterChange(option.value)}
                        className="py-2"
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
             <div className="flex flex-wrap gap-2">
                {statusFilterOptions.map((option) => (
                    <Button
                        key={option.value}
                        variant={statusFilter === option.value ? 'selected' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(option.value as StatusFilter)}
                        className="py-1 h-7 text-xs"
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
        </div>
      </div>

      <div className="space-y-4">
        {combinedItems.length > 0 ? combinedItems.map((item) => {
            if (item.itemType === 'rental') {
                const rental = item as PopulatedRental;
                const status = getRentalStatus(rental);
                const attachmentCount = rental.attachments?.length || 0;
                return (
                    <Accordion type="single" collapsible className="w-full" key={`rental-${rental.id}`}>
                         <AccordionItem value={rental.id} className="border-none">
                            <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                                 <span className="absolute top-2 left-3 text-xs font-mono font-bold text-primary">
                                    AL{rental.sequentialId}
                                </span>
                                <CardHeader className="pb-4 pt-8">
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-xl font-headline">{rental.dumpster?.name}</CardTitle>
                                        <div className="flex flex-col items-end gap-1 ml-2">
                                            <Badge variant={status.variant} className="text-center">{status.text}</Badge>
                                        </div>
                                    </div>
                                    <CardDescription className="text-sm mt-4">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-y-2 gap-x-4">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Building className="h-4 w-4"/> {rental.client?.name}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-4 w-4"/>
                                                     {canEditRentals && rental.assignedToUser ? (
                                                        <EditAssignedUserDialog rental={rental} teamMembers={teamMembers}>
                                                            {rental.assignedToUser.name}
                                                        </EditAssignedUserDialog>
                                                    ) : (
                                                        <span>{rental.assignedToUser?.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 text-left md:text-right">
                                                 <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-4 w-4"/>
                                                    <span>Retirada em {format(parseISO(rental.returnDate), "dd/MM/yy", { locale: ptBR })}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardDescription>
                                </CardHeader>
                                 <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                 </AccordionTrigger>
                                <AccordionContent className="px-6 py-4">
                                    <RentalCardActions rental={rental} status={status} />
                                </AccordionContent>
                            </Card>
                         </AccordionItem>
                    </Accordion>
                )
            } else {
                const op = item as PopulatedOperation;
                const status = getOperationStatus(op);
                const totalCost = op.totalCost ?? 0;
                const profit = (op.value || 0) - totalCost;
                const attachmentCount = op.attachments?.length || 0;
                return (
                     <Accordion type="single" collapsible className="w-full" key={`op-${op.id}`}>
                         <AccordionItem value={op.id} className="border-none">
                            <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                                <span className="absolute top-2 left-3 text-xs font-mono font-bold text-primary">
                                    OP{op.sequentialId}
                                </span>
                                <CardHeader className="pb-4 pt-8">
                                     <div className="flex items-start justify-between mb-2">
                                        <CardTitle className="text-xl font-headline">
                                            {op.operationTypes.map(t => t.name).join(', ')}
                                        </CardTitle>
                                         <Badge variant={status.variant} className="text-center">{status.text}</Badge>
                                    </div>
                                     <CardDescription className="text-sm mt-4">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-y-2 gap-x-4">
                                            <div className="space-y-1.5">
                                                 <div className="flex items-center gap-1.5">
                                                    <Building className="h-4 w-4"/> {op.client?.name}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-4 w-4"/> 
                                                    {canEditOperations && op.driver ? (
                                                        <EditOperationAssignedUserDialog operation={op} teamMembers={teamMembers}>
                                                            {op.driver.name}
                                                        </EditOperationAssignedUserDialog>
                                                    ) : (
                                                        <span>{op.driver?.name}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 text-left md:text-right">
                                                {op.truck && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Truck className="h-4 w-4" />
                                                        <span>{op.truck.name} ({op.truck.plate})</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="h-4 w-4"/>
                                                    {formatDateRange(op.startDate, op.endDate)}
                                                </div>
                                            </div>
                                        </div>
                                    </CardDescription>
                                </CardHeader>
                                 <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                 </AccordionTrigger>
                                <AccordionContent className="px-6 py-4">
                                    <div className="space-y-4 text-sm px-1">
                                         <div className="mt-3 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold uppercase text-muted-foreground shrink-0">Destino:</span>
                                                    <span className="font-medium">{op.destinationAddress}</span>
                                                </div>
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.destinationAddress)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">
                                                    <MapPinned className="h-6 w-6" />
                                                    <span className="text-xs font-bold">GPS</span>
                                                </a>
                                            </div>
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="start-address" className="border-none">
                                                    <AccordionTrigger className="text-xs text-primary hover:no-underline p-0 justify-start [&>svg]:ml-1 data-[state=closed]:text-muted-foreground">
                                                        <span className="font-normal">Mostrar endereço de partida</span>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-2">
                                                            <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold uppercase text-muted-foreground">Saída:</span>
                                                            <span>{op.startAddress}</span>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </div>
                                        
                                        {op.observations && (
                                             <div className="flex items-start gap-3">
                                                <FileText className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                                <p className="whitespace-pre-wrap">{op.observations}</p>
                                            </div>
                                        )}

                                        {canSeeFinance && (
                                            <>
                                                <div className="flex items-center gap-2 pt-2">
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">Valor do Serviço:</span>
                                                    <span className="font-bold">{formatCurrency(op.value)}</span>
                                                </div>

                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm gap-2 sm:gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <TrendingDown className="h-4 w-4 text-destructive" />
                                                        <span className="font-medium">Custo Total:</span>
                                                        <span className="font-bold text-destructive">{formatCurrency(totalCost)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {profit >= 0 ? 
                                                            <TrendingUp className="h-4 w-4 text-green-600" /> : 
                                                            <TrendingDown className="h-4 w-4 text-red-600" />
                                                        }
                                                        <span className="font-medium">Lucro:</span>
                                                        <span className={cn(
                                                            "font-bold",
                                                            profit >= 0 ? "text-green-600" : "text-red-600"
                                                        )}>
                                                            {formatCurrency(profit)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        
                                        <Separator />

                                        <Accordion type="single" collapsible className="w-full">
                                            <AccordionItem value="attachments" className="border-none">
                                                <div className="pt-2 flex justify-between items-center w-full">
                                                    {op.client?.phone && (
                                                        <a 
                                                            href={`https://wa.me/${formatPhoneNumberForWhatsApp(op.client.phone)}?text=Olá, ${op.client.name}! Somos da equipe LogiApp, sobre a OS OP${op.sequentialId}.`}
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 hover:underline"
                                                        >
                                                            <WhatsAppIcon className="h-6 w-6 fill-green-600" />
                                                            <span className="font-medium text-green-600">{op.client.phone}</span>
                                                        </a>
                                                    )}
                                                    {canUseAttachments && (
                                                        <AccordionTrigger className="text-sm text-primary hover:underline p-0 justify-end [&>svg]:ml-1">
                                                           ({attachmentCount}) Anexos
                                                        </AccordionTrigger>
                                                    )}
                                                </div>
                                                {canUseAttachments && (
                                                <AccordionContent className="pt-4">
                                                    <div className="space-y-2">
                                                        <AttachmentsUploader 
                                                            accountId={accountId!}
                                                            attachments={op.attachments || []}
                                                            onAttachmentUploaded={(newAttachment) => handleAttachmentUploaded(op, newAttachment)}
                                                            onAttachmentDeleted={(attachmentToDelete) => handleAttachmentDeleted(op, attachmentToDelete)}
                                                            uploadPath={`accounts/${accountId}/operations/${op.id}/attachments`}
                                                            showDeleteButton={false}
                                                            showLabel={false}
                                                        />
                                                    </div>
                                                </AccordionContent>
                                                )}
                                            </AccordionItem>
                                        </Accordion>
                                    </div>
                                    <div className="mt-4">
                                        <OperationCardActions operation={op} />
                                    </div>
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
