
'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import type { CompletedRental, HistoricItem, PopulatedOperation, Attachment, PopulatedRental } from '@/lib/types';
import { getCompletedRentals, getCompletedOperations, getCityFromAddressAction, getNeighborhoodFromAddressAction } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Truck, TrendingUp, ShieldAlert, FileText, CalendarDays, MapPin, User, Workflow, Paperclip, X, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RevenueByClientChart } from './revenue-by-client-chart';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AttachmentsUploader } from '@/components/attachments-uploader';
import { addAttachmentToCompletedOperationAction, addAttachmentToCompletedRentalAction, deleteAttachmentFromCompletedItemAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { OsPdfDocument } from '@/components/os-pdf-document';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"


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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    if (!item) return null;

    const isRental = item.kind === 'rental';
    const rental = isRental ? (item.data as CompletedRental) : null;
    const operation = !isRental ? (item.data as PopulatedOperation) : null;
    const operationTitle = operation?.operationTypes?.map(t => t.name).join(', ') || 'Operação';
    
    const handleAttachmentAdded = (newAttachment: Attachment) => {
        onAttachmentUploaded(item.id, newAttachment);
    };

    const handleAttachmentDeleted = (attachment: Attachment) => {
        onAttachmentDeleted(item.id, attachment);
    }
    
    const handleGenerateAndDownloadPdf = async () => {
        setIsGeneratingPdf(true);
        toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });
    
        const pdfContainer = document.getElementById(`pdf-${item.id}`);
        if (!pdfContainer) {
            console.error("PDF container not found");
            setIsGeneratingPdf(false);
            toast({ title: "Erro", description: "Não foi possível encontrar o container para gerar o PDF.", variant: "destructive" });
            return;
        }
    
        try {
            const canvas = await html2canvas(pdfContainer, { scale: 2 });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const osId = `${item.prefix}${item.sequentialId}`;
            pdf.save(`OS_${osId}_${item.clientName}.pdf`);
    
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Erro ao gerar PDF", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const itemForPdf = {
        ...item.data,
        itemType: item.kind,
    } as PopulatedRental | PopulatedOperation;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                 <div style={{ position: 'fixed', left: '-2000px', top: 0, zIndex: -1 }}>
                    <div id={`pdf-${item.id}`} style={{ width: '210mm', height: '297mm', backgroundColor: 'white' }}>
                        <OsPdfDocument item={itemForPdf} />
                    </div>
                </div>
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
                        {accountId && (
                            <AttachmentsUploader 
                                accountId={accountId}
                                attachments={item.data.attachments || []}
                                onAttachmentUploaded={handleAttachmentAdded}
                                onAttachmentDeleted={handleAttachmentDeleted}
                                uploadPath={`accounts/${accountId}/${isRental ? 'completed_rentals' : 'completed_operations'}/${item.id}/attachments`}
                            />
                        )}
                    </div>
                </div>
                 <DialogFooter>
                    <Button onClick={handleGenerateAndDownloadPdf} disabled={isGeneratingPdf}>
                        {isGeneratingPdf ? <Spinner size="small" /> : <Download className="mr-2 h-4 w-4" />}
                        Baixar PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function FinancePage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [allHistoricItems, setAllHistoricItems] = useState<HistoricItem[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedItem, setSelectedItem] = useState<HistoricItem | null>(null);
    const [cityRevenue, setCityRevenue] = useState<Record<string, number>>({});
    const [neighborhoodRevenue, setNeighborhoodRevenue] = useState<Record<string, number>>({});
    const cityCache = useMemo(() => new Map<string, string>(), []);
    const neighborhoodCache = useMemo(() => new Map<string, string>(), []);
    
    const permissions = userAccount?.permissions;
    const canAccessFinance = isSuperAdmin || permissions?.canAccessFinance;
    const canAccessRentals = isSuperAdmin || permissions?.canAccessRentals;
    const canAccessOperations = isSuperAdmin || permissions?.canAccessOperations;

    const getDefaultTab = () => {
        if (canAccessRentals && canAccessOperations) return 'all';
        if (canAccessRentals) return 'rentals';
        if (canAccessOperations) return 'operations';
        return 'all';
    }

    const [activeTab, setActiveTab] = useState<'all' | 'rentals' | 'operations'>(getDefaultTab());
    
    useEffect(() => {
      setActiveTab(getDefaultTab());
    }, [canAccessRentals, canAccessOperations]);


    useEffect(() => {
        if (authLoading || !accountId || !canAccessFinance) {
            if (!authLoading) setLoadingData(false);
            return;
        };

        async function fetchData() {
            setLoadingData(true);
            const [rentals, operations] = await Promise.all([
                canAccessRentals ? getCompletedRentals(accountId!) : Promise.resolve([]),
                canAccessOperations ? getCompletedOperations(accountId!) : Promise.resolve([])
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
            
            setAllHistoricItems(combinedItems);
            setLoadingData(false);
        }
        
        fetchData();

    }, [accountId, authLoading, canAccessFinance, canAccessRentals, canAccessOperations]);

    const historicItems = useMemo(() => {
        if (activeTab === 'all') {
            return allHistoricItems;
        }
        return allHistoricItems.filter(item => item.kind === (activeTab === 'rentals' ? 'rental' : 'operation'));
    }, [allHistoricItems, activeTab]);

     useEffect(() => {
        if (historicItems.length > 0) {
            const processAddresses = async () => {
                const revenueByCity: Record<string, number> = {};
                const revenueByNeighborhood: Record<string, number> = {};

                for (const item of historicItems) {
                    const address = item.kind === 'rental' ? item.data.deliveryAddress : (item.data as PopulatedOperation).destinationAddress;
                    if (!address) continue;

                    let city = cityCache.get(address);
                    if (!city) {
                        city = await getCityFromAddressAction(address) || 'Não identificada';
                        cityCache.set(address, city);
                    }
                    
                    let neighborhood = neighborhoodCache.get(address);
                    if (!neighborhood) {
                        neighborhood = await getNeighborhoodFromAddressAction(address) || 'Não identificado';
                        neighborhoodCache.set(address, neighborhood);
                    }
                    
                    const value = item.totalValue || 0;
                    if (!revenueByCity[city]) {
                        revenueByCity[city] = 0;
                    }
                    revenueByCity[city] += value;

                    if (!revenueByNeighborhood[neighborhood]) {
                        revenueByNeighborhood[neighborhood] = 0;
                    }
                    revenueByNeighborhood[neighborhood] += value;
                }
                setCityRevenue(revenueByCity);
                setNeighborhoodRevenue(revenueByNeighborhood);
            };
            processAddresses();
        }
    }, [historicItems, cityCache, neighborhoodCache]);

    const handleAttachmentUploaded = (itemId: string, newAttachment: Attachment) => {
        setAllHistoricItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const updatedAttachments = [...(item.data.attachments || []), newAttachment];
                const updatedItem = { ...item, data: { ...item.data, attachments: updatedAttachments } };
                if (selectedItem?.id === itemId) {
                    setSelectedItem(updatedItem);
                }
                return updatedItem;
            }
            return item;
        }));
    };
    
     const handleAttachmentDeleted = (itemId: string, attachmentToDelete: Attachment) => {
        setAllHistoricItems(prevItems => prevItems.map(item => {
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

    const cityChartData = Object.entries(cityRevenue).map(([name, value]) => ({
        name,
        value,
    })).sort((a, b) => b.value - a.value);
    
    const neighborhoodChartData = Object.entries(neighborhoodRevenue).map(([name, value]) => ({
        name,
        value,
    })).sort((a, b) => b.value - a.value);
    
    const serviceTypeChartData = useMemo(() => {
        const revenueByServiceType = historicItems.reduce((acc, item) => {
            let serviceName = 'Serviço Indefinido';
            if (item.kind === 'rental') {
                serviceName = 'Aluguel';
            } else if (item.kind === 'operation' && item.operationTypes && item.operationTypes.length > 0) {
                serviceName = item.operationTypes.map(t => t.name).join(' / ');
            }
            
            const value = item.totalValue || 0;
            if (!acc[serviceName]) {
                acc[serviceName] = 0;
            }
            acc[serviceName] += value;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(revenueByServiceType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [historicItems]);


    const isLoading = authLoading || (loadingData && canAccessFinance);

    if (!isLoading && !canAccessFinance) {
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

    const showTabs = canAccessRentals && canAccessOperations;

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">
            <div className="mb-8">
                 <h1 className="text-3xl font-headline font-bold">Histórico e Estatísticas</h1>
                 <p className="text-muted-foreground mt-1">Visualize o desempenho e o histórico financeiro do seu negócio.</p>
            </div>

            {showTabs && (
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full mb-6">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="all">Todos</TabsTrigger>
                        <TabsTrigger value="rentals">Aluguéis</TabsTrigger>
                        <TabsTrigger value="operations">Operações</TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
                 <StatCard title="Receita (Mês)" value={formatCurrency(monthlyRevenue)} icon={DollarSign} loading={isLoading} />
                 <StatCard title="Receita (Ano)" value={formatCurrency(yearlyRevenue)} icon={TrendingUp} loading={isLoading} />
                 <StatCard title="Serviços Finalizados (Mês)" value={String(monthlyCompletions)} icon={Truck} loading={isLoading} />
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <Carousel>
                        <CarouselContent>
                             <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Cidade</CardTitle>
                                    <CardDescription>Receita gerada em cada cidade no período total.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={cityChartData} />}
                                </CardContent>
                            </CarouselItem>
                            <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Bairro</CardTitle>
                                    <CardDescription>Receita gerada em cada bairro no período total.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={neighborhoodChartData} />}
                                </CardContent>
                            </CarouselItem>
                            <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Tipo de Serviço</CardTitle>
                                    <CardDescription>Receita gerada por cada tipo de serviço.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={serviceTypeChartData} />}
                                </CardContent>
                            </CarouselItem>
                            <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Cliente</CardTitle>
                                    <CardDescription>Receita gerada por cada cliente no período total.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={clientChartData} />}
                                </CardContent>
                            </CarouselItem>
                        </CarouselContent>
                        <CarouselPrevious className="-left-4" />
                        <CarouselNext className="-right-4"/>
                    </Carousel>
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
