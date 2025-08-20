'use client';

import { useEffect, useState } from 'react';
import { getRentals } from '@/lib/data';
import type { PopulatedRental } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, User, MapPin, Calendar, Mail, Phone, Home, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from '@/components/ui/separator';
import { RentalCardActions } from './rentals/rental-card-actions';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';


function DashboardSkeleton() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
             {[...Array(3)].map((_, i) => (
                <Card key={i} className="flex flex-col shadow-md">
                    <CardHeader>
                         <CardTitle className="flex items-center justify-between">
                            <Skeleton className="h-6 w-32" />
                             <Skeleton className="h-5 w-16" />
                         </CardTitle>
                         <CardDescription>
                             <Skeleton className="h-4 w-20" />
                         </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4">
                        <div className="flex items-start gap-3">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <div className="w-full space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-5 w-2/3" />
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <div className="w-full space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-5 w-full" />
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <div className="w-full space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-5 w-1/2" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
             ))}
        </div>
    )
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [rentals, setRentals] = useState<PopulatedRental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
        const unsubscribe = getRentals(user.uid, (rentals) => {
            setRentals(rentals);
            setLoading(false);
        });
        return () => unsubscribe();
    } else if (!loading) {
        setRentals([]);
    }
  }, [user, loading]);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-headline font-bold">Painel de Controle</h1>
      </div>

       {loading ? (
        <DashboardSkeleton />
      ) : rentals.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold font-headline">Nenhuma caçamba alugada no momento</h2>
          <p className="mt-2 text-muted-foreground">Clique em "Novo Aluguel" no cabeçalho para começar.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rentals.map(rental => (
            <Accordion key={rental.id} type="single" collapsible>
               <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-headline">
                      <Truck className="h-6 w-6 text-primary" />
                      {rental.dumpster.name}
                    </span>
                    <Badge variant="destructive">Ativo</Badge>
                  </CardTitle>
                  <CardDescription>
                    {`${rental.dumpster.color}, ${rental.dumpster.size}m³`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Cliente</span>
                      <span className="font-medium">{rental.client.name}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                     <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Local</span>
                      <span>{rental.deliveryAddress}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                     <div className="flex flex-col">
                       <span className="text-sm text-muted-foreground">Retirada</span>
                       <RentalCardActions rental={rental}/>
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 pt-0">
                  <AccordionItem value="item-1" className="border-b-0">
                     <AccordionTrigger>Detalhes do Cliente</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        <Separator />
                        <div className="flex items-start gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                           <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Telefone</span>
                            <span className="font-medium">{rental.client.phone}</span>
                           </div>
                        </div>
                        {rental.client.email && (
                          <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Email</span>
                              <span className="font-medium">{rental.client.email}</span>
                            </div>
                          </div>
                        )}
                         <div className="flex items-start gap-3">
                            <Home className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Endereço Principal</span>
                              <span className="font-medium">{rental.client.address}</span>
                            </div>
                          </div>
                        {rental.client.observations && (
                           <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Observações</span>
                              <p className="font-medium whitespace-pre-wrap">{rental.client.observations}</p>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                  </AccordionItem>
                </div>
              </Card>
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}
