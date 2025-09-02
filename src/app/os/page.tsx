

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals, getPopulatedOperations, fetchTeamMembers } from '@/lib/data';
import type { PopulatedRental, PopulatedOperation, UserAccount } from '@/lib/types';
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
import { Truck, Calendar, User, ShieldAlert, Search, Plus, Minus, ChevronDown, Hash, Home, Container, Workflow, Building, MapPin, FileText, DollarSign, TrendingDown, TrendingUp, Route, Clock, Sun, Cloudy, CloudRain, Snowflake, Map } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditAssignedUserDialog } from '@/app/rentals/edit-assigned-user-dialog';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { getDirectionsAction, getWeatherForecastAction } from '@/lib/data-server-actions';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';

type RentalStatus = 'Pendente' | 'Ativo' | 'Em Atraso' | 'Agendado' | 'Encerra hoje';
type OsTypeFilter = 'Todas' | 'Aluguel' | 'Operação';
type StatusFilter = RentalStatus | 'Em Andamento';


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

function getOperationStatus(op: PopulatedOperation): { text: 'Pendente' | 'Em Andamento'; variant: 'secondary' | 'success' } {
    if (!op.startDate || !op.endDate) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    const today = new Date();
    const startDate = parseISO(op.startDate);
    const endDate = parseISO(op.endDate);

    if (isFuture(startDate)) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    if (isWithinInterval(today, { start: startDate, end: endDate })) {
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
      <path d="M10.01,0C4.5,0,.02,4.44.02,9.92c0,1.77.47,3.5,1.37,5.01l-1.39,5.07,5.2-1.39h0c1.47.8,3.12,1.23,4.81,1.23,5.52,0,9.99-4.44,9.99-9.92S15.53,0,10.01,0ZM10.01,18.21c-1.69,0-3.26-.5-4.57-1.35l-3.11.83.83-3.03h0c-.95-1.35-1.5-2.98-1.5-4.75C1.66,5.34,5.4,1.63,10.01,1.63s8.35,3.71,8.35,8.29-3.74,8.29-8.35,8.29Z"/>
      <path d="M5.39,9.36c-.71-1.36-.65-2.83.51-3.83.46-.44,1.36-.4,1.62.16l.8,1.92c.1.21.09.42-.06.63-.19.22-.37.44-.56.66-.15.17-.22.31-.08.48.76,1.28,1.86,2.32,3.42,2.98.23.09.39.07.55-.12.24-.29.48-.59.72-.88.2-.26.39-.29.68-.17.66.31,1.98.94,1.98.94.49.37-.19,1.8-.79,2.16-.87.51-1.46.43-2.37.25-2.97-.59-5.28-3.13-6.43-5.18h0Z"/>
    </svg>
);

const WeatherIcon = ({ condition }: { condition: string }) => {
    const lowerCaseCondition = condition.toLowerCase();
    if (lowerCaseCondition.includes('chuva') || lowerCaseCondition.includes('rain')) {
        return <CloudRain className="h-5 w-5" />;
    }
    if (lowerCaseCondition.includes('neve') || lowerCaseCondition.includes('snow')) {
        return <Snowflake className="h-5 w-5" />;
    }
    if (lowerCaseCondition.includes('nublado') || lowerCaseCondition.includes('cloudy')) {
        return <Cloudy className="h-5 w-5" />;
    }
    return <Sun className="h-5 w-5" />;
};

const DynamicInfoLoader = ({ operation }: { operation: PopulatedOperation }) => {
  const [directions, setDirections] = useState<{ distance: string, duration: string } | null>(null);
  const [weather, setWeather] = useState<{ condition: string; tempC: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!operation.startLatitude || !operation.startLongitude || !operation.destinationLatitude || !operation.destinationLongitude || !operation.startDate) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [directionsResult, weatherResult] = await Promise.all([
          getDirectionsAction(
            { lat: operation.startLatitude, lng: operation.startLongitude },
            { lat: operation.destinationLatitude, lng: operation.destinationLongitude }
          ),
          getWeatherForecastAction(
            { lat: operation.destinationLatitude, lng: operation.destinationLongitude },
            parseISO(operation.startDate)
          )
        ]);

        if (directionsResult) setDirections(directionsResult);
        if (weatherResult) setWeather(weatherResult);

        if (!directionsResult && !weatherResult) {
            setError("Não foi possível carregar dados de rota e previsão do tempo.")
        }

      } catch (err) {
        setError("Erro ao carregar dados adicionais.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [operation]);

  if (loading) {
    return <div className="flex justify-center items-center p-4"><Spinner /></div>;
  }
  
  if (error) {
    return <Alert variant="warning" className="text-xs"><AlertDescription>{error}</AlertDescription></Alert>
  }
  
  if (!directions && !weather) {
      return null;
  }

  return (
    <div className="flex w-full items-center gap-2">
        <Alert variant="info" className="flex-grow flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {directions && (
                <>
                    <div className="flex items-center gap-2 text-sm">
                        <Route className="h-5 w-5" />
                        <span className="font-bold">{directions.distance}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-5 w-5" />
                        <span className="font-bold">{directions.duration}</span>
                    </div>
                </>
            )}
            {weather && (
              <div className="text-center">
                <div className="flex items-center gap-2 text-sm">
                  <WeatherIcon condition={weather.condition} />
                  <span className="font-bold">{weather.tempC}°C</span>
                </div>
                 <p className="text-xs mt-1 text-blue-800 dark:text-blue-300">Previsão do Tempo</p>
              </div>
            )}
        </Alert>
        <Button asChild variant="outline" size="sm" className="h-auto self-stretch">
            <Link 
                href={`https://www.google.com/maps/dir/?api=1&origin=${operation.startLatitude},${operation.startLongitude}&destination=${operation.destinationLatitude},${operation.destinationLongitude}`}
                target="_blank"
                className="flex flex-col items-center justify-center p-2 text-center"
            >
                <Map className="h-4 w-4" />
                <span className="text-[10px] leading-tight mt-1">Trajeto no mapa</span>
            </Link>
        </Button>
    </div>
  );
};


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
  const [statusFilter, setStatusFilter] = useState<StatusFilter | 'Todas'>('Todas');
  const router = useRouter();

  const permissions = userAccount?.permissions;
  const canAccessRentals = isSuperAdmin || permissions?.canAccessRentals;
  const canAccessOperations = isSuperAdmin || permissions?.canAccessOperations;
  const canEditRentals = isSuperAdmin || permissions?.canEditRentals;
  const canSeeFinance = isSuperAdmin || userAccount?.role === 'owner' || permissions?.canAccessFinance;
  
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
      if (canEditRentals) {
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

  }, [authLoading, accountId, user, userAccount, canAccessRentals, canAccessOperations, canEditRentals, isSuperAdmin]);


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
                if (statusFilter === 'Em Andamento' || statusFilter === 'Pendente') {
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
            const id = (item.itemType === 'rental' ? `AL${item.sequentialId}` : `OP${item.sequentialId}`).toLowerCase();
            return clientName.includes(lowercasedTerm) || assignedName.includes(lowercasedTerm) || id.includes(lowercasedTerm);
        });
    }

    return allItems.sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());

  }, [rentals, operations, searchTerm, osTypeFilter, statusFilter, canAccessRentals, canAccessOperations]);
  
  const handleTypeFilterChange = (type: OsTypeFilter) => {
    setOsTypeFilter(type);
    setStatusFilter('Todas'); // Reset status filter when type changes
  };

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
        <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
                {typeFilterOptions.map(option => (
                    <Button
                        key={option.value}
                        variant={osTypeFilter === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTypeFilterChange(option.value)}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
             <div className="flex flex-wrap gap-2">
                <Button
                    variant={statusFilter === 'Todas' ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter('Todas')}
                    className="text-xs h-7"
                >
                    Todos Status
                </Button>
                {statusFilterOptions.map(option => (
                    <Button
                        key={option.value}
                        variant={statusFilter === option.value ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setStatusFilter(option.value as StatusFilter)}
                        className="text-xs h-7"
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
                const status = getOperationStatus(op);
                const totalCost = op.totalCost ?? 0;
                const profit = (op.value || 0) - totalCost;
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
                                             <Badge variant={status.variant}>{status.text}</Badge>
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
                                    </div>
                                </CardHeader>
                                 <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                </AccordionTrigger>
                                <AccordionContent className="p-4">
                                    <div className="space-y-4 text-sm">
                                        <Separator />
                                         <div className="mt-3 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                                                 <span className="text-xs font-semibold uppercase text-muted-foreground">Destino:</span>
                                                 <span>{op.destinationAddress}</span>
                                            </div>
                                             <div className="mt-2">
                                                <DynamicInfoLoader operation={op} />
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
                                        <Separator />

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
                                        
                                        {op.client?.phone && (
                                            <div className="pt-2 flex justify-start">
                                                <a 
                                                    href={`https://wa.me/${formatPhoneNumberForWhatsApp(op.client.phone)}`}
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-green-600 hover:underline"
                                                >
                                                    <WhatsAppIcon className="h-4 w-4 fill-current" />
                                                    <span className="font-medium">{op.client.phone}</span>
                                                    <span className="text-xs text-muted-foreground ml-1">(Contatar Cliente)</span>
                                                </a>
                                            </div>
                                        )}
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
