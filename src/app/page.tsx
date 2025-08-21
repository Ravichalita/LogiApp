
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals } from '@/lib/data';
import type { PopulatedRental, Rental } from '@/lib/lib/types';
import { isBefore, isAfter, isToday, parseISO, startOfToday } from 'date-fns';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalCardActions } from './rentals/rental-card-actions';
import { Truck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function getRentalStatus(rental: Rental) {
  const today = startOfToday();
  const rentalDate = parseISO(rental.rentalDate);
  const returnDate = parseISO(rental.returnDate);

  if (isBefore(today, rentalDate)) {
    return { text: 'Pendente', variant: 'secondary', order: 1 };
  }
  if (isAfter(today, returnDate)) {
    return { text: 'Em Atraso', variant: 'destructive', order: 2 };
  }
  if (isToday(rentalDate) || isAfter(today, rentalDate) && isBefore(today, returnDate) || isToday(returnDate)) {
     return { text: 'Ativo', variant: 'default', order: 3 };
  }
  return { text: 'Agendado', variant: 'secondary', order: 4 };
}

function RentalCardSkeleton() {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                         <Skeleton className="h-5 w-5 rounded-full mt-1" />
                        <div className="flex flex-col gap-2 w-full">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-5 w-full" />
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                         <Skeleton className="h-5 w-5 rounded-full mt-1" />
                        <div className="flex flex-col gap-2 w-full">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-5 w-3/4" />
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                         <Skeleton className="h-5 w-5 rounded-full mt-1" />
                        <div className="flex flex-col gap-2 w-full">
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-5 w-1/2" />
                        </div>
                    </div>
                </div>
                 <div className="flex flex-col md:flex-row w-full gap-2 mt-4">
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
    )
}


export default function HomePage() {
  const { accountId } = useAuth();
  const [rentals, setRentals] = useState<PopulatedRental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accountId) {
      setLoading(true);
      const unsubscribe = getPopulatedRentals(accountId, (data) => {
        setRentals(data);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
        setLoading(false);
    }
  }, [accountId]);
  
  const sortedRentals = useMemo(() => {
    return rentals.sort((a, b) => {
        const statusA = getRentalStatus(a);
        const statusB = getRentalStatus(b);
        if (statusA.order !== statusB.order) {
            return statusA.order - statusB.order;
        }
        return parseISO(a.rentalDate).getTime() - parseISO(b.rentalDate).getTime();
    });
  }, [rentals]);
  

  if (loading) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <h1 className="text-3xl font-headline font-bold mb-6">Aluguéis Ativos</h1>
            <div className="px-12">
                 <Carousel>
                    <CarouselContent>
                        <CarouselItem>
                            <RentalCardSkeleton />
                        </CarouselItem>
                    </CarouselContent>
                    <CarouselPrevious />
                    <CarouselNext />
                </Carousel>
            </div>
        </div>
    )
  }

  if (rentals.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
             <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Truck className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-headline mb-2">Nenhum aluguel ativo</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
                Você ainda não tem nenhum aluguel agendado ou em andamento. Comece cadastrando um novo aluguel.
            </p>
            <Button asChild>
                <Link href="/rentals/new">
                    Lançar Novo Aluguel
                </Link>
            </Button>
        </div>
    )
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-headline font-bold mb-6">Aluguéis Ativos</h1>
        <div className="px-12">
            <Carousel opts={{ align: "start" }} className="w-full">
                <CarouselContent>
                    {sortedRentals.map((rental) => {
                       const status = getRentalStatus(rental);
                       return (
                            <CarouselItem key={rental.id} className="md:basis-1/2 lg:basis-1/3">
                                <div className="p-1 h-full">
                                    <Card className="h-full flex flex-col">
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-xl">{rental.dumpster?.name}</CardTitle>
                                                <Badge variant={status.variant}>{status.text}</Badge>
                                            </div>
                                            <CardDescription>
                                                Alugado para <span className="font-semibold">{rental.client?.name}</span>
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-grow flex flex-col justify-between">
                                          <RentalCardActions rental={rental} status={status} />
                                        </CardContent>
                                    </Card>
                                </div>
                            </CarouselItem>
                        )
                    })}
                </CarouselContent>
                 <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        </div>
    </div>
  );
}
