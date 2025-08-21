
'use client';

import { useEffect, useState, useMemo } from 'react';
import { getRentals } from '@/lib/data';
import type { PopulatedRental } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, User, MapPin, Calendar, Mail, Phone, Home, FileText, CircleDollarSign, CalendarDays, ChevronDown, Filter } from 'lucide-react';
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
import { differenceInCalendarDays, startOfToday, isBefore, isAfter } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

function calculateRentalDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = differenceInCalendarDays(end, start);
    return Math.max(diff, 1); // Ensure at least 1 day is charged
}

function formatPhoneNumberForWhatsApp(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '');
    return `55${digitsOnly}`;
}

export type RentalStatusType = 'Pendente' | 'Ativo' | 'Em Atraso';
type RentalStatus = { text: RentalStatusType; variant: 'default' | 'destructive' | 'secondary' | 'success' };

export function getRentalStatus(rental: PopulatedRental): RentalStatus {
    const today = startOfToday();
    const rentalDate = new Date(rental.rentalDate);
    const returnDate = new Date(rental.returnDate);
    
    if (isBefore(returnDate, today)) {
      return { text: 'Em Atraso', variant: 'destructive' };
    }
    if (isAfter(rentalDate, today)) {
      return { text: 'Pendente', variant: 'secondary' };
    }
    return { text: 'Ativo', variant: 'success' };
}

const filterOptions: { label: string, value: 'Todos' | RentalStatusType }[] = [
    { label: "Todos", value: 'Todos' },
    { label: "Ativos", value: 'Ativo' },
    { label: "Pendentes", value: 'Pendente' },
    { label: "Em Atraso", value: 'Em Atraso' },
];


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
  const [statusFilter, setStatusFilter] = useState<'Todos' | RentalStatusType>('Todos');

  useEffect(() => {
    if (user) {
        setLoading(true);
        const unsubscribe = getRentals(user.uid, (rentals) => {
            setRentals(rentals);
            setLoading(false);
        });
        return () => unsubscribe();
    } else {
        setRentals([]);
        setLoading(false);
    }
  }, [user]);

  const filteredRentals = useMemo(() => {
    if (statusFilter === 'Todos') {
      return rentals;
    }
    return rentals.filter(rental => getRentalStatus(rental).text === statusFilter);
  }, [rentals, statusFilter]);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-headline font-bold">Aluguéis e Agendamentos</h1>
      </div>
       <div className="flex flex-wrap gap-2 pb-6">
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

       {loading ? (
        <DashboardSkeleton />
      ) : filteredRentals.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold font-headline">
            {rentals.length === 0 ? 'Nenhuma caçamba alugada no momento' : 'Nenhum aluguel encontrado para este filtro'}
          </h2>
          <p className="mt-2 text-muted-foreground">
             {rentals.length === 0 ? "Clique no botão '+' para começar." : "Tente selecionar outro filtro ou adicione um novo aluguel."}
          </p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full space-y-4">
          {filteredRentals.map(rental => {
            const rentalDays = calculateRentalDays(rental.rentalDate, rental.returnDate);
            const totalValue = rental.value * rentalDays;
            const status = getRentalStatus(rental);

            return (
              <AccordionItem value={rental.id} key={rental.id} className="border rounded-lg shadow-sm bg-card overflow-hidden">
                <div className="p-6 pb-0">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                                <Truck className="h-6 w-6 text-primary" />
                                <h3 className="font-bold text-lg font-headline">{rental.dumpster.name}</h3>
                                <Badge variant={status.variant} className="ml-2">{status.text}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                                <User className="h-4 w-4 shrink-0"/> <span>{rental.client.name}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end text-right ml-4">
                            <span className="text-sm text-muted-foreground">{status.text === 'Pendente' ? 'Início' : 'Retirada'}</span>
                            <span className="font-semibold text-base">{format(status.text === 'Pendente' ? rental.rentalDate : rental.returnDate, "dd/MM/yyyy")}</span>
                        </div>
                    </div>
                </div>
                 <AccordionTrigger className="w-full pt-4 hover:no-underline">
                    <div className="flex justify-center p-2 bg-muted/50 hover:bg-muted cursor-pointer w-full">
                         <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </div>
                 </AccordionTrigger>
                <AccordionContent>
                  <div className="p-6 pt-2 flex flex-col h-full">
                    <RentalCardActions rental={rental} status={status} />

                    <Separator className="my-6" />

                    <Accordion type="single" collapsible>
                        <AccordionItem value="client-details" className="border-b-0">
                            <AccordionTrigger className="font-medium hover:no-underline py-0">
                                Ver Detalhes do Cliente
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-start gap-3">
                                    <Phone className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-sm text-muted-foreground">(Clique para abrir o WhatsApp)</span>
                                        <Link 
                                            href={`https://wa.me/${formatPhoneNumberForWhatsApp(rental.client.phone)}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="font-medium hover:underline"
                                        >
                                            {rental.client.phone}
                                        </Link>
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
                    </Accordion>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  );
}
