

'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import type { PopulatedOperation, UserAccount, Account, Location as AppLocation, Base, PopulatedRental } from '@/lib/types';
import { getPopulatedOperations, getPopulatedRentals, fetchAccount } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Map, ListOrdered, PlayCircle, ShieldAlert, User, Clock, MapPin, Warehouse, MoveRight, Calendar as CalendarIcon, Route, TrendingDown, DollarSign, TrendingUp, TrafficCone, Navigation, Container } from 'lucide-react';
import { isToday, parseISO, format, startOfDay, endOfDay, isWithinInterval, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Spinner } from '@/components/ui/spinner';
import { optimizeRoute } from '@/ai/flows/optimize-route-flow';
import { optimizeRentalRoute } from '@/ai/flows/optimize-rental-route-flow';
import { analyzeTraffic } from '@/ai/flows/traffic-analysis-flow';
import type { OptimizeRouteOutput, OptimizedStop } from '@/ai/flows/optimize-route-flow';
import { useToast } from '@/hooks/use-toast';
import { OptimizedRouteMap } from './optimized-route-map';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { geocodeAddress } from '@/lib/data-server-actions';
import { Input } from '@/components/ui/input';

interface RouteGroup {
    startAddress: string;
    baseId?: string;
    operations: PopulatedOperation[];
    optimizedRoute?: OptimizeRouteOutput;
    trafficAnalysis?: string;
    isOptimizing?: boolean;
    isAnalyzingTraffic?: boolean;
}

interface RentalRouteGroup {
    startAddress: string;
    baseId?: string;
    items: { type: 'delivery' | 'pickup', rental: PopulatedRental }[];
    departureTime: string;
    optimizedRoute?: OptimizeRouteOutput;
    trafficAnalysis?: string;
    isOptimizing?: boolean;
    isAnalyzingTraffic?: boolean;
}

interface TasksByDriver {
  driverId: string;
  driverName: string;
  operationRoutes: RouteGroup[];
  rentalRoutes: RentalRouteGroup[];
}

