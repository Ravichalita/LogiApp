
'use client';

import React, { useEffect, useState, useMemo, useTransition } from 'react';
import { getDumpsters, getRentals, fetchClients, fetchAccount } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DumpsterActions, MaintenanceCheckbox } from './dumpster-actions';
import { Separator } from '@/components/ui/separator';
import type { Dumpster, Rental, EnhancedDumpster, DerivedDumpsterStatus, DumpsterColor, Client, PopulatedRental, Account } from '@/lib/types';
import { DUMPSTER_COLORS } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, GanttChartSquare, ShieldAlert, ChevronDown, User, MapPin, Map as MapIcon } from 'lucide-react';
import { isAfter, isWithinInterval, startOfToday, format, isToday, parseISO, subDays, endOfDay, isBefore, isSameDay, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateDumpsterStatusAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GanttSpreadsheet } from './gantt-spreadsheet';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { DumpstersMap } from './dumpsters-map';


function ColorDisplay({ color }: { color: DumpsterColor }) {
    const colorHex = DUMPSTER_COLORS[color]?.value || '#ccc';
    return (
        <div className="flex items-center gap-2">
            <div 
                className="h-4 w-4 rounded-sm border border-border"
                style={{ backgroundColor: colorHex }}
            />
            <span>{color}</span>
        </div>
    );
}


