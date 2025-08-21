
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals } from '@/lib/data';
import type { PopulatedRental, Rental } from '@/lib/types';
import { isBefore, isAfter, isToday, parseISO, startOfToday, format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RentalCardActions } from './rentals/rental-card-actions';
import { Truck, Calendar, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type RentalStatus = 'Pendente' | 'Ativo' | 'Em Atraso' | 'Agendado';
type RentalStatusFilter = RentalStatus | 'Todas';

export function getRentalStatus(rental: Rental): { text: RentalStatus; variant: 'default' | 'destructive' | 'secondary' | 'success', order: number } {
  const today = startOfToday();
  const rentalDate = parseISO(rental.rentalDate);
  const returnDate = parseISO(rental.returnDate);

  if (isAfter(today, returnDate)) {
    return { text: 'Em Atraso', variant: 'destructive', order: 1 };
  }
  if (isToday(rentalDate) || isAfter(today, rentalDate) && isBefore(today, returnDate) || isToday(returnDate)) {
     return { text: 'Ativo', variant: 'success', order: 2 };
  }
  if (isBefore(today, rentalDate)) {
    return { text: 'Pendente', variant: 'secondary', order: 3 };
  }
  return { text: 'Agendado', variant: 'secondary', order: 4 }; // Should not happen in active rentals list often
}

const filterOptions: { label: string, value: RentalStatusFilter }[] = [
    { label: "Todas", value: 'Todas' },
    { label: "Pendente", value: 'Pendente' },
    { label: "Ativo", value: 'Ativo' },
    { label: "Em Atraso", value: 'Em Atraso' },
];


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
  const [statusFilter, setStatusFilter] = useState<RentalStatusFilter>('Todas');

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
  
  const filteredAndSortedRentals = useMemo(() => {
    return rentals
     .filter(rental => {
        if (statusFilter === 'Todas') return true;
        const status = getRentalStatus(rental);
        return status.text === statusFilter;
      })
     .sort((a, b) => {
        const statusA = getRentalStatus(a);
        const statusB = getRentalStatus(b);
        if (statusA.order !== statusB.order) {
            return statusA.order - statusB.order;
        }
        return parseISO(a.rentalDate).getTime() - parseISO(b.rentalDate).getTime();
    });
  }, [rentals, statusFilter]);
  

  if (loading) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <h1 className="text-3xl font-headline font-bold mb-6">Aluguéis Ativos</h1>
            <div className="space-y-4">
                 <RentalCardSkeleton />
                 <RentalCardSkeleton />
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
      <h1 className="text-3xl font-headline font-bold mb-4">Aluguéis Ativos</h1>
      <div className="flex flex-wrap gap-2 mb-6">
            {filterOptions.map(option => (
                <Button
                    key={option.value}
                    variant={statusFilter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(option.value)}
                    className="text-xs h-7"
                >
                    {option.label}
                </Button>
            ))}
        </div>

      <div className="space-y-4">
        {filteredAndSortedRentals.length > 0 ? filteredAndSortedRentals.map((rental) => {
            const status = getRentalStatus(rental);
            return (
            <Accordion type="single" collapsible className="w-full" key={rental.id}>
                <AccordionItem value={rental.id} className="border-none">
                <Card className="h-full flex flex-col">
                    <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                        <div>
                        <CardTitle className="text-xl">{rental.dumpster?.name}</CardTitle>
                        <CardDescription>
                            Para <span className="font-semibold">{rental.client?.name}</span>
                        </CardDescription>
                        </div>
                        <Badge variant={status.variant}>{status.text}</Badge>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground pt-2">
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Retirada em {format(parseISO(rental.returnDate), "dd/MM/yy", { locale: ptBR })}</span>
                    </div>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-between pt-0">
                    <div className="text-center">
                        <AccordionTrigger className="text-sm text-primary hover:no-underline p-0 justify-center">
                        Ver Detalhes
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-1" />
                        </AccordionTrigger>
                    </div>
                    <AccordionContent className="pt-4">
                        <RentalCardActions rental={rental} status={status} />
                    </AccordionContent>
                    </CardContent>
                </Card>
                </AccordionItem>
            </Accordion>
            );
        }) : (
             <div className="text-center py-16 bg-card rounded-lg border">
                <p className="text-muted-foreground">Nenhum aluguel encontrado para o filtro "{statusFilter}".</p>
            </div>
        )}
      </div>
    </div>
  );
}
