
'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { getDumpsters, getRentals, fetchClients } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DumpsterActions, MaintenanceCheckbox, DumpsterOptionsMenu } from './dumpster-actions';
import { Separator } from '@/components/ui/separator';
import type { Dumpster, Rental, EnhancedDumpster, DerivedDumpsterStatus, DumpsterColor, Client } from '@/lib/types';
import { DUMPSTER_COLORS } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, GanttChartSquare } from 'lucide-react';
import { isAfter, isWithinInterval, startOfToday, format, isToday, parseISO, subDays, endOfDay, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateDumpsterStatusAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GanttSpreadsheet } from './gantt-spreadsheet';


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
                        <TableHead>Identificador</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Tamanho (m³)</TableHead>
                        <TableHead>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
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

const filterOptions: { label: string, value: DerivedDumpsterStatus | 'Todos' }[] = [
    { label: "Todas", value: 'Todos' },
    { label: "Disponível", value: 'Disponível' },
    { label: "Alugada", value: 'Alugada' },
    { label: "Encerra hoje", value: 'Encerra hoje' },
    { label: "Reservada", value: 'Reservada' },
    { label: "Em Manutenção", value: 'Em Manutenção' },
];

export default function DumpstersPage() {
  const { accountId } = useAuth();
  const [dumpsters, setDumpsters] = useState<Dumpster[]>([]);
  const [allRentals, setAllRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DerivedDumpsterStatus | 'Todos'>('Todos');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const spreadsheetDateRange = useMemo(() => {
    const startDate = new Date();
    const endDate = addDays(startDate, 29); // 30 days total
    return `${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')}`;
  }, []);

  useEffect(() => {
    if (accountId) {
      const unsubscribeDumpsters = getDumpsters(accountId, (data) => {
        setDumpsters(data);
        if(loading) setLoading(false);
      });
      const unsubscribeRentals = getRentals(accountId, (data) => {
        setAllRentals(data);
      });
      
      // Fetch clients for the spreadsheet tooltips
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
  }, [accountId, loading]);

  const dumpstersWithDerivedStatus = useMemo((): EnhancedDumpster[] => {
    const today = startOfToday();
    
    return dumpsters.map(d => {
      if (d.status === 'Em Manutenção') {
        return { ...d, derivedStatus: 'Em Manutenção' };
      }
      
      const dumpsterRentals = allRentals.filter(r => r.dumpsterId === d.id);
      
      const activeRental = dumpsterRentals.find(r => {
          const rentalStart = parseISO(r.rentalDate);
          const rentalEnd = parseISO(r.returnDate);
          // An active rental is one where today is between the start and end dates (inclusive).
          return isToday(rentalStart) || isToday(rentalEnd) || isWithinInterval(today, { start: rentalStart, end: rentalEnd });
      });


      if(activeRental) {
        const returnDate = parseISO(activeRental.returnDate);
        if (isToday(returnDate)) {
            return { ...d, derivedStatus: 'Encerra hoje' };
        }
        return { ...d, derivedStatus: 'Alugada' };
      }

      const futureRental = dumpsterRentals
        .filter(r => isAfter(parseISO(r.rentalDate), today))
        .sort((a,b) => new Date(a.rentalDate).getTime() - new Date(b.rentalDate).getTime())[0]; 

      if (futureRental) {
         const formattedDate = format(parseISO(futureRental.rentalDate), "dd/MM/yy");
         return { ...d, derivedStatus: `Reservada para ${formattedDate}` };
      }
      
      return { ...d, derivedStatus: 'Disponível' };
    }).sort((a, b) => a.name.localeCompare(b.name));

  }, [dumpsters, allRentals]);

  const filteredDumpsters = useMemo(() => {
    let result = dumpstersWithDerivedStatus;

    if (statusFilter !== 'Todos') {
        if (statusFilter === 'Reservada') {
            result = result.filter(d => d.derivedStatus.startsWith('Reservada para'));
        } else {
            result = result.filter(d => d.derivedStatus === statusFilter);
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
    const isRented = dumpster.derivedStatus === 'Alugada' || dumpster.derivedStatus === 'Encerra hoje';
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


  return (
    <div className="container mx-auto py-8 px-4 md:px:6">
        <h1 className="text-3xl font-bold mb-2 font-headline">Gerenciar Caçambas</h1>
        <p className="text-muted-foreground mb-8">
            Visualize e gerencie seu inventário de caçambas.
        </p>

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
        
        {loading ? <DumpsterTableSkeleton /> : (
            <>
                {/* Table for larger screens */}
                <div className="hidden md:block border rounded-md bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Identificador</TableHead>
                            <TableHead>Cor</TableHead>
                            <TableHead>Tamanho (m³)</TableHead>
                            <TableHead>Status / Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredDumpsters.length > 0 ? filteredDumpsters.map(dumpster => (
                        <TableRow key={dumpster.id}>
                        <TableCell className="font-medium">{dumpster.name}</TableCell>
                        <TableCell><ColorDisplay color={dumpster.color as DumpsterColor} /></TableCell>
                        <TableCell>{dumpster.size}</TableCell>
                        <TableCell>
                            <DumpsterActions dumpster={dumpster} />
                        </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
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
                    const isRented = dumpster.derivedStatus === 'Alugada' || dumpster.derivedStatus === 'Encerra hoje';
                    const isReserved = dumpster.derivedStatus.startsWith('Reservada');
                    return (
                    <div key={dumpster.id} className="border rounded-lg p-4 space-y-3 bg-card">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-lg">{dumpster.name}</h3>
                            <DumpsterActions dumpster={dumpster} />
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <ColorDisplay color={dumpster.color as DumpsterColor} />
                            <span>Tamanho: <span className="font-medium text-foreground">{dumpster.size} m³</span></span>
                        </div>
                        <Separator />
                        <div className="pt-1 flex items-center gap-4">
                                <DumpsterOptionsMenu dumpster={dumpster} />
                            <MaintenanceCheckbox 
                                dumpster={dumpster}
                                isPending={isPending}
                                handleToggleStatus={() => handleToggleStatus(dumpster)}
                                isReservedOrRented={isRented || isReserved}
                            />
                        </div>
                    </div>
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
