

'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/context/auth-context';
import type { Truck, PopulatedOperation, Rental, Client } from '@/lib/types';
import { getTrucks, getPopulatedOperations, getRentals, fetchClients } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TruckActions, MaintenanceCheckbox } from './truck-actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Calendar, User, Container } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateTruckStatusAction } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusVariantMap: Record<Truck['status'], 'success' | 'secondary' | 'warning'> = {
  'Disponível': 'success',
  'Em Manutenção': 'secondary',
  'Em Operação': 'warning',
};


function FleetListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between">
             <div className="space-y-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
            </div>
             <Skeleton className="h-8 w-8" />
          </CardHeader>
          <CardContent className="flex justify-between items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface ScheduleItem {
    id: string;
    startDate: string;
    endDate: string;
    clientName: string;
    type: 'operation' | 'rental';
    rentalType?: 'Entrega' | 'Retirada';
}

export default function FleetPage() {
  const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [operations, setOperations] = useState<PopulatedOperation[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessFleet;

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess || !accountId) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const unsubTrucks = getTrucks(accountId, (data) => {
      setTrucks(data);
      if(operations.length > 0 || data.length > 0) setLoadingData(false);
    });

    const unsubOps = getPopulatedOperations(accountId, (data) => {
      setOperations(data);
    }, (error) => {
      console.error("Error fetching operations:", error);
    });

    const unsubRentals = getRentals(accountId, setRentals);
    fetchClients(accountId).then(setClients);
    
    // Initial loading state handler
    const timer = setTimeout(() => setLoadingData(false), 2000);

    return () => {
      unsubTrucks();
      unsubOps();
      unsubRentals();
      clearTimeout(timer);
    };
  }, [accountId, authLoading, canAccess]);

  const trucksWithSchedules = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    
    return trucks.map(truck => {
        const truckOps: ScheduleItem[] = operations
            .filter(op => op.truckId === truck.id)
            .map(op => ({
                id: op.id,
                startDate: op.startDate!,
                endDate: op.endDate!,
                clientName: op.client?.name || 'N/A',
                type: 'operation' as const,
            }));
        
        const truckRentalsDelivery: ScheduleItem[] = rentals
            .filter(r => r.truckId === truck.id)
            .map(r => ({
                id: `${r.id}-delivery`,
                startDate: r.rentalDate,
                endDate: r.rentalDate, // Delivery is a single-day event for the truck
                clientName: clientMap.get(r.clientId) || 'N/A',
                type: 'rental' as const,
                rentalType: 'Entrega' as const
            }));
            
        const truckRentalsPickup: ScheduleItem[] = rentals
            .filter(r => r.truckId === truck.id)
            .map(r => ({
                id: `${r.id}-pickup`,
                startDate: r.returnDate, // Pickup is on the return date
                endDate: r.returnDate,
                clientName: clientMap.get(r.clientId) || 'N/A',
                type: 'rental' as const,
                rentalType: 'Retirada' as const
            }));

        const schedule = [...truckOps, ...truckRentalsDelivery, ...truckRentalsPickup]
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            
      return { ...truck, schedule };
    });
  }, [trucks, operations, rentals, clients]);

  const handleToggleStatus = (truck: Truck) => {
    if (!accountId || truck.status === 'Em Operação' || isPending) return;

    const newStatus = truck.status === 'Disponível' ? 'Em Manutenção' : 'Disponível';
    startTransition(async () => {
      const result = await updateTruckStatusAction(accountId, truck.id, newStatus);
      if (result.message === 'error') {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: `Status do caminhão alterado para ${newStatus}.` });
      }
    });
  };

  const isLoading = authLoading || (loadingData && canAccess);

  if (!isLoading && !canAccess) {
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
       <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-headline font-bold">Frota de Caminhões</h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie os veículos da sua frota e seus agendamentos.
                </p>
            </div>
        </div>
        
         {isLoading ? (
            <FleetListSkeleton />
         ) : trucksWithSchedules.length > 0 ? (
            <div className="space-y-4">
                {trucksWithSchedules.map((truck) => (
                    <Card key={truck.id}>
                        <CardHeader className="flex flex-row items-start justify-between pb-4">
                           <div>
                                <CardTitle className="text-xl">{truck.name}</CardTitle>
                                <CardDescription>Placa: {truck.plate}</CardDescription>
                            </div>
                            <TruckActions truck={truck} />
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground space-x-2">
                                {truck.type && <span className="font-medium text-foreground capitalize">{truck.type}</span>}
                                {truck.year && <span>({truck.year})</span>}
                            </div>
                            <Badge variant={statusVariantMap[truck.status]}>
                                {truck.status}
                            </Badge>
                          </div>
                          <Separator />
                           <MaintenanceCheckbox
                              truck={truck}
                              isPending={isPending}
                              handleToggleStatus={() => handleToggleStatus(truck)}
                            />
                            {truck.schedule.length > 0 && (
                              <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="schedule" className="border-b-0">
                                  <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 justify-start [&>svg]:ml-1">Ver Agendamentos ({truck.schedule.length})</AccordionTrigger>
                                  <AccordionContent className="pt-2 space-y-2">
                                    {truck.schedule.map(item => (
                                      <div key={item.id} className="text-xs p-2 bg-muted/50 rounded-md">
                                        <div className="flex items-center gap-2 font-medium">
                                          {item.type === 'rental' ? <Container className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                                          <span>{format(parseISO(item.startDate), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                                           {item.type === 'rental' && <span className="font-bold">({item.rentalType})</span>}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground pl-1">
                                           <User className="h-3 w-3" />
                                          <span>{item.clientName}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
         ) : (
             <Card>
                <CardHeader>
                    <CardTitle>Caminhões Cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">Nenhum caminhão cadastrado ainda.</p>
                </CardContent>
            </Card>
         )}
    </div>
  );
}
