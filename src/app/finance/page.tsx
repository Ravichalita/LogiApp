
'use client';

import React, { useEffect, useState, useTransition, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import type { CompletedRental, HistoricItem, PopulatedOperation, Attachment, PopulatedRental, UserAccount } from '@/lib/types';
import { getCompletedRentals, getCompletedOperations, getCityFromAddressAction, getNeighborhoodFromAddressAction } from '@/lib/data-server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Truck, TrendingUp, ShieldAlert, FileText, CalendarDays, MapPin, User, Workflow, Paperclip, X, Download, BarChart, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react';
import { format, parseISO, getYear, getMonth } from 'date-fns';
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
import { addAttachmentToOperationAction, addAttachmentToRentalAction, deleteAttachmentAction } from '@/lib/actions';
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
import { fetchTeamMembers } from '@/lib/data';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MonthlyRevenueChart } from './monthly-revenue-chart';
import { cn } from '@/lib/utils';


function formatCurrency(value: number | undefined | null) {
    if (value === undefined || value === null) {
        return "R$ 0,00";
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
}

function StatCard({ title, value, icon: Icon, loading, description }: { title: string, value: string, icon: React.ElementType, loading: boolean, description?: React.ReactNode }) {
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
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function HistoricItemDetailsDialog({ item, isOpen, onOpenChange, onAttachmentUploaded, onAttachmentDeleted, owner }: { 
    item: HistoricItem | null, 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    onAttachmentUploaded: (itemId: string, newAttachment: Attachment) => void 
    onAttachmentDeleted: (itemId: string, attachment: Attachment) => void;
    owner?: UserAccount | null;
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
    
        const pdfContainerId = `pdf-${isRental ? 'al' : 'op'}-${item.id}`;
        const pdfContainer = document.getElementById(pdfContainerId);

        if (!pdfContainer) {
            console.error("PDF container not found", pdfContainerId);
            setIsGeneratingPdf(false);
            toast({ title: "Erro", description: "Não foi possível encontrar o container para gerar o PDF.", variant: "destructive" });
            return;
        }
    
        try {
            const canvas = await html2canvas(pdfContainer, { useCORS: true, scale: 2 });
             if (canvas.width === 0 || canvas.height === 0) {
              throw new Error('Canvas gerado está vazio. Verifique se o conteúdo do PDF está visível.');
            }
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
            {/* Hidden div for PDF rendering */}
            <div style={{ position: 'fixed', left: '-220mm', top: 0, zIndex: -1 }}>
                 <OsPdfDocument item={itemForPdf} owner={owner} />
            </div>

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
                            <span className="text-sm text-muted-foreground">{isRental ? "Caçamba(s)" : "Caminhão"}</span>
                            <span className="font-medium">{isRental ? (rental?.dumpsters || []).map(d => `${d.name} (${d.size}m³)`).join(', ') : `${operation?.truck?.name} (${operation?.truck?.plate})`}</span>
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

const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function FinancePage() {
    const { accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [allHistoricItems, setAllHistoricItems] = useState<HistoricItem[]>([]);
    const [team, setTeam] = useState<UserAccount[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedItem, setSelectedItem] = useState<HistoricItem | null>(null);
    const [cityRevenue, setCityRevenue] = useState<Record<string, number>>({});
    const [neighborhoodRevenue, setNeighborhoodRevenue] = useState<Record<string, number>>({});
    const cityCache = useMemo(() => new Map<string, string>(), []);
    const neighborhoodCache = useMemo(() => new Map<string, string>(), []);
    
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth());
    const [showYearlyChart, setShowYearlyChart] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());


    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => currentYear - i);
    }, []);
    
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
            try {
                const [rentals, operations, teamData] = await Promise.all([
                    canAccessRentals ? getCompletedRentals(accountId!) : Promise.resolve([]),
                    canAccessOperations ? getCompletedOperations(accountId!) : Promise.resolve([]),
                    fetchTeamMembers(accountId!),
                ]);
                setTeam(teamData);
                
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
            } catch (error) {
                console.error("Failed to fetch finance data:", error);
            } finally {
                setLoadingData(false);
            }
        }
        
        fetchData();

    }, [accountId, authLoading, canAccessFinance, canAccessRentals, canAccessOperations]);

    const filteredItems = useMemo(() => {
        let items = allHistoricItems;
        if (activeTab !== 'all') {
            items = items.filter(item => item.kind === (activeTab === 'rentals' ? 'rental' : 'operation'));
        }

        return items.filter(item => {
            const completedDate = parseISO(item.completedDate);
            const yearMatch = getYear(completedDate) === selectedYear;
            const monthMatch = selectedMonth === 'all' || getMonth(completedDate) === selectedMonth;
            return yearMatch && monthMatch;
        });
    }, [allHistoricItems, activeTab, selectedYear, selectedMonth]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, HistoricItem[]> = {};
        const standalone: HistoricItem[] = [];

        filteredItems.forEach(item => {
            const data = item.data as any;
            const isMonthly = data.billingType === 'monthly';
            const parentId = item.kind === 'rental' ? data.parentRentalId : data.parentOperationId;

            if (isMonthly && parentId) {
                if (!groups[parentId]) {
                    groups[parentId] = [];
                }
                groups[parentId].push(item);
            } else {
                standalone.push(item);
            }
        });

        const result: (
            | { type: 'item'; item: HistoricItem }
            | { type: 'group'; id: string; items: HistoricItem[]; mainItem: HistoricItem; totalValue: number; completedDate: string }
        )[] = [];

        standalone.forEach(item => result.push({ type: 'item', item }));

        Object.entries(groups).forEach(([parentId, groupItems]) => {
             const totalValue = groupItems.reduce((sum, i) => sum + (i.totalValue || 0), 0);
             groupItems.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime());
             const latestItem = groupItems[0];

             result.push({
                 type: 'group',
                 id: parentId,
                 items: groupItems,
                 mainItem: latestItem,
                 totalValue,
                 completedDate: latestItem.completedDate
             });
        });

        return result.sort((a, b) => {
            const dateA = a.type === 'item' ? a.item.completedDate : a.completedDate;
            const dateB = b.type === 'item' ? b.item.completedDate : b.completedDate;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

    }, [filteredItems]);

    const toggleGroup = (groupId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

     useEffect(() => {
        if (filteredItems.length > 0) {
            const processAddresses = async () => {
                const revenueByCity: Record<string, number> = {};
                const revenueByNeighborhood: Record<string, number> = {};

                for (const item of filteredItems) {
                    const address = item.kind === 'rental'
                        ? (item.data as CompletedRental).deliveryAddress
                        : (item.data as PopulatedOperation).destinationAddress;
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
        } else {
             setCityRevenue({});
             setNeighborhoodRevenue({});
        }
    }, [filteredItems, cityCache, neighborhoodCache]);

    const owner = useMemo(() => team.find(m => m.role === 'owner'), [team]);

    const handleAttachmentUploaded = async (itemId: string, newAttachment: Attachment) => {
        if (!accountId) return;
        const item = allHistoricItems.find(i => i.id === itemId);
        if (!item) return;

        let result;
        if (item.kind === 'rental') {
            result = await addAttachmentToRentalAction(accountId, itemId, newAttachment, 'completed_rentals');
        } else {
            result = await addAttachmentToOperationAction(accountId, itemId, newAttachment, 'completed_operations');
        }

        if (result.message === 'success') {
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
            toast({ title: 'Sucesso!', description: 'Anexo adicionado.' });
        } else {
             toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    };
    
     const handleAttachmentDeleted = async (itemId: string, attachmentToDelete: Attachment) => {
        if (!accountId) return;
        const item = allHistoricItems.find(i => i.id === itemId);
        if (!item) return;

        const collectionName = item.kind === 'rental' ? 'completed_rentals' : 'completed_operations';
        const result = await deleteAttachmentAction(accountId, itemId, collectionName, attachmentToDelete);

        if (result.message === 'success') {
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
             toast({ title: 'Sucesso!', description: 'Anexo removido.' });
        } else {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    };
    
    const periodRevenue = filteredItems.reduce((acc, item) => acc + (item.totalValue || 0), 0);
    const periodCompletions = filteredItems.length;
    
    const yearlyRevenue = allHistoricItems
        .filter(item => getYear(parseISO(item.completedDate)) === selectedYear)
        .reduce((acc, item) => acc + (item.totalValue || 0), 0);
    
    const previousMonthRevenue = useMemo(() => {
        if (selectedMonth === 'all') return 0;
        
        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
        const prevMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;

        return allHistoricItems
            .filter(item => {
                const d = parseISO(item.completedDate);
                return getMonth(d) === prevMonth && getYear(d) === prevMonthYear;
            })
            .reduce((acc, item) => acc + (item.totalValue || 0), 0);
    }, [allHistoricItems, selectedMonth, selectedYear]);

    const monthlyRevenueDescription = useMemo(() => {
        if (selectedMonth === 'all' || previousMonthRevenue === 0) {
            return null;
        }

        const percentageChange = ((periodRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
        const isPositive = percentageChange >= 0;
        const Icon = isPositive ? ArrowUp : ArrowDown;
        
        return (
            <span className={cn("flex items-center", isPositive ? 'text-green-600' : 'text-destructive')}>
                <Icon className="h-3 w-3 mr-1" />
                {isPositive && '+'}{percentageChange.toFixed(1).replace('.',',')}% em relação ao mês anterior
            </span>
        );
    }, [periodRevenue, previousMonthRevenue, selectedMonth]);
    
    const previousYearRevenue = useMemo(() => {
        const prevYear = selectedYear - 1;
        return allHistoricItems
            .filter(item => getYear(parseISO(item.completedDate)) === prevYear)
            .reduce((acc, item) => acc + (item.totalValue || 0), 0);
    }, [allHistoricItems, selectedYear]);

    const yearlyRevenueDescription = useMemo(() => {
        if (previousYearRevenue === 0) {
            return null;
        }
        const percentageChange = ((yearlyRevenue - previousYearRevenue) / previousYearRevenue) * 100;
        const isPositive = percentageChange >= 0;
        const Icon = isPositive ? ArrowUp : ArrowDown;
        
        return (
            <span className={cn("flex items-center", isPositive ? 'text-green-600' : 'text-destructive')}>
                <Icon className="h-3 w-3 mr-1" />
                {isPositive && '+'}{percentageChange.toFixed(1).replace('.',',')}% em relação ao ano anterior
            </span>
        );
    }, [yearlyRevenue, previousYearRevenue]);

    const cityChartData = Object.entries(cityRevenue).map(([name, value]) => ({
        name,
        value,
    })).sort((a, b) => b.value - a.value);
    
    const neighborhoodChartData = Object.entries(neighborhoodRevenue).map(([name, value]) => ({
        name,
        value,
    })).sort((a, b) => b.value - a.value);
    
    const serviceTypeChartData = useMemo(() => {
        const revenueByServiceType = filteredItems.reduce((acc, item) => {
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
    }, [filteredItems]);

     const monthlyChartData = useMemo(() => {
        const yearlyData = allHistoricItems.filter(item => getYear(parseISO(item.completedDate)) === selectedYear);
        const monthlyTotals = Array(12).fill(0).map((_, i) => ({
            name: months[i].substring(0, 3),
            total: 0,
        }));
        yearlyData.forEach(item => {
            const monthIndex = getMonth(parseISO(item.completedDate));
            monthlyTotals[monthIndex].total += item.totalValue || 0;
        });
        return monthlyTotals;
    }, [allHistoricItems, selectedYear]);


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
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Selecione o Ano" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => (
                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(val === 'all' ? 'all' : Number(val))}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Selecione o Mês" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Ano Inteiro</SelectItem>
                        {months.map((month, index) => (
                             <SelectItem key={index} value={String(index)}>{month}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={() => setShowYearlyChart(prev => !prev)} variant="outline" className="w-full md:w-auto">
                    <BarChart className="mr-2 h-4 w-4" />
                    {showYearlyChart ? 'Ocultar Gráfico Anual' : `Ver Gráfico de ${selectedYear}`}
                </Button>
            </div>

            {showYearlyChart && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="font-headline">Faturamento Mensal de {selectedYear}</CardTitle>
                        <CardDescription>Receita total gerada em cada mês do ano selecionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-[300px] w-full" /> : <MonthlyRevenueChart data={monthlyChartData} />}
                    </CardContent>
                </Card>
            )}

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
                 <StatCard 
                    title={`Receita (${selectedMonth === 'all' ? selectedYear : `${months[selectedMonth]}/${selectedYear}`})`} 
                    value={formatCurrency(periodRevenue)} 
                    icon={DollarSign} 
                    loading={isLoading}
                    description={monthlyRevenueDescription}
                />
                 <StatCard 
                    title={`Receita (Ano de ${selectedYear})`} 
                    value={formatCurrency(yearlyRevenue)} 
                    icon={TrendingUp} 
                    loading={isLoading}
                    description={yearlyRevenueDescription}
                />
                 <StatCard title={`Serviços Finalizados (${selectedMonth === 'all' ? selectedYear : months[selectedMonth]})`} value={String(periodCompletions)} icon={Truck} loading={isLoading} />
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <Carousel>
                        <CarouselContent>
                             <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Tipo de Serviço</CardTitle>
                                    <CardDescription>Receita gerada por cada tipo de serviço no período.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={serviceTypeChartData} />}
                                </CardContent>
                            </CarouselItem>
                             <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Cidade</CardTitle>
                                    <CardDescription>Receita gerada em cada cidade no período selecionado.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={cityChartData} />}
                                </CardContent>
                            </CarouselItem>
                            <CarouselItem>
                                 <CardHeader>
                                    <CardTitle className="font-headline">Faturamento por Bairro</CardTitle>
                                    <CardDescription>Receita gerada em cada bairro no período selecionado.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? <Skeleton className="h-[300px] w-full" /> : <RevenueByClientChart data={neighborhoodChartData} />}
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
                        <CardDescription>Lista de todos os serviços finalizados no período. Clique para ver detalhes.</CardDescription>
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
                                    {groupedItems.length > 0 ? groupedItems.map((rowItem) => {
                                        if (rowItem.type === 'item') {
                                            const item = rowItem.item;
                                            return (
                                                <TableRow key={item.id} onClick={() => setSelectedItem(item)} className="cursor-pointer hover:bg-muted/50">
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
                                            );
                                        } else {
                                            const group = rowItem;
                                            const isExpanded = expandedGroups.has(group.id);
                                            return (
                                                <React.Fragment key={group.id}>
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-muted/50 bg-muted/20"
                                                        onClick={(e) => toggleGroup(group.id, e)}
                                                    >
                                                         <TableCell className="font-mono text-xs font-bold">
                                                             <div className="flex items-center gap-2">
                                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                <span>{group.items.length} Serviços</span>
                                                             </div>
                                                         </TableCell>
                                                         <TableCell className="w-[20px] p-2 text-center">
                                                         </TableCell>
                                                         <TableCell className="font-medium capitalize">
                                                            {group.mainItem.kind === 'rental' ? 'Aluguel (Mensal)' : 'Operação (Mensal)'}
                                                         </TableCell>
                                                         <TableCell className="font-medium whitespace-nowrap">{group.mainItem.clientName}</TableCell>
                                                         <TableCell className="text-right whitespace-nowrap">{format(parseISO(group.completedDate), 'MM/yyyy', { locale: ptBR })}</TableCell>
                                                         <TableCell className="text-right whitespace-nowrap font-bold">{formatCurrency(group.totalValue)}</TableCell>
                                                    </TableRow>
                                                    {isExpanded && group.items.map(item => (
                                                        <TableRow key={item.id} onClick={() => setSelectedItem(item)} className="cursor-pointer hover:bg-muted/50 bg-muted/5">
                                                             <TableCell className="font-mono text-xs font-bold pl-8">
                                                                <div className="flex items-center gap-2">
                                                                     {item.prefix}{item.sequentialId}
                                                                </div>
                                                             </TableCell>
                                                             <TableCell className="w-[20px] p-2 text-center">
                                                                {item.data.attachments && item.data.attachments.length > 0 && (
                                                                    <Paperclip className="h-4 w-4 mx-auto text-muted-foreground" />
                                                                )}
                                                             </TableCell>
                                                             <TableCell className="font-medium capitalize text-muted-foreground">
                                                                {item.kind === 'rental' ? 'Aluguel' : (item.operationTypes?.map(t => t.name).join(', ') || 'Operação')}
                                                             </TableCell>
                                                             <TableCell className="font-medium whitespace-nowrap text-muted-foreground">{item.clientName}</TableCell>
                                                             <TableCell className="text-right whitespace-nowrap text-muted-foreground">{format(parseISO(item.completedDate), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                                                             <TableCell className="text-right whitespace-nowrap text-muted-foreground">{formatCurrency(item.totalValue)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </React.Fragment>
                                            )
                                        }
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24">Nenhum serviço finalizado no período selecionado.</TableCell>
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
                owner={owner}
             />
        </div>
    );
}
