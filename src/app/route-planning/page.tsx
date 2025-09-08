

'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import type { PopulatedOperation, UserAccount, Account } from '@/lib/types';
import { getPopulatedOperations, fetchAccount } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Map, ListOrdered, PlayCircle, ShieldAlert, User, Clock, MapPin, Warehouse, MoveRight, Calendar as CalendarIcon, Route, TrendingDown, DollarSign, TrendingUp, TrafficCone } from 'lucide-react';
import { isToday, parseISO, format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Spinner } from '@/components/ui/spinner';
import { optimizeRoute } from '@/ai/flows/optimize-route-flow';
import { analyzeTraffic } from '@/ai/flows/traffic-analysis-flow';
import type { OptimizeRouteOutput } from '@/ai/flows/optimize-route-flow';
import { useToast } from '@/hooks/use-toast';
import { OptimizedRouteMap } from './optimized-route-map';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface OperationsByDriver {
  driverId: string;
  driverName: string;
  operations: PopulatedOperation[];
  optimizedRoute?: OptimizeRouteOutput;
  trafficAnalysis?: string;
  isOptimizing?: boolean;
  isAnalyzingTraffic?: boolean;
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

export default function RoutePlanningPage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [account, setAccount] = useState<Account | null>(null);
    const [operationsByDriver, setOperationsByDriver] = useState<OperationsByDriver[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessRoutes;

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

            const unsub = getPopulatedOperations(accountId, (allOps) => {
                const dayStart = startOfDay(selectedDate);
                const dayEnd = endOfDay(selectedDate);

                const dayOps = allOps.filter(op => {
                    if (!op.startDate) return false;
                    const opDate = parseISO(op.startDate);
                    return isWithinInterval(opDate, { start: dayStart, end: dayEnd });
                });
                
                const groupedOps = dayOps.reduce((acc, op) => {
                    const driverId = op.driverId || 'unassigned';
                    if (!acc[driverId]) {
                        acc[driverId] = {
                            driverId: driverId,
                            driverName: op.driver?.name || 'Sem Responsável',
                            operations: [],
                            isOptimizing: false,
                        };
                    }
                    acc[driverId].operations.push(op);
                    return acc;
                }, {} as Record<string, OperationsByDriver>);

                setOperationsByDriver(Object.values(groupedOps));
                setLoadingData(false);
            }, (error) => {
                console.error(error);
                setLoadingData(false);
            });
            return unsub;
        }
        
        fetchData();

    }, [accountId, authLoading, canAccess, selectedDate]);

    const handleOptimizeRoute = async (driverId: string) => {
        const groupToOptimize = operationsByDriver.find(g => g.driverId === driverId);

        if (!groupToOptimize || !account || !account.baseAddress) {
            toast({ title: 'Erro', description: 'Dados do motorista ou endereço da base não encontrados.', variant: 'destructive' });
            return;
        }

        setOperationsByDriver(prev => prev.map(group => 
            group.driverId === driverId ? { ...group, isOptimizing: true, optimizedRoute: undefined, trafficAnalysis: undefined } : group
        ));
        
        const baseLocation = {
            address: account.baseAddress,
            lat: account.baseLatitude || 0,
            lng: account.baseLongitude || 0
        };

        try {
            const optimizedRoute = await optimizeRoute({
                operations: groupToOptimize.operations,
                startLocation: baseLocation,
                accountId: accountId!,
            });

            setOperationsByDriver(prev => prev.map(group => 
                group.driverId === driverId 
                ? { ...group, optimizedRoute, isOptimizing: false, isAnalyzingTraffic: true } 
                : group
            ));
            
            // Trigger traffic analysis after route optimization
            const routeStops = [
                baseLocation.address, 
                ...optimizedRoute.stops.map(s => s.ordemServico.destinationAddress!)
            ];
            
            const departureTime = optimizedRoute.baseDepartureTime ? parseISO(optimizedRoute.baseDepartureTime) : selectedDate;

            const trafficResult = await analyzeTraffic({
                routeStops: [...new Set(routeStops)], // Remove duplicate addresses
                date: departureTime.toISOString(),
                totalDuration: optimizedRoute.totalDuration || 'não calculado',
            });

             setOperationsByDriver(prev => prev.map(group => 
                group.driverId === driverId 
                ? { ...group, trafficAnalysis: trafficResult, isAnalyzingTraffic: false } 
                : group
            ));


        } catch (error) {
            console.error("Optimization failed:", error);
            toast({ title: 'Erro na Otimização', description: 'Não foi possível calcular a rota. Tente novamente.', variant: 'destructive' });
            setOperationsByDriver(prev => prev.map(group => 
                group.driverId === driverId ? { ...group, isOptimizing: false, isAnalyzingTraffic: false } : group
            ));
        }
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
    <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="mb-8">
            <h1 className="text-3xl font-headline font-bold">Planejamento de Rota</h1>
            <p className="text-muted-foreground mt-1">
                Otimize a sequência das suas ordens de serviço para o dia selecionado.
            </p>
        </div>

        <div className="mb-6">
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
        </div>
        
        {operationsByDriver.length === 0 && !isLoading && (
             <Card>
                <CardHeader>
                    <CardTitle>Nenhuma Operação para {format(selectedDate, 'dd/MM/yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">Nenhuma operação agendada para este dia.</p>
                </CardContent>
            </Card>
        )}

        <div className="space-y-6">
            {operationsByDriver.map(group => (
                 <Card key={group.driverId}>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                             <User className="h-6 w-6 text-primary" />
                             <CardTitle className="text-xl">{group.driverName}</CardTitle>
                        </div>
                        <CardDescription>
                            {group.operations.length} {group.operations.length === 1 ? 'operação encontrada' : 'operações encontradas'} para o dia selecionado.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={() => handleOptimizeRoute(group.driverId)} disabled={group.isOptimizing || isLoading || authLoading || loadingData} className="w-full">
                            {group.isOptimizing ? <Spinner size="small" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                            Otimizar Rota de {group.driverName}
                        </Button>
                        
                        {group.isOptimizing && (
                            <div className="flex justify-center items-center p-4">
                                <Spinner />
                            </div>
                        )}
                        
                         {!group.isOptimizing && group.optimizedRoute && group.optimizedRoute.stops.length > 0 && account && (
                             <div className="space-y-4 pt-4">
                                <div className="h-96 w-full rounded-md overflow-hidden border">
                                     <OptimizedRouteMap 
                                        baseLocation={{address: account.baseAddress || '', lat: account.baseLatitude || 0, lng: account.baseLongitude || 0}} 
                                        stops={group.optimizedRoute.stops} 
                                    />
                                </div>
                                
                                <h4 className="font-semibold">Rota Otimizada:</h4>
                                <ol className="space-y-3">
                                     {group.optimizedRoute.baseDepartureTime && (
                                        <div className="p-3 border rounded-md bg-primary/10">
                                            <div className="flex items-center gap-2 font-bold">
                                                <Warehouse className="h-5 w-5" />
                                                <span>Ponto de Partida: Base</span>
                                            </div>
                                            <div className="text-sm mt-2 flex items-center gap-2">
                                                 <Clock className="h-4 w-4 text-muted-foreground" />
                                                 <span>Saída da base às: <span className="font-bold">{format(parseISO(group.optimizedRoute.baseDepartureTime), 'HH:mm')}</span></span>
                                            </div>
                                        </div>
                                     )}
                                    {group.optimizedRoute.stops.map(stop => (
                                        <li key={stop.ordemServico.id}>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                <MoveRight className="h-3 w-3" />
                                                <span>Sair até as <span className="font-semibold text-foreground">{format(parseISO(stop.horarioSugeridoSaidaDoPontoAnterior), 'HH:mm')}</span> para o próximo destino</span>
                                            </div>
                                            <div className="p-3 border rounded-md bg-muted/50">
                                                <p className="font-bold">{stop.ordemNaRota}. {stop.ordemServico.client?.name}</p>
                                                <p className="text-sm">{stop.ordemServico.destinationAddress}</p>
                                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        <span>Chegada: {format(parseISO(stop.horarioPrevistoChegada), 'HH:mm')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span>Duração Viagem: ~{stop.tempoViagemAteAquiMin} min</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                                <Separator className="my-4" />
                                <div className="p-3 border rounded-md bg-muted/50">
                                    <h5 className="font-semibold mb-2">Resumo da Rota</h5>
                                    <div className="flex flex-wrap justify-between text-sm gap-y-2 gap-x-4">
                                        <div className="flex items-center gap-2">
                                            <Route className="h-4 w-4 text-muted-foreground"/>
                                            <span>Distância Total:</span>
                                            <span className="font-bold">{group.optimizedRoute.totalDistance}</span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground"/>
                                            <span>Tempo Total de Viagem:</span>
                                            <span className="font-bold">{group.optimizedRoute.totalDuration}</span>
                                        </div>
                                        {group.optimizedRoute.totalRevenue !== undefined && (
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4 text-muted-foreground"/>
                                                <span>Receita Bruta Total:</span>
                                                <span className="font-bold text-green-600">{formatCurrency(group.optimizedRoute.totalRevenue)}</span>
                                            </div>
                                        )}
                                        {group.optimizedRoute.totalCost !== undefined && (
                                            <div className="flex items-center gap-2">
                                                <TrendingDown className="h-4 w-4 text-muted-foreground"/>
                                                <span>Custo Total da Operação:</span>
                                                <span className="font-bold text-destructive">{formatCurrency(group.optimizedRoute.totalCost)}</span>
                                            </div>
                                        )}
                                        {group.optimizedRoute.profit !== undefined && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-muted-foreground"/>
                                                <span>Lucro Previsto:</span>
                                                <span className={cn("font-bold", group.optimizedRoute.profit >= 0 ? "text-green-600" : "text-destructive")}>
                                                    {formatCurrency(group.optimizedRoute.profit)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4">
                                    {(group.isAnalyzingTraffic || group.trafficAnalysis) && (
                                        <Alert>
                                            <TrafficCone className="h-4 w-4" />
                                            <AlertTitle className="font-semibold">Previsão do Trânsito</AlertTitle>
                                            <AlertDescription className="whitespace-pre-wrap">
                                                {group.isAnalyzingTraffic ? (
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center p-2">
                                                        <Spinner size="small" />
                                                        <span>Analisando condições de trânsito...</span>
                                                    </div>
                                                ) : (
                                                   formatBoldText(group.trafficAnalysis)
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {!group.isAnalyzingTraffic && group.trafficAnalysis && (
                                         <p className="text-xs text-muted-foreground text-center italic">
                                            Aviso: As respostas são geradas por inteligência artificial, meramente informativas e podem não ser precisas.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {!group.isOptimizing && (!group.optimizedRoute || group.optimizedRoute.stops.length === 0) && (
                             <div className="pt-2">
                                <h4 className="font-semibold text-sm mb-2">Operações não otimizadas:</h4>
                                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                     {group.operations.map(op => (
                                        <li key={op.id}>
                                            <span className="font-semibold text-foreground">{op.client?.name}</span> - Agendado para {op.startDate ? format(parseISO(op.startDate), 'HH:mm', { locale: ptBR }) : 'sem horário'}
                                        </li>
                                     ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
