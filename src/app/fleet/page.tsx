
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/context/auth-context';
import type { Truck } from '@/lib/types';
import { getTrucks } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TruckActions, MaintenanceCheckbox } from './truck-actions';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateTruckStatusAction } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';

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

export default function FleetPage() {
  const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessFleet;

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) {
      setLoadingData(false);
      return;
    }
    
    if (!accountId) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const unsubscribe = getTrucks(accountId, (data) => {
      setTrucks(data);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, [accountId, authLoading, canAccess]);

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
                    Gerencie os veículos da sua frota.
                </p>
            </div>
        </div>
        
         {isLoading ? (
            <FleetListSkeleton />
         ) : trucks.length > 0 ? (
            <div className="space-y-4">
                {trucks.map((truck) => (
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
                                {truck.model && <span>{truck.model}</span>}
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