// Helper function to format bold text from markdown-like syntax
const formatBoldText = (text: string | null | undefined) => {
    if (!text) return null;

    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    // If no bold parts are found, return the original text.
    if (parts.length <= 1) {
        return text;
    }
    
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

const generateGoogleMapsUrl = (baseLocation: AppLocation, stops: OptimizedStop[]): string => {
    if (stops.length === 0) {
        return `https://www.google.com/maps/search/?api=1&query=${baseLocation.lat},${baseLocation.lng}`;
    }

    const baseUrl = 'https://www.google.com/maps/dir/';
    
    const origin = `${baseLocation.lat},${baseLocation.lng}`;
    
    const destinationStop = stops[stops.length - 1].ordemServico;
    const destination = `${destinationStop.destinationLatitude},${destinationStop.destinationLongitude}`;
    
    const waypoints = stops
        .slice(0, -1) // All stops except the last one are waypoints
        .map(stop => `${stop.ordemServico.destinationLatitude},${stop.ordemServico.destinationLongitude}`)
        .join('/');

    // The final URL structure should be: /origin/waypoint1/waypoint2/.../destination
    let finalUrl = `${baseUrl}${origin}/`;
    if (waypoints) {
        finalUrl += `${waypoints}/`;
    }
    finalUrl += destination;

    return finalUrl;
};

export default function RoutePlanningPage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [account, setAccount] = useState<Account | null>(null);
    const [tasksByDriver, setTasksByDriver] = useState<TasksByDriver[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [includeOverdue, setIncludeOverdue] = useState(false);
    
    const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessRoutes;
    const canSeeFinance = isSuperAdmin || userAccount?.role === 'owner' || userAccount?.permissions?.canAccessFinance;

    useEffect(() => {
        if (authLoading) return;
        if (!canAccess || !accountId) {
            setLoadingData(false);
            return;
        }

        const fetchData = async () => {
            setLoadingData(true);
            const accountData = await fetchAccount(accountId);
            setAccount(accountData);

            const unsubOps = getPopulatedOperations(accountId, (allOps) => {
                 getPopulatedRentals(accountId, (allRentals) => {
                    const dayStart = startOfDay(selectedDate);
                    const dayEnd = endOfDay(selectedDate);
                    const today = startOfDay(new Date());

                    // Filter Operations for the day
                    const dayOps = allOps.filter(op => {
                        if (!op.startDate) return false;
                        const opDate = parseISO(op.startDate);
                        const isForToday = isWithinInterval(opDate, { start: dayStart, end: dayEnd });
                        const isOverdueOp = includeOverdue && isBefore(opDate, today);
                        return isForToday || isOverdueOp;
                    });
                    
                    const dayRentalItems: { type: 'delivery' | 'pickup', rental: PopulatedRental }[] = allRentals.flatMap(r => {
                        const items = [];
                        if (isSameDay(parseISO(r.rentalDate), selectedDate)) {
                            items.push({ type: 'delivery' as const, rental: r });
                        }
                        if (isSameDay(parseISO(r.returnDate), selectedDate)) {
                             items.push({ type: 'pickup' as const, rental: r });
                        }
                        return items;
                    });
                    
                    const combinedTasks = [
                        ...dayOps.map(op => ({ type: 'operation' as const, task: op, driverId: op.driverId || 'unassigned', driverName: op.driver?.name || 'Sem Responsável' })),
                        ...dayRentalItems.map(item => ({ type: 'rental' as const, task: item, driverId: item.rental.assignedTo, driverName: item.rental.assignedToUser?.name || 'Sem Responsável' })),
                    ];
                    
                    const groupedByDriver = combinedTasks.reduce((acc, { driverId, driverName, type, task }) => {
                        if (!driverId) return acc;
                        if (!acc[driverId]) {
                            acc[driverId] = {
                                driverId,
                                driverName,
                                operations: [],
                                rentals: []
                            };
                        }
                        if (type === 'operation') {
                            acc[driverId].operations.push(task as PopulatedOperation);
                        } else {
                            acc[driverId].rentals.push(task as { type: 'delivery' | 'pickup', rental: PopulatedRental });
                        }
                        return acc;
                    }, {} as Record<string, { driverId: string; driverName: string; operations: PopulatedOperation[]; rentals: { type: 'delivery' | 'pickup', rental: PopulatedRental }[] }>);


                    const finalGroupedData: TasksByDriver[] = Object.values(groupedByDriver).map(driverGroup => {
                        const operationRoutes = Object.values(driverGroup.operations.reduce((acc, op) => {
                            const startAddress = op.startAddress || 'Endereço de partida não definido';
                            if (!acc[startAddress]) {
                                const base = accountData?.bases?.find(b => b.address === startAddress);
                                acc[startAddress] = { startAddress, baseId: base?.id, operations: [] };
                            }
                            acc[startAddress].operations.push(op);
                            return acc;
                        }, {} as Record<string, RouteGroup>));

                        const rentalRoutes = Object.values(driverGroup.rentals.reduce((acc, item) => {
                            const startAddress = item.rental.startAddress || 'Endereço de partida não definido';
                            if (!acc[startAddress]) {
                                const base = accountData?.bases.find(b => b.address === startAddress);
                                acc[startAddress] = { startAddress, baseId: base?.id, items: [], departureTime: '08:00' };
                            }
                            acc[startAddress].items.push(item);
                            return acc;
                        }, {} as Record<string, RentalRouteGroup>));

                        return { driverId: driverGroup.driverId, driverName: driverGroup.driverName, operationRoutes, rentalRoutes };
                    });

                    setTasksByDriver(finalGroupedData);
                    setLoadingData(false);
                 }, console.error);
            }, console.error);

            return () => unsubOps();
        }
        
        fetchData();

    }, [accountId, authLoading, canAccess, selectedDate, includeOverdue]);
    
    const handleOptimizeOperationRoute = async (driverId: string, routeIndex: number) => {
        const driverGroup = tasksByDriver.find(g => g.driverId === driverId);
        const routeToOptimize = driverGroup?.operationRoutes[routeIndex];

        if (!driverGroup || !routeToOptimize || !accountId) {
            toast({ title: 'Erro', description: 'Dados do motorista ou da rota não encontrados.', variant: 'destructive' });
            return;
        }

        const startLocation = await geocodeAddress(routeToOptimize.startAddress);
        if (!startLocation) {
            toast({ title: 'Erro de Endereço', description: 'Não foi possível encontrar as coordenadas do endereço de partida.', variant: 'destructive' });
            return;
        }

        const updateOperationRouteState = (updates: Partial<RouteGroup>) => {
            setTasksByDriver(prev => prev.map(d => {
                if (d.driverId === driverId) {
                    const newRoutes = [...d.operationRoutes];
                    newRoutes[routeIndex] = { ...newRoutes[routeIndex], ...updates };
                    return { ...d, operationRoutes: newRoutes };
                }
                return d;
            }));
        };

        updateOperationRouteState({ isOptimizing: true, optimizedRoute: undefined, trafficAnalysis: undefined });

        try {
            const optimizedRoute = await optimizeRoute({
                operations: routeToOptimize.operations,
                startLocation,
                startBaseId: routeToOptimize.baseId,
                accountId: accountId,
            });

            updateOperationRouteState({ optimizedRoute, isOptimizing: false, isAnalyzingTraffic: true });
            
            const routeStops = [startLocation.address, ...optimizedRoute.stops.map(s => s.ordemServico.destinationAddress!)];
            const departureTime = optimizedRoute.baseDepartureTime ? parseISO(optimizedRoute.baseDepartureTime) : selectedDate;

            const trafficResult = await analyzeTraffic({
                routeStops: [...new Set(routeStops)],
                date: departureTime.toISOString(),
                totalDuration: optimizedRoute.totalDuration || 'não calculado',
            });

             updateOperationRouteState({ trafficAnalysis: trafficResult, isAnalyzingTraffic: false });

        } catch (error) {
            console.error("Optimization failed:", error);
            toast({ title: 'Erro na Otimização', description: 'Não foi possível calcular a rota. Tente novamente.', variant: 'destructive' });
            updateOperationRouteState({ isOptimizing: false, isAnalyzingTraffic: false });
        }
    };
    
    const handleOptimizeRentalRoute = async (driverId: string, routeIndex: number) => {
        const driverGroup = tasksByDriver.find(g => g.driverId === driverId);
        const routeToOptimize = driverGroup?.rentalRoutes[routeIndex];

        if (!driverGroup || !routeToOptimize || !accountId) {
            toast({ title: 'Erro', description: 'Dados do motorista ou da rota não encontrados.', variant: 'destructive' });
            return;
        }

        const startLocation = await geocodeAddress(routeToOptimize.startAddress);
         if (!startLocation) {
            toast({ title: 'Erro de Endereço', description: `Não foi possível encontrar as coordenadas para a base: ${routeToOptimize.startAddress}.`, variant: 'destructive' });
            return;
        }
        
        const updateRentalRouteState = (updates: Partial<RentalRouteGroup>) => {
            setTasksByDriver(prev => prev.map(d => {
                if (d.driverId === driverId) {
                    const newRoutes = [...d.rentalRoutes];
                    newRoutes[routeIndex] = { ...newRoutes[routeIndex], ...updates };
                    return { ...d, rentalRoutes: newRoutes };
                }
                return d;
            }));
        };
        
        updateRentalRouteState({ isOptimizing: true, optimizedRoute: undefined, trafficAnalysis: undefined });

        try {
            const optimizedRoute = await optimizeRentalRoute({
                rentals: routeToOptimize.items.map(i => i.rental),
                day: selectedDate.toISOString(),
                startLocation,
                baseId: routeToOptimize.baseId,
                accountId,
                baseDepartureTime: routeToOptimize.departureTime,
            });

            updateRentalRouteState({ optimizedRoute, isOptimizing: false, isAnalyzingTraffic: true });
            
            const routeStops = [startLocation.address, ...optimizedRoute.stops.map(s => s.ordemServico.destinationAddress!)];
            const departureTime = optimizedRoute.baseDepartureTime ? parseISO(optimizedRoute.baseDepartureTime) : selectedDate;

            const trafficResult = await analyzeTraffic({
                routeStops: [...new Set(routeStops)],
                date: departureTime.toISOString(),
                totalDuration: optimizedRoute.totalDuration || 'não calculado',
            });
            
            updateRentalRouteState({ trafficAnalysis: trafficResult, isAnalyzingTraffic: false });

        } catch (error) {
             console.error("Rental route optimization failed:", error);
            toast({ title: 'Erro na Otimização', description: 'Não foi possível calcular a rota de logística. Tente novamente.', variant: 'destructive' });
            updateRentalRouteState({ isOptimizing: false, isAnalyzingTraffic: false });
        }
    };
    
    const handleDepartureTimeChange = (driverId: string, routeIndex: number, time: string) => {
        setTasksByDriver(prev => prev.map(d => {
            if (d.driverId === driverId && d.rentalRoutes[routeIndex]) {
                 const newRoutes = [...d.rentalRoutes];
                 newRoutes[routeIndex] = { ...newRoutes[routeIndex], departureTime: time };
                 return { ...d, rentalRoutes: newRoutes };
            }
            return d;
        }));
    };


    const formatCurrency = (value: number | undefined | null) => {
        if (value === undefined || value === null) {
            return "R$ 0,00";
        }
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(value);
    }

    const isLoading = authLoading || loadingData;

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spinner size="large" /></div>;
    }

    if (!canAccess) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>Você não tem permissão para acessar esta página.</AlertDescription>
                </Alert>
            </div>
        );
    }


  return (
    <div className="container mx-auto py-8">
        <div className="mb-8 px-4 md:px-6">
            <h1 className="text-3xl font-headline font-bold">Planejamento de Rota IA</h1>
            <p className="text-muted-foreground mt-1">
                Deixe a Inteligência Artificial sugerir a rota mais eficiênte no mapa.
            </p>
        </div>

        <div className="mb-6 px-4 md:px-6 flex flex-wrap gap-4 items-center">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                        locale={ptBR}
                    />
                </PopoverContent>
            </Popover>
             <div className="flex items-center space-x-2">
                <Checkbox id="include-overdue" checked={includeOverdue} onCheckedChange={(checked) => setIncludeOverdue(!!checked)} />
                <Label htmlFor="include-overdue" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Incluir OSs Atrasadas
                </Label>
            </div>
        </div>
        
        {tasksByDriver.length === 0 && !isLoading && (
             <Card className="mx-4 md:mx-6">
                <CardHeader>
                    <CardTitle>Nenhuma Operação para {format(selectedDate, 'dd/MM/yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">Nenhuma operação agendada para este dia.</p>
                </CardContent>
            </Card>
        )}

        <div className="space-y-6">
            {tasksByDriver.map(group => (
                 <Card key={group.driverId} className="mx-4 md:mx-6">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                             <User className="h-6 w-6 text-primary" />
                             <CardTitle className="text-xl">{group.driverName}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Accordion type="multiple" className="space-y-4" defaultValue={['operation-routes', 'rental-routes']}>
                            {group.operationRoutes.length > 0 && (
                                <AccordionItem value="operation-routes" className="border rounded-lg shadow-sm bg-card p-4">
                                     <AccordionTrigger className="hover:no-underline font-semibold text-lg pb-4">
                                         Rotas de Operação
                                     </AccordionTrigger>
                                     <AccordionContent>
                                        <Accordion type="multiple" className="space-y-4" defaultValue={group.operationRoutes.map((_, index) => `op-route-${index}`)}>
                                            {group.operationRoutes.map((route, index) => (
                                                <AccordionItem value={`op-route-${index}`} key={index} className="border rounded-lg shadow-sm bg-muted/30 p-4">
                                                    <AccordionTrigger className="hover:no-underline font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Warehouse className="h-5 w-5 text-muted-foreground"/>
                                                            <span>Partida: {route.startAddress} ({route.operations.length} OSs)</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-4 space-y-4">
                                                        <ul className="space-y-2 text-sm text-muted-foreground">
                                                            {route.operations.map(op => (
                                                                <li key={op.id} className="flex items-center gap-2">
                                                                    <MapPin className="h-4 w-4 shrink-0" />
                                                                    <span>
                                                                        <span className="font-semibold text-foreground">{op.client?.name}</span> - {op.destinationAddress}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <Separator />
                                                        <Button onClick={() => handleOptimizeOperationRoute(group.driverId, index)} disabled={route.isOptimizing || isLoading || authLoading || loadingData} className="w-full">
                                                            {route.isOptimizing ? <Spinner size="small" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                                                            Otimizar esta Rota
                                                        </Button>

                                                        {route.isOptimizing && <div className="flex justify-center items-center p-4"><Spinner /></div>}
                                                        
                                                        {!route.isOptimizing && route.optimizedRoute && route.optimizedRoute.stops.length > 0 && account && (
                                                            <div className="space-y-4 pt-4">
                                                                <div className="h-96 w-full rounded-md overflow-hidden border">
                                                                    <OptimizedRouteMap 
                                                                        baseLocation={{address: route.startAddress, lat: route.optimizedRoute.stops[0]?.ordemServico.startLatitude || 0, lng: route.optimizedRoute.stops[0]?.ordemServico.startLongitude || 0}} 
                                                                        stops={route.optimizedRoute.stops} 
                                                                    />
                                                                </div>
                                                                
                                                                <div className="flex justify-between items-center">
                                                                    <h4 className="font-semibold">Rota Otimizada:</h4>
                                                                    <Button asChild variant="outline" size="sm">
                                                                        <a href={generateGoogleMapsUrl({address: route.startAddress, lat: route.optimizedRoute.stops[0]?.ordemServico.startLatitude || 0, lng: route.optimizedRoute.stops[0]?.ordemServico.startLongitude || 0}, route.optimizedRoute.stops)} target="_blank" rel="noopener noreferrer">
                                                                            <Navigation className="mr-2 h-4 w-4" />
                                                                            Ir para a rota
                                                                        </a>
                                                                    </Button>
                                                                </div>
                                                                 <div className="p-3 border rounded-md bg-muted/50">
                                                                    <h3 className="font-semibold text-sm mb-2">Resumo da Rota</h3>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                                        <div className="flex items-center gap-2"><Route className="h-4 w-4 text-muted-foreground"/><span>Distância Total:</span><span className="font-bold">{route.optimizedRoute.totalDistance}</span></div>
                                                                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground"/><span>Tempo Total de Viagem:</span><span className="font-bold">{route.optimizedRoute.totalDuration}</span></div>
                                                                        {canSeeFinance && (
                                                                            <>
                                                                                <div className="flex items-center gap-2 text-green-600"><TrendingUp className="h-4 w-4"/><span>Receita Bruta Total:</span><span className="font-bold">{formatCurrency(route.optimizedRoute.totalRevenue)}</span></div>
                                                                                <div className="flex items-center gap-2 text-destructive"><TrendingDown className="h-4 w-4"/><span>Custo Total da Operação:</span><span className="font-bold">{formatCurrency(route.optimizedRoute.totalCost)}</span></div>
                                                                                <div className="flex items-center gap-2 col-span-2 justify-center font-bold text-lg"><DollarSign className="h-5 w-5"/><span>Lucro Previsto:</span><span>{formatCurrency(route.optimizedRoute.profit)}</span></div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <ol className="space-y-3">
                                                                    {route.optimizedRoute.baseDepartureTime && (
                                                                        <div className="p-3 border rounded-md bg-primary/10">
                                                                            <div className="flex items-center gap-2 font-bold"><Warehouse className="h-5 w-5" /><span>Ponto de Partida: Base</span></div>
                                                                            <div className="text-sm mt-2 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>Saída da base às: <span className="font-bold">{format(parseISO(route.optimizedRoute.baseDepartureTime), 'HH:mm')}</span></span></div>
                                                                        </div>
                                                                    )}
                                                                    {route.optimizedRoute.stops.map(stop => (
                                                                        <li key={stop.ordemServico.id}>
                                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><MoveRight className="h-3 w-3" /><span>Sair até as <span className="font-semibold text-foreground">{format(parseISO(stop.horarioSugeridoSaidaDoPontoAnterior), 'HH:mm')}</span> para o próximo destino</span></div>
                                                                            <div className="p-3 border rounded-md bg-muted/50">
                                                                                <p className="font-bold">{stop.ordemNaRota}. {stop.ordemServico.client?.name}</p>
                                                                                <p className="text-sm">{stop.ordemServico.destinationAddress}</p>
                                                                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>Chegada: {format(parseISO(stop.horarioPrevistoChegada), 'HH:mm')}</span></div>
                                                                                    <div className="flex items-center gap-1"><span>Duração Viagem: ~{stop.tempoViagemAteAquiMin} min</span></div>
                                                                                </div>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ol>
                                                                <div className="space-y-2 pt-4">
                                                                    {(route.isAnalyzingTraffic || route.trafficAnalysis) && (
                                                                        <Alert>
                                                                            <AlertTitle className="font-semibold">Previsão do Trânsito</AlertTitle>
                                                                            <AlertDescription className="whitespace-pre-wrap">
                                                                                {route.isAnalyzingTraffic ? <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center p-2"><Spinner size="small" /><span>Analisando condições de trânsito...</span></div> : formatBoldText(route.trafficAnalysis)}
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                    )}
                                                                    {!route.isAnalyzingTraffic && route.trafficAnalysis && <p className="text-xs text-muted-foreground text-center italic">Aviso: As respostas são geradas por inteligência artificial, meramente informativas e podem não ser precisas.</p>}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                     </AccordionContent>
                                </AccordionItem>
                            )}

                             {group.rentalRoutes.length > 0 && (
                                <AccordionItem value="rental-routes" className="border rounded-lg shadow-sm bg-card p-4">
                                    <AccordionTrigger className="hover:no-underline font-semibold text-lg pb-4">
                                         Rotas de Logística
                                     </AccordionTrigger>
                                     <AccordionContent>
                                         <Accordion type="multiple" className="space-y-4" defaultValue={group.rentalRoutes.map((_, index) => `rental-route-${index}`)}>
                                            {group.rentalRoutes.map((route, index) => (
                                                <AccordionItem value={`rental-route-${index}`} key={index} className="border rounded-lg shadow-sm bg-muted/30 p-4">
                                                    <AccordionTrigger className="hover:no-underline font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Container className="h-5 w-5 text-muted-foreground"/>
                                                            <span>Partida: {route.startAddress} ({route.items.length} paradas)</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-4 space-y-4">
                                                        <ul className="space-y-2 text-sm text-muted-foreground">
                                                            {route.items.map(item => (
                                                                <li key={item.rental.id} className="flex items-center gap-2">
                                                                    <MapPin className="h-4 w-4 shrink-0" />
                                                                    <span>
                                                                        <span className="font-semibold capitalize text-foreground">{item.type === 'delivery' ? 'Entrega' : 'Retirada'}</span>
                                                                        : {item.rental.client?.name}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <Separator />
                                                         <div className="space-y-2">
                                                            <Label htmlFor={`departure-time-${group.driverId}-${index}`}>Horário de Saída da Base</Label>
                                                            <Input
                                                                id={`departure-time-${group.driverId}-${index}`}
                                                                type="time"
                                                                value={route.departureTime}
                                                                onChange={(e) => handleDepartureTimeChange(group.driverId, index, e.target.value)}
                                                                className="w-full md:w-auto"
                                                            />
                                                            <p className="text-xs text-muted-foreground">Informe a que horas o motorista deve iniciar esta rota.</p>
                                                        </div>
                                                         <Button onClick={() => handleOptimizeRentalRoute(group.driverId, index)} disabled={route.isOptimizing || isLoading || authLoading || loadingData} className="w-full">
                                                            {route.isOptimizing ? <Spinner size="small" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                                                            Otimizar Rota de Logística
                                                        </Button>

                                                        {route.isOptimizing && <div className="flex justify-center items-center p-4"><Spinner /></div>}
                                                        
                                                         {!route.isOptimizing && route.optimizedRoute && route.optimizedRoute.stops.length > 0 && account && (
                                                            <div className="space-y-4 pt-4">
                                                                <div className="h-96 w-full rounded-md overflow-hidden border">
                                                                    <OptimizedRouteMap
                                                                        baseLocation={{ address: route.startAddress, lat: route.optimizedRoute.stops[0]?.ordemServico.startLatitude || 0, lng: route.optimizedRoute.stops[0]?.ordemServico.startLongitude || 0 }}
                                                                        stops={route.optimizedRoute.stops}
                                                                    />
                                                                </div>
                                                                 <div className="flex justify-between items-center">
                                                                    <h4 className="font-semibold">Rota Otimizada:</h4>
                                                                    <Button asChild variant="outline" size="sm">
                                                                        <a href={generateGoogleMapsUrl({ address: route.startAddress, lat: route.optimizedRoute.stops[0]?.ordemServico.startLatitude || 0, lng: route.optimizedRoute.stops[0]?.ordemServico.startLongitude || 0 }, route.optimizedRoute.stops)} target="_blank" rel="noopener noreferrer">
                                                                            <Navigation className="mr-2 h-4 w-4" />
                                                                            Ir para a rota
                                                                        </a>
                                                                    </Button>
                                                                </div>
                                                                <div className="p-3 border rounded-md bg-muted/50">
                                                                    <h3 className="font-semibold text-sm mb-2">Resumo da Rota</h3>
                                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                                        <div className="flex items-center gap-2"><Route className="h-4 w-4 text-muted-foreground"/><span>Distância Total:</span><span className="font-bold">{route.optimizedRoute.totalDistance}</span></div>
                                                                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground"/><span>Tempo Total de Viagem:</span><span className="font-bold">{route.optimizedRoute.totalDuration}</span></div>
                                                                        {canSeeFinance && (
                                                                            <>
                                                                                <div className="flex items-center gap-2 text-destructive"><TrendingDown className="h-4 w-4"/><span>Custo Total da Operação:</span><span className="font-bold">{formatCurrency(route.optimizedRoute.totalCost)}</span></div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                 <ol className="space-y-3">
                                                                    {route.optimizedRoute.baseDepartureTime && (
                                                                        <div className="p-3 border rounded-md bg-primary/10">
                                                                            <div className="flex items-center gap-2 font-bold"><Warehouse className="h-5 w-5" /><span>Ponto de Partida: Base</span></div>
                                                                            <div className="text-sm mt-2 flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>Saída da base às: <span className="font-bold">{format(parseISO(route.optimizedRoute.baseDepartureTime), 'HH:mm')}</span></span></div>
                                                                        </div>
                                                                    )}
                                                                    {route.optimizedRoute.stops.map(stop => (
                                                                        <li key={stop.ordemServico.id}>
                                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><MoveRight className="h-3 w-3" /><span>Sair até as <span className="font-semibold text-foreground">{format(parseISO(stop.horarioSugeridoSaidaDoPontoAnterior), 'HH:mm')}</span> para o próximo destino</span></div>
                                                                            <div className="p-3 border rounded-md bg-muted/50">
                                                                                <p className="font-bold">{stop.ordemNaRota}. [{stop.ordemServico.operationTypes[0].name}] {stop.ordemServico.client?.name}</p>
                                                                                <p className="text-sm">{stop.ordemServico.destinationAddress}</p>
                                                                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                                                                                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>Chegada: {format(parseISO(stop.horarioPrevistoChegada), 'HH:mm')}</span></div>
                                                                                    <div className="flex items-center gap-1"><span>Duração Viagem: ~{stop.tempoViagemAteAquiMin} min</span></div>
                                                                                </div>
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ol>

                                                                <div className="space-y-2 pt-4">
                                                                     {(route.isAnalyzingTraffic || route.trafficAnalysis) && (
                                                                        <Alert>
                                                                            <AlertTitle className="font-semibold">Previsão do Trânsito</AlertTitle>
                                                                            <AlertDescription className="whitespace-pre-wrap">
                                                                                {route.isAnalyzingTraffic ? <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center p-2"><Spinner size="small" /><span>Analisando condições de trânsito...</span></div> : formatBoldText(route.trafficAnalysis)}
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                         </Accordion>
                                     </AccordionContent>
                                </AccordionItem>
                            )}
                        </Accordion>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