function DumpsterTableSkeleton() {
    return (
         <div className="border rounded-md bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Tamanho (m³)</TableHead>
                        <TableHead className="w-[300px]">Status / Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

const filterOptions: { label: string, value: DerivedDumpsterStatus | 'Todos' | 'Em Atraso' }[] = [
    { label: "Todas", value: 'Todos' },
    { label: "Disponível", value: 'Disponível' },
    { label: "Alugada", value: 'Alugada' },
    { label: "Encerra hoje", value: 'Encerra hoje' },
    { label: "Reservada", value: 'Reservada' },
    { label: "Em Atraso", value: 'Em Atraso' },
    { label: "Em Manutenção", value: 'Em Manutenção' },
];

export default function DumpstersPage() {
  const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [allRentals, setAllRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DerivedDumpsterStatus | 'Todos' | 'Em Atraso'>('Todos');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessRentals;

  const spreadsheetDateRange = useMemo(() => {
    const startDate = new Date();
    const endDate = addDays(startDate, 29); // 30 days total
    return `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }

    if (accountId) {
      const unsubscribeDumpsters = getDumpsters(accountId, (data) => {
        setDumpsters(data);
        if(loading) setLoading(false);
      });
      const unsubscribeRentals = getRentals(accountId, (data) => {
        setAllRentals(data);
      });
      
      fetchClients(accountId).then(setClients);

      return () => {
        unsubscribeDumpsters();
        unsubscribeRentals();
      }
    } else {
        setDumpsters([]);
        setAllRentals([]);
        setClients([]);
        setLoading(false);
    }
  }, [accountId, authLoading, canAccess, loading, router]);

 const dumpstersWithDerivedStatus = useMemo((): EnhancedDumpster[] => {
    const today = new Date();
    const clientMap = new Map(clients.map(c => [c.id, c]));

    const dumpstersMap = new Map<string, EnhancedDumpster>(
      dumpsters.map(d => [d.id, { ...d, derivedStatus: d.status, scheduledRentals: [] }])
    );

    allRentals.forEach(rental => {
        const rentalClient = clientMap.get(rental.clientId);
        if (!rentalClient) return;

        (rental.dumpsterIds || []).forEach(dumpsterId => {
            const dumpster = dumpstersMap.get(dumpsterId);
            if (dumpster) {
                 const populatedRental = {
                    ...rental,
                    itemType: 'rental',
                    dumpsters: [], // Simplified for this context
                    client: rentalClient,
                    assignedToUser: null // Not needed for this view
                } as unknown as PopulatedRental;

                dumpster.scheduledRentals.push(populatedRental);
            }
        });
    });

    dumpstersMap.forEach(d => {
        if (d.status === 'Em Manutenção') {
            d.derivedStatus = 'Em Manutenção';
            return;
        }

        d.scheduledRentals.sort((a, b) => new Date(a.rentalDate).getTime() - new Date(b.rentalDate).getTime());

        const now = new Date();
        const activeRental = d.scheduledRentals.find(r => 
            isWithinInterval(now, { start: parseISO(r.rentalDate), end: endOfDay(parseISO(r.returnDate)) })
        );
        const overdueRental = d.scheduledRentals.find(r => 
            isAfter(startOfToday(), endOfDay(parseISO(r.returnDate))) && !activeRental
        );
        const futureRentals = d.scheduledRentals.filter(r => 
            isAfter(startOfToday(parseISO(r.rentalDate)), now)
        );
        
        let baseStatus = '';
        if (overdueRental) {
            baseStatus = 'Em Atraso';
        } else if (activeRental) {
            baseStatus = isToday(parseISO(activeRental.returnDate)) ? 'Encerra hoje' : 'Alugada';
        }
        
        if (futureRentals.length > 0) {
            const nextBookingDate = format(parseISO(futureRentals[0].rentalDate), "dd/MM/yy");
            d.derivedStatus = baseStatus ? `${baseStatus} / Agendada` : `Reservada para ${nextBookingDate}`;
        } else if (baseStatus) {
            d.derivedStatus = baseStatus;
        } else {
            d.derivedStatus = 'Disponível';
        }
    });

    return Array.from(dumpstersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}, [dumpsters, allRentals, clients]);


  const filteredDumpsters = useMemo(() => {
    let result = dumpstersWithDerivedStatus;

    if (statusFilter !== 'Todos') {
        if (statusFilter === 'Reservada') {
            result = result.filter(d => d.derivedStatus.startsWith('Reservada para'));
        } else {
            result = result.filter(d => d.derivedStatus.startsWith(statusFilter));
        }
    }

    if (searchTerm) {
      result = result.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(d.size).includes(searchTerm)
      );
    }

    return result;
  }, [dumpstersWithDerivedStatus, searchTerm, statusFilter]);
  
  const handleToggleStatus = (dumpster: EnhancedDumpster) => {
    if (!accountId) return;
    const isRented = dumpster.derivedStatus === 'Alugada' || dumpster.derivedStatus === 'Encerra hoje' || dumpster.derivedStatus === 'Em Atraso' || dumpster.derivedStatus.includes('Agendada');
    const isReserved = dumpster.derivedStatus.startsWith('Reservada');

    if (isRented || isReserved) return;

    const newStatus = dumpster.status === 'Disponível' ? 'Em Manutenção' : 'Disponível';
    
    startTransition(async () => {
        const result = await updateDumpsterStatusAction(accountId, dumpster.id, newStatus);
        if (result.message === 'error') {
             toast({
                title: 'Erro',
                description: result.error,
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Sucesso',
                description: `Status da caçamba alterado para ${newStatus}.`
            });
        }
    });
  };
  
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const isLoading = authLoading || (loading && canAccess);
  
  if (!isLoading && !canAccess) {
    return (
        <div className="container mx-auto py-8 px-4 md:px:6">
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
        <h1 className="text-3xl font-bold mb-2 font-headline">Gerenciar Caçambas</h1>
        <p className="text-muted-foreground mb-8">
            Visualize e gerencie seu inventário de caçambas.
        </p>

        <Card className="mb-6">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-3 sm:p-6 sm:pb-2">
                 <div className="flex min-w-0 items-center gap-2">
                    <MapIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <CardTitle className="flex-shrink-0 text-sm font-medium sm:text-base">Mapa de Caçambas</CardTitle>
                </div>
            </CardHeader>
             <CardContent className="p-0 h-96">
                {loading ? <Skeleton className="h-full w-full" /> : <DumpstersMap dumpsters={dumpstersWithDerivedStatus} />}
            </CardContent>
        </Card>

        <Card className="mb-6">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-3 sm:p-6 sm:pb-2">
                <div className="flex min-w-0 items-center gap-2">
                    <GanttChartSquare className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                        <CardTitle className="flex-shrink-0 text-sm font-medium sm:text-base">Planilha de Disponibilidade</CardTitle>
                        <span className="flex-shrink-0 text-xs text-muted-foreground sm:text-sm">{spreadsheetDateRange}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    {loading ? <Skeleton className="h-[200px] w-full" /> : <GanttSpreadsheet dumpsters={dumpsters} rentals={allRentals} clients={clients} />}
                </div>
            </CardContent>
        </Card>
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Buscar por nome, cor, tamanho..."
                className="pl-9 bg-card"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex flex-wrap gap-2 pt-4 mb-6">
            {filterOptions.map(option => (
                <Button
                    key={option.value}
                    variant={statusFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(option.value as DerivedDumpsterStatus | 'Todos')}
                    className="text-xs h-7"
                >
                    {option.label}
                </Button>
            ))}
        </div>
        
        {isLoading ? <DumpsterTableSkeleton /> : (
            <>
                {/* Table for larger screens */}
                <div className="hidden md:block border rounded-md bg-card">
                  <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Identificador</TableHead>
                            <TableHead>Cor</TableHead>
                            <TableHead>Tamanho (m³)</TableHead>
                            <TableHead className="w-[300px]">Status / Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDumpsters.length > 0 ? filteredDumpsters.map(dumpster => (
                            <React.Fragment key={dumpster.id}>
                                <TableRow>
                                    <TableCell className="p-0 pl-2">
                                        {dumpster.scheduledRentals.length > 0 && (
                                            <Button variant="ghost" size="icon" onClick={() => toggleRow(dumpster.id)} aria-label="Ver detalhes">
                                                <ChevronDown className={cn("h-4 w-4 transition-transform", expandedRows.has(dumpster.id) && "rotate-180")} />
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{dumpster.name}</TableCell>
                                    <TableCell><ColorDisplay color={dumpster.color as DumpsterColor} /></TableCell>
                                    <TableCell>{dumpster.size}</TableCell>
                                    <TableCell>
                                        <DumpsterActions dumpster={dumpster} />
                                    </TableCell>
                                </TableRow>
                                {expandedRows.has(dumpster.id) && (
                                     <TableRow>
                                        <TableCell colSpan={5} className="p-0">
                                            <div className="p-4 bg-muted/50">
                                                <h4 className="font-semibold mb-2">Agendamentos</h4>
                                                <div className="space-y-3">
                                                {dumpster.scheduledRentals.map(rental => (
                                                    <div key={rental.id} className="text-sm p-3 border-l-4 rounded-r-md bg-background shadow-sm">
                                                        <div className="flex items-start gap-2">
                                                            <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Cliente</p>
                                                                <p className="font-medium">{rental.client?.name}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 mt-2">
                                                            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Endereço</p>
                                                                <p className="font-medium">{rental.deliveryAddress}</p>
                                                            </div>
                                                        </div>
                                                        {rental.rentalDate && rental.returnDate && (
                                                            <p className="text-xs text-muted-foreground text-center pt-2 mt-2 border-t">
                                                                Período de {format(parseISO(rental.rentalDate), 'dd/MM')} a {format(parseISO(rental.returnDate), 'dd/MM')}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Nenhuma caçamba encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                  </Table>
                </div>

                {/* Cards for smaller screens */}
                <div className="md:hidden space-y-4">
                {filteredDumpsters.length > 0 ? filteredDumpsters.map(dumpster => {
                    const isRented = dumpster.derivedStatus === 'Alugada' || dumpster.derivedStatus === 'Encerra hoje' || dumpster.derivedStatus === 'Em Atraso' || dumpster.derivedStatus.includes('Agendada');
                    const isReserved = dumpster.derivedStatus.startsWith('Reservada');
                    return (
                         <Card key={dumpster.id} className="border rounded-lg overflow-hidden">
                            <div className="p-4 space-y-3 bg-card">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-lg">{dumpster.name}</h3>
                                    <DumpsterActions dumpster={dumpster} />
                                </div>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <ColorDisplay color={dumpster.color as DumpsterColor} />
                                    <span>Tamanho: <span className="font-medium text-foreground">{dumpster.size} m³</span></span>
                                </div>

                                {dumpster.scheduledRentals.length > 0 && (
                                     <Button variant="ghost" className="w-full justify-center p-2 h-auto text-sm" onClick={() => toggleRow(dumpster.id)}>
                                        Ver Detalhes do Agendamento ({dumpster.scheduledRentals.length})
                                        <ChevronDown className={cn("h-4 w-4 ml-2 transition-transform", expandedRows.has(dumpster.id) && "rotate-180")} />
                                    </Button>
                                )}

                                <Separator />
                                <div className="pt-1">
                                    <MaintenanceCheckbox 
                                        dumpster={dumpster}
                                        isPending={isPending}
                                        handleToggleStatus={() => handleToggleStatus(dumpster)}
                                        isReservedOrRented={isRented || isReserved}
                                    />
                                </div>
                            </div>
                            {expandedRows.has(dumpster.id) && (
                                <div className="p-4 border-t bg-muted/50">
                                    <div className="space-y-4 text-sm">
                                    {dumpster.scheduledRentals.map((rentalInfo) => (
                                        <div key={rentalInfo.id} className="space-y-3 border-b pb-3 last:border-b-0 last:pb-0">
                                        <div className="flex items-start gap-2">
                                            <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Cliente</p>
                                                <p className="font-medium">{rentalInfo.client?.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Endereço</p>
                                                <p className="font-medium">{rentalInfo.deliveryAddress}</p>
                                            </div>
                                        </div>
                                        {rentalInfo.rentalDate && rentalInfo.returnDate && (
                                            <p className="text-xs text-muted-foreground text-center pt-2">
                                                Período de {format(parseISO(rentalInfo.rentalDate), 'dd/MM')} a {format(parseISO(rentalInfo.returnDate), 'dd/MM')}
                                            </p>
                                        )}
                                        </div>
                                    ))}
                                </div>
                                </div>
                            )}
                         </Card>
                    )
                }) : (
                     <div className="text-center py-16 bg-card rounded-lg border">
                        <p className="text-muted-foreground">Nenhuma caçamba encontrada.</p>
                    </div>
                )}
                </div>
            </>
        )}
    </div>
  );
}
