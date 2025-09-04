

'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useAuth } from '@/context/auth-context';
import type { CompletedRental, HistoricItem, PopulatedOperation, Attachment } from '@/lib/types';
import { getCompletedRentals, getCompletedOperations } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Truck, TrendingUp, ShieldAlert, FileText, CalendarDays, MapPin, User, Workflow, Paperclip, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RevenueByClientChart } from './revenue-by-client-chart';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import { addAttachmentToCompletedOperationAction, addAttachmentToCompletedRentalAction, deleteAttachmentFromCompletedItemAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';


function formatCurrency(value: number | undefined | null) {
    if (value === undefined || value === null) {
        return "R$ 0,00";
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string, icon: React.ElementType, loading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-3/4" />
                ) : (
                    <div className="text-2xl font-bold">{value}</div>
                )}
            </CardContent>
        </Card>
    )
}

function HistoricItemDetailsDialog({ item, isOpen, onOpenChange, onAttachmentUploaded, onAttachmentDeleted }: { 
    item: HistoricItem | null, 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    onAttachmentUploaded: (itemId: string, newAttachment: Attachment) => void 
    onAttachmentDeleted: (itemId: string, attachment: Attachment) => void;
}) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [isDeleting, startDeleteTransition] = useTransition();
    
    if (!item) return null;

    const isRental = item.kind === 'rental';
    const rental = isRental ? (item.data as CompletedRental) : null;
    const operation = !isRental ? (item.data as PopulatedOperation) : null;
    const operationTitle = operation?.operationTypes?.map(t => t.name).join(', ') || 'Operação';
    
    const handleAttachmentAdded = async (newAttachment: Attachment) => {
        if (!accountId) return;
        
        let result;
        if(isRental) {
            result = await addAttachmentToCompletedRentalAction(accountId, item.id, newAttachment);
        } else {
            result = await addAttachmentToCompletedOperationAction(accountId, item.id, newAttachment);
        }

        if (result.message === 'success') {
            onAttachmentUploaded(item.id, newAttachment);
        }
    }

    const handleDeleteAttachment = (attachment: Attachment) => {
        if (!accountId) return;

        startDeleteTransition(async () => {
            const result = await deleteAttachmentFromCompletedItemAction(accountId, item.id, item.kind, attachment);
            if (result.message === 'success') {
                toast({ title: 'Sucesso', description: 'Anexo removido.' });
                onAttachmentDeleted(item.id, attachment);
            } else {
                toast({ title: 'Erro', description: result.error, variant: 'destructive' });
            }
        });
    }


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Detalhes da OS #{item.prefix}{item.sequentialId}</DialogTitle>
                    <DialogDescription>Finalizada em {format(parseISO(item.completedDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 px-4 max-h-[70vh] overflow-y-auto">
                     {item.kind === 'operation' && (
                        <div className="flex items-start gap-3">
                           <Workflow className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                           <div className="flex flex-col">
                               <span className="text-sm text-muted-foreground">Tipo de Serviço</span>
                               <span className="font-medium">{operationTitle}</span>
                           </div>
                       </div>
                     )}
                     <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Cliente</span>
                            <span className="font-medium">{item.clientName}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Responsável</span>
                            <span className="font-medium">{isRental ? rental?.assignedToUser?.name : operation?.driver?.name ?? 'N/A'}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <Truck className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">{isRental ? "Caçamba" : "Caminhão"}</span>
                            <span className="font-medium">{isRental ? `${rental?.dumpster?.name} (${rental?.dumpster?.size}m³)` : `${operation?.truck?.name} (${operation?.truck?.plate})`}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">{isRental ? "Endereço de Entrega" : "Destino"}</span>
                            <span className="font-medium">{isRental ? rental?.deliveryAddress : operation?.destinationAddress}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CalendarDays className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Período</span>
                            <span className="font-medium">
                                {isRental 
                                    ? `${format(parseISO(rental!.rentalDate), 'dd/MM/yy')} - ${format(parseISO(rental!.returnDate), 'dd/MM/yy')} (${rental!.rentalDays} dias)`
                                    : `${format(parseISO(operation!.startDate), 'dd/MM/yy HH:mm')} - ${format(parseISO(operation!.endDate), 'dd/MM/yy HH:mm')}`
                                }
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Valor Total</span>
                            <span className="font-medium">{formatCurrency(item.totalValue)}</span>
                        </div>
                    </div>
                    {item.data.observations && (
                         <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">Observações</span>
                                <p className="font-medium whitespace-pre-wrap">{item.data.observations}</p>
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Anexos</span>
                            {accountId && (
                                <AttachmentsUploader 
                                    accountId={accountId} 
                                    onAttachmentUploaded={handleAttachmentAdded}
                                    uploadPath={`accounts/${accountId}/${isRental ? 'completed_rentals' : 'completed_operations'}/${item.id}/attachments`}
                                />
                            )}
                        </div>
                         {item.data.attachments && item.data.attachments.length > 0 ? (
                            <div className="flex w-full overflow-x-auto gap-2 pt-2 pb-2">
                                {item.data.attachments.map((att, index) => (
                                     <div key={index} className="relative group shrink-0">
                                        <a
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="relative group shrink-0 h-16 w-16 bg-muted/50 border rounded-md p-2 flex flex-col items-center justify-center text-center hover:bg-muted"
                                        >
                                            <Paperclip className="h-6 w-6 text-muted-foreground" />
                                            <span className="text-xs break-all line-clamp-2 mt-1">{att.name}</span>
                                        </a>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10">
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir Anexo?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação não pode ser desfeita. O arquivo "{att.name}" será removido permanentemente.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteAttachment(att)} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                                        {isDeleting ? <Spinner size="small" /> : 'Excluir'}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum anexo adicionado.</p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function FinancePage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [historicItems, setHistoricItems] = useState<HistoricItem[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedItem, setSelectedItem] = useState<HistoricItem | null>(null);

    const canAccess = isSuperAdmin || userAccount?.permissions?.canAccessFinance;

    useEffect(() => {
        if (authLoading || !accountId || !canAccess) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const [rentals, operations] = await Promise.all([
                getCompletedRentals(accountId!),
                getCompletedOperations(accountId!)
            ]);
            
            const combinedItems: HistoricItem[] = [
                ...rentals.map(r => ({
                    id: r.id,
                    kind: 'rental' as const,
                    prefix: 'AL',
                    clientName: r.client?.name ?? 'N/A',
                    completedDate: r.completedDate,
                    totalValue: r.totalValue,
                    sequentialId: r.sequentialId,
                    data: r,
                })),
                ...operations.map(o => ({
                    id: o.id,
                    kind: 'operation' as const,
                    prefix: 'OP',
                    clientName: o.client?.name ?? 'N/A',
                    completedDate: o.completedAt,
                    totalValue: o.value ?? 0,
                    sequentialId: o.sequentialId,
                    operationTypes: o.operationTypes,
                    data: o,
                }))
            ];
            
            combinedItems.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
            
            setHistoricItems(combinedItems);
            setLoadingData(false);
        }
        
        fetchData();

    }, [accountId, authLoading, canAccess]);

    const handleAttachmentUploaded = (itemId: string, newAttachment: Attachment) => {
        setHistoricItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const updatedAttachments = [...(item.data.attachments || []), newAttachment];
                const updatedItem = { ...item, data: { ...item, data: { ...item.data, attachments: updatedAttachments } }};
                if (selectedItem?.id === itemId) {
                    setSelectedItem(updatedItem);
                }
                return updatedItem;
            }
            return item;
        }));
    };
    
    const handleAttachmentDeleted = (itemId: string, attachmentToDelete: Attachment) => {
        setHistoricItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const updatedAttachments = (item.data.attachments || []).filter(
                    (att: Attachment) => att.url !== attachmentToDelete.url
                );
                 const updatedItem = { ...item, data: { ...item.data, attachments: updatedAttachments } };
                 if (selectedItem?.id === itemId) {
                    setSelectedItem(updatedItem);
                }
                return updatedItem;
            }
            return item;
        }));
    };
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRevenue = historicItems
        .filter(item => {
            const completedDate = parseISO(item.completedDate);
            return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
        })
        .reduce((acc, item) => acc + (item.totalValue || 0), 0);

    const yearlyRevenue = historicItems
        .filter(item => {
             const completedDate = parseISO(item.completedDate);
             return completedDate.getFullYear() === currentYear;
        })
        .reduce((acc, item) => acc + (item.totalValue || 0), 0);
    
    const monthlyCompletions = historicItems
        .filter(item => {
             const completedDate = parseISO(item.completedDate);
             return completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear;
        }).length;

    const revenueByClientData = historicItems.reduce((acc, item) => {
        if (!item.clientName) return acc;
        const clientName = item.clientName;
        const value = item.totalValue || 0;

        if (!acc[clientName]) {
            acc[clientName] = 0;
        }
        acc[clientName] += value;

        return acc;
    }, {} as Record<string, number>);

    const clientChartData = Object.entries(revenueByClientData).map(([name, value]) => ({
        name,
        value,
    })).sort((a,b) => b.value - a.value);


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
            <div className="mb-8">
                 <h1 className="text-3xl font-headline font-bold">Histórico e Estatísticas</h1>
                 <p className="text-muted-foreground mt-1">Visualize o desempenho e o histórico financeiro do seu negócio.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                 <StatCard title="Receita (Mês)" value={formatCurrency(monthlyRevenue)} icon={DollarSign} loading={isLoading} />
                 <StatCard title="Receita (Ano)" value={formatCurrency(yearlyRevenue)} icon={TrendingUp} loading={isLoading} />
                 <StatCard title="Serviços Finalizados (Mês)" value={String(monthlyCompletions)} icon={Truck} loading={isLoading} />
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="font-headline">Faturamento por Cliente</CardTitle>
                        <CardDescription>Receita gerada por cada cliente no período total.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={clientChartData} />}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="font-headline">Histórico de Serviços</CardTitle>
                        <CardDescription>Lista de todos os serviços finalizados. Clique para ver detalhes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-40 w-full" /> : (
                            <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>OS</TableHead>
                                        <TableHead className="w-[20px] p-2 text-center">
                                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                                            <span className="sr-only">Anexos</span>
                                        </TableHead>
                                        <TableHead>Tipo de Serviço</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Finalizado em</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historicItems.length > 0 ? historicItems.map(item => (
                                        <TableRow key={item.id} onClick={() => setSelectedItem(item)} className="cursor-pointer">
                                            <TableCell className="font-mono text-xs font-bold">{item.prefix}{item.sequentialId}</TableCell>
                                            <TableCell className="w-[20px] p-2 text-center">
                                                {item.data.attachments && item.data.attachments.length > 0 && (
                                                    <Paperclip className="h-4 w-4 mx-auto text-muted-foreground" />
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium capitalize">
                                                {item.kind === 'rental' ? 'Aluguel' : (item.operationTypes?.map(t => t.name).join(', ') || 'Operação')}
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">{item.clientName}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{format(parseISO(item.completedDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(item.totalValue)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24">Nenhum serviço finalizado ainda.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
             </div>
             <HistoricItemDetailsDialog 
                item={selectedItem} 
                isOpen={!!selectedItem} 
                onOpenChange={(open) => !open && setSelectedItem(null)}
                onAttachmentUploaded={handleAttachmentUploaded}
                onAttachmentDeleted={handleAttachmentDeleted}
             />
        </div>
    );
}
