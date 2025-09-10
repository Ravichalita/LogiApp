

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/context/auth-context';
import type { PopulatedOperation } from '@/lib/types';
import { getPopulatedOperations } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Truck, User, Building, Calendar, MapPin, DollarSign, ArrowRight, Phone, FileText, TrendingDown, TrendingUp, ChevronDown, Route, Clock, Sun, CloudRain, Cloudy, Snowflake, Map, ShieldAlert } from 'lucide-react';
import { format, parseISO, isToday, isFuture, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from '@/components/ui/separator';
import { OperationCardActions } from './operation-card-actions';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

function OperationCardSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                         <div className="mt-2 space-y-2">
                             <Skeleton className="h-4 w-1/2" />
                             <Skeleton className="h-4 w-1/3" />
                         </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center p-2 bg-muted/50">
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function getOperationStatus(op: PopulatedOperation): { text: 'Pendente' | 'Em Andamento' | 'Concluída'; variant: 'secondary' | 'success' | 'destructive' } {
    if (op.status === 'Concluído') {
        return { text: 'Concluída', variant: 'destructive' };
    }
    if (!op.startDate || !op.endDate) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    const today = new Date();
    const startDate = parseISO(op.startDate);
    const endDate = parseISO(op.endDate);

    if (isFuture(startDate)) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    if (isWithinInterval(today, { start: startDate, end: endDate })) {
        return { text: 'Em Andamento', variant: 'success' };
    }
    
    // Fallback for operations that have passed their end date but are not marked as completed
    return { text: 'Pendente', variant: 'secondary' };
}

function formatCurrency(value: number | undefined | null) {
    if (value === undefined || value === null) {
        return "N/A";
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

const formatDateRange = (start?: string, end?: string) => {
    if (!start || !end) {
        return "Período não definido";
    }
    try {
        const startDate = parseISO(start);
        const endDate = parseISO(end);
        
        const startFormat = isToday(startDate) ? "'Hoje às' HH:mm" : "dd/MM/yy 'às' HH:mm";
        const endFormat = isToday(endDate) ? "'Hoje às' HH:mm" : "dd/MM/yy 'às' HH:mm";
        
        return `${format(startDate, startFormat, { locale: ptBR })} - ${format(endDate, endFormat, { locale: ptBR })}`;
    } catch (error) {
        console.error("Error formatting date range:", error);
        return "Datas inválidas";
    }
}

const formatPhoneNumberForWhatsApp = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
    // Ensure it has the country code (assuming Brazil 55)
    if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`;
    }
    return digits;
}

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 20 20"
        className="cls-1"
        {...props}
    >
      <path d="M10.01,0C4.5,0,.02,4.44,.02,9.92c0,1.77.47,3.5,1.37,5.01l-1.39,5.07,5.2-1.39h0c1.47.8,3.12,1.23,4.81,1.23,5.52,0,9.99-4.44,9.99-9.92S15.53,0,10.01,0ZM10.01,18.21c-1.69,0-3.26-.5-4.57-1.35l-3.11.83.83-3.03h0c-.95-1.35-1.5-2.98-1.5-4.75C1.66,5.34,5.4,1.63,10.01,1.63s8.35,3.71,8.35,8.29-3.74,8.29-8.35,8.29Z"/>
      <path d="M5.39,9.36c-.71-1.36-.65-2.83.51-3.83.46-.44,1.36-.4,1.62.16l.8,1.92c.1.21.09.42-.06.63-.19.22-.37.44-.56.66-.15.17-.22.31-.08.48.76,1.28,1.86,2.32,3.42,2.98.23.09.39.07.55-.12.24-.29.48-.59.72-.88.2-.26.39-.29.68-.17.66.31,1.98.94,1.98.94.49.37-.19,1.8-.79,2.16-.87.51-1.46.43-2.37.25-2.97-.59-5.28-3.13-6.43-5.18h0Z"/>
    </svg>
);

export default function OperationsPage() {
    const { accountId, user, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [operations, setOperations] = useState<PopulatedOperation[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessOperations;
    const canEdit = isSuperAdmin || userAccount?.permissions?.canEditOperations;
    const canSeeFinance = isSuperAdmin || userAccount?.role === 'owner' || userAccount?.permissions?.canAccessFinance;
    const isViewer = userAccount?.role === 'viewer';
    const isLoading = authLoading || (loading && canAccess);

    useEffect(() => {
        if (authLoading) return;
        if (!canAccess) {
            setLoading(false);
            return;
        }

        if (!accountId) {
            setLoading(false);
            return;
        }
        
        setLoading(true);
        const userIdToFilter = isViewer && !canEdit ? user?.uid : undefined;

        const unsubscribe = getPopulatedOperations(
            accountId,
            (data) => {
                setOperations(data);
                setLoading(false);
            },
            (error) => {
                console.error(error);
                setLoading(false);
            },
            userIdToFilter
        );

        return () => unsubscribe();
    }, [accountId, authLoading, canAccess, canEdit, isViewer, user]);

  if (isLoading) {
    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Ordens de Operação</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie as operações de entrega, retirada e movimentação.
                    </p>
                </div>
            </div>
            <OperationCardSkeleton />
        </div>
    );
  }
  
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
                <h1 className="text-3xl font-headline font-bold">Ordens de Operação</h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie as operações de entrega, retirada e movimentação.
                </p>
            </div>
        </div>
        
        {isLoading ? (
            <OperationCardSkeleton />
        ) : operations.length > 0 ? (
            <div className="space-y-4">
                {operations.map(op => {
                    const status = getOperationStatus(op);
                    const totalCost = op.totalCost ?? 0;
                    const profit = (op.value || 0) - totalCost;

                    return (
                        <Accordion type="single" collapsible className="w-full" key={op.id}>
                            <AccordionItem value={op.id} className="border rounded-lg shadow-sm overflow-hidden bg-card relative">
                                <span className="absolute top-2 left-3 text-xs font-mono font-bold text-muted-foreground/80">
                                    OP{op.sequentialId}
                                </span>
                                <CardHeader className="pb-4">
                                    <div className="pt-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <CardTitle className="text-lg">{op.operationTypeName || op.type}</CardTitle>
                                            <Badge variant={status.variant}>
                                                {status.text}
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-sm mt-4">
                                            <div className="flex flex-col md:flex-row justify-between items-start gap-y-2 gap-x-4">
                                                <div className="space-y-1.5">
                                                     <div className="flex items-center gap-1.5">
                                                        <Building className="h-4 w-4"/> {op.client?.name}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="h-4 w-4"/> {op.driver?.name}
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5 text-left md:text-right">
                                                    {op.truck && (
                                                        <div className="flex items-center gap-1.5">
                                                            <Truck className="h-4 w-4" />
                                                            <span>{op.truck.name} ({op.truck.plate})</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-4 w-4"/>
                                                        {formatDateRange(op.startDate, op.endDate)}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                </AccordionTrigger>
                                <AccordionContent className="p-4">
                                   <div className="space-y-4 text-sm">
                                        <Separator />
                                         <div className="mt-3 space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                                                 <span className="text-xs font-semibold uppercase text-muted-foreground">Destino:</span>
                                                 <span>{op.destinationAddress}</span>
                                            </div>
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="start-address" className="border-none">
                                                    <AccordionTrigger className="text-xs text-primary hover:no-underline p-0 justify-start [&>svg]:ml-1 data-[state=closed]:text-muted-foreground">
                                                        <span className="font-normal">Mostrar endereço de partida</span>
                                                    </AccordionTrigger>
                                                    <AccordionContent className="pt-2">
                                                            <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold uppercase text-muted-foreground">Saída:</span>
                                                            <span>{op.startAddress}</span>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </div>
                                        
                                        {op.observations && (
                                             <div className="flex items-start gap-3">
                                                <FileText className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                                <p className="whitespace-pre-wrap">{op.observations}</p>
                                            </div>
                                        )}
                                        <Separator />

                                        {canSeeFinance && (
                                            <>
                                                <div className="flex items-center gap-2 pt-2">
                                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">Valor do Serviço:</span>
                                                    <span className="font-bold">{formatCurrency(op.value)}</span>
                                                </div>

                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm gap-2 sm:gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <TrendingDown className="h-4 w-4 text-destructive" />
                                                        <span className="font-medium">Custo Total:</span>
                                                        <span className="font-bold text-destructive">{formatCurrency(totalCost)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {profit >= 0 ? 
                                                            <TrendingUp className="h-4 w-4 text-green-600" /> : 
                                                            <TrendingDown className="h-4 w-4 text-red-600" />
                                                        }
                                                        <span className="font-medium">Lucro:</span>
                                                        <span className={cn(
                                                            "font-bold",
                                                            profit >= 0 ? "text-green-600" : "text-red-600"
                                                        )}>
                                                            {formatCurrency(profit)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        
                                        {op.client?.phone && (
                                            <div className="pt-2 flex justify-start">
                                                <a 
                                                    href={`https://wa.me/${formatPhoneNumberForWhatsApp(op.client.phone)}`}
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-green-600 hover:underline"
                                                >
                                                    <WhatsAppIcon className="h-4 w-4 fill-current" />
                                                    <span className="font-medium">{op.client.phone}</span>
                                                    <span className="text-xs text-muted-foreground ml-1">(Contatar Cliente)</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4">
                                        <OperationCardActions operation={op} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )
                })}
            </div>
        ) : (
             <Card>
                <CardHeader>
                    <CardTitle>Operações em Andamento</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">Nenhuma operação em andamento.</p>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
