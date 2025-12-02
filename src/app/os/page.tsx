
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { getPopulatedRentals, getPopulatedOperations, fetchTeamMembers } from '@/lib/data';
import type { PopulatedRental, PopulatedOperation, UserAccount, OperationType, Attachment, Dumpster } from '@/lib/types';
import { format, isBefore, isAfter, isToday, parseISO, startOfToday, endOfDay, isWithinInterval, isSameDay } from 'date-fns';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Truck, Calendar, User, ShieldAlert, Search, Plus, Minus, ChevronDown, Hash, Home, Container, Workflow, Building, MapPin, FileText, DollarSign, TrendingDown, TrendingUp, Route, Clock, Sun, Cloudy, CloudRain, Snowflake, Map, Paperclip, Sparkles, MapPinned, ArrowRightLeft, MoreVertical, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditAssignedUserDialog } from '@/app/rentals/edit-assigned-user-dialog';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import { EditOperationAssignedUserDialog } from '@/app/operations/edit-assigned-user-dialog';
import { AttachmentsUploader } from '@/components/attachments-uploader';
import { addAttachmentToRentalAction, addAttachmentToOperationAction, deleteAttachmentAction, deleteRentalAction, finishRentalAction, deleteOperationAction, finishOperationAction, cancelRecurrenceAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DraggableActionCard } from '@/components/draggable-action-card';
import { Edit, Trash2, Download } from 'lucide-react';
import { OsPdfDocument } from '@/components/os-pdf-document';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Image from 'next/image';
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
import { RentalCardActions } from '../rentals/rental-card-actions';
import { ScheduleSwapDialog } from '../rentals/schedule-swap-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


type RentalStatus = 'Pendente' | 'Ativo' | 'Em Atraso' | 'Agendado' | 'Encerra hoje' | 'Trocar';
type OsTypeFilter = 'Todas' | 'Aluguel' | 'Operação';
type StatusFilter = 'Todas' | RentalStatus | 'Em Andamento' | 'Pendente' | 'Em Atraso';
type TitleViewMode = 'service' | 'client';


// --- Helper Functions ---
export function getRentalStatus(rental: PopulatedRental): { text: RentalStatus; variant: 'default' | 'destructive' | 'secondary' | 'success' | 'warning' | 'info', order: number } {
    const now = new Date();
    const rentalDate = parseISO(rental.rentalDate);
    const returnDate = parseISO(rental.returnDate);
    const swapDate = rental.swapDate ? parseISO(rental.swapDate) : null;

    if (swapDate && isToday(swapDate)) {
        return { text: 'Trocar', variant: 'destructive', order: 0 };
    }
    if (isAfter(now, returnDate)) {
        return { text: 'Em Atraso', variant: 'destructive', order: 1 };
    }
    if (isToday(returnDate)) {
        return { text: 'Encerra hoje', variant: 'warning', order: 2 };
    }
    if (isWithinInterval(now, { start: rentalDate, end: returnDate })) {
        return { text: 'Ativo', variant: 'success', order: 3 };
    }
    if (isBefore(now, rentalDate)) {
        return { text: 'Pendente', variant: 'info', order: 4 };
    }
    return { text: 'Agendado', variant: 'secondary', order: 5 }; // Should not happen in active rentals list often
}

function getOperationStatus(op: PopulatedOperation): { text: 'Pendente' | 'Em Andamento' | 'Em Atraso'; variant: 'secondary' | 'success' | 'destructive' | 'info' } {
    if (!op.startDate || !op.endDate) {
        return { text: 'Pendente', variant: 'secondary' };
    }
    const now = new Date();
    const startDate = parseISO(op.startDate);
    const endDate = parseISO(op.endDate);

    if (isAfter(now, endDate)) {
        return { text: 'Em Atraso', variant: 'destructive' };
    }
    if (isBefore(now, startDate)) {
        return { text: 'Pendente', variant: 'info' };
    }
    if (isWithinInterval(now, { start: startDate, end: endDate })) {
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

        const startFormat = "dd/MM/yy 'às' HH:mm";
        const endFormat = "dd/MM/yy 'às' HH:mm";

        return `${format(startDate, startFormat, { locale: ptBR })} - ${format(endDate, endFormat, { locale: ptBR })}`;
    } catch (error) {
        console.error("Error formatting date range:", error);
        return "Datas inválidas";
    }
}

const formatPhoneNumberForWhatsApp = (phone: string): string => {
    let digits = phone.replace(/\D/g, '');
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
        <path d="M10.01,0C4.5,0,.02,4.44,.02,9.92c0,1.77.47,3.5,1.37,5.01l-1.39,5.07,5.2-1.39h0c1.47.8,3.12,1.23,4.81,1.23,5.52,0,9.99-4.44,9.99-9.92S15.53,0,10.01,0ZM10.01,18.21c-1.69,0-3.26-.5-4.57-1.35l-3.11.83.83-3.03h0c-.95-1.35-1.5-2.98-1.5-4.75C1.66,5.34,5.4,1.63,10.01,1.63s8.35,3.71,8.35,8.29-3.74,8.29-8.35,8.29Z" />
        <path d="M5.39,9.36c-.71-1.36-.65-2.83.51-3.83.46-.44,1.36-.4,1.62.16l.8,1.92c.1.21.09.42-.06.63-.19.22-.37.44-.56.66-.15.17-.22.31-.08.48.76,1.28,1.86,2.32,3.42,2.98.23.09.39.07.55-.12.24-.29.48-.59.72-.88.2-.26.39-.29.68-.17.66.31,1.98.94,1.98.94.49.37-.19,1.8-.79,2.16-.87.51-1.46.43-2.37.25-2.97-.59-5.28-3.13-6.43-5.18h0Z" />
    </svg>
);

// --- Skeleton Component ---
function OSCardSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-full flex flex-col">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/3 mt-1" />
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col justify-between">
                        <div className="space-y-4">
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-3/4" />
                        </div>
                        <div className="flex flex-col md:flex-row w-full gap-2 mt-4">
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

const typeFilterOptions: { label: string; value: OsTypeFilter }[] = [
    { label: "Todas", value: 'Todas' },
    { label: "Aluguéis", value: 'Aluguel' },
    { label: "Operações", value: 'Operação' },
];

const statusFilterOptions: { label: string; value: StatusFilter }[] = [
    { label: "Todos Status", value: 'Todas' },
    { label: "Pendentes", value: 'Pendente' },
    { label: "Em Andamento", value: 'Em Andamento' },
    { label: "Encerram Hoje", value: 'Encerra hoje' },
    { label: "Em Atraso", value: 'Em Atraso' },
    { label: "Trocar", value: 'Trocar' },
];

// --- Main Page Component ---
export default function OSPage() {
    const { user, accountId, userAccount, isSuperAdmin, loading: authLoading } = useAuth();
    const [rentals, setRentals] = useState<PopulatedRental[]>([]);
    const [operations, setOperations] = useState<PopulatedOperation[]>([]);
    const [teamMembers, setTeamMembers] = useState<UserAccount[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [osTypeFilter, setOsTypeFilter] = useState<OsTypeFilter>('Todas');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todas');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [ownerAvatarDataUri, setOwnerAvatarDataUri] = useState<string | undefined>();
    const [titleViewMode, setTitleViewMode] = useState<TitleViewMode>(() => {
        if (typeof window !== 'undefined') {
            const savedMode = localStorage.getItem('osTitleViewMode') as TitleViewMode | null;
            if (savedMode && (savedMode === 'client' || savedMode === 'service')) {
                return savedMode;
            }
        }
        return 'client';
    });
    const router = useRouter();
    const { toast } = useToast();
    const dataLoadedRef = useRef(false);

    const permissions = userAccount?.permissions;
    const canAccessRentals = isSuperAdmin || !!permissions?.canAccessRentals;
    const canAccessOperations = isSuperAdmin || !!permissions?.canAccessOperations;
    const canAccessRoutes = isSuperAdmin || !!permissions?.canAccessRoutes;
    const canEditRentals = isSuperAdmin || !!permissions?.canEditRentals;
    const canEditOperations = isSuperAdmin || !!permissions?.canEditOperations;
    const canSeeServiceValue = isSuperAdmin || userAccount?.role === 'owner' || userAccount?.role === 'admin' || permissions?.canSeeServiceValue;
    const canUseAttachments = isSuperAdmin || !!permissions?.canUseAttachments;
    const isViewer = userAccount?.role === 'viewer';

    useEffect(() => {
        localStorage.setItem('osTitleViewMode', titleViewMode);
    }, [titleViewMode]);


    useEffect(() => {
        if (authLoading) return;

        const hasAccess = canAccessRentals || canAccessOperations;
        if (!accountId || !hasAccess) {
            setLoadingData(false);
            return;
        }

        if (!dataLoadedRef.current) {
            setLoadingData(true);
        }

        const isAdminView = isSuperAdmin || userAccount?.role === 'owner' || userAccount?.role === 'admin';
        const userIdToFilter = isAdminView ? undefined : user?.uid;

        const unsubscribers: (() => void)[] = [];

        const handleDataError = (err: Error) => {
            console.error("Data subscription error:", err);
            setError(err);
            setLoadingData(false);
        };

        if (teamMembers.length === 0) {
            fetchTeamMembers(accountId).then(setTeamMembers);
        }

        if (canAccessRentals) {
            const unsub = getPopulatedRentals(
                accountId,
                (data) => { setRentals(data); dataLoadedRef.current = true; setLoadingData(false); },
                handleDataError,
                userIdToFilter
            );
            unsubscribers.push(unsub);
        }

        if (canAccessOperations) {
            const unsub = getPopulatedOperations(
                accountId,
                (data) => { setOperations(data); dataLoadedRef.current = true; setLoadingData(false); },
                handleDataError,
                userIdToFilter
            );
            unsubscribers.push(unsub);
        }

        if (!canAccessRentals && !canAccessOperations) {
            setLoadingData(false);
        }

        return () => unsubscribers.forEach(unsub => unsub());

    }, [authLoading, accountId, user, userAccount, canAccessRentals, canAccessOperations, canEditRentals, canEditOperations, isSuperAdmin, teamMembers.length]);


    const combinedItems = useMemo(() => {
        const rentalItems = canAccessRentals ? rentals.map(r => ({ ...r, itemType: 'rental' as const, sortDate: r.rentalDate })) : [];
        const operationItems = canAccessOperations ? operations.map(o => ({ ...o, itemType: 'operation' as const, sortDate: o.startDate! })) : [];

        let allItems: (PopulatedRental | PopulatedOperation)[] = [...rentalItems, ...operationItems];

        if (selectedDate) {
            allItems = allItems.filter(item => {
                if (item.itemType === 'rental') {
                    const rentalStart = parseISO(item.rentalDate);
                    const rentalEnd = parseISO(item.returnDate);
                    return isWithinInterval(selectedDate, { start: rentalStart, end: rentalEnd });
                }
                if (item.itemType === 'operation') {
                    return isSameDay(parseISO(item.startDate!), selectedDate);
                }
                return false;
            });
        }

        if (osTypeFilter === 'Aluguel') {
            allItems = allItems.filter(item => item.itemType === 'rental');
        } else if (osTypeFilter === 'Operação') {
            allItems = allItems.filter(item => item.itemType === 'operation');
        }

        if (statusFilter !== 'Todas') {
            allItems = allItems.filter(item => {
                if (item.itemType === 'rental') {
                    const status = getRentalStatus(item).text;
                    if (statusFilter === 'Em Andamento') return status === 'Ativo';
                    return status === statusFilter;
                }
                if (item.itemType === 'operation') {
                    const status = getOperationStatus(item).text;
                    if (statusFilter === 'Em Andamento' || statusFilter === 'Pendente' || statusFilter === 'Em Atraso') {
                        return status === statusFilter;
                    }
                    return false;
                }
                return false;
            });
        }

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            allItems = allItems.filter(item => {
                const clientName = item.client?.name?.toLowerCase() || '';
                const assignedName = (item.itemType === 'rental' ? item.assignedToUser?.name?.toLowerCase() : item.driver?.name?.toLowerCase()) || '';
                const id = (item.itemType === 'rental' ? `al${item.sequentialId}` : `op${item.sequentialId}`).toLowerCase();
                const address = (item.itemType === 'rental' ? item.deliveryAddress.toLowerCase() : item.destinationAddress.toLowerCase());

                return clientName.includes(lowercasedTerm) ||
                    assignedName.includes(lowercasedTerm) ||
                    id.includes(lowercasedTerm) ||
                    address.includes(lowercasedTerm);
            });
        }

        return allItems.sort((a, b) => {
            const dateA = new Date((a as any).sortDate);
            const dateB = new Date((b as any).sortDate);
            return dateA.getTime() - dateB.getTime()
        });

    }, [rentals, operations, searchTerm, osTypeFilter, statusFilter, canAccessRentals, canAccessOperations, selectedDate]);

    const owner = useMemo(() => teamMembers.find(m => m.role === 'owner'), [teamMembers]);

    useEffect(() => {
        if (!owner?.avatarUrl) {
            setOwnerAvatarDataUri(undefined);
            return;
        }

        const controller = new AbortController();
        const toDataURL = async (url: string) => {
            try {
                const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`, { signal: controller.signal });
                if (!res.ok) throw new Error('fetch failed: ' + res.status);
                const blob = await res.blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Erro ao converter avatar para dataURI', err);
                }
                return undefined;
            }
        };

        let mounted = true;
        toDataURL(owner.avatarUrl).then(uri => { if (mounted) setOwnerAvatarDataUri(uri); });

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [owner?.avatarUrl]);

    const handleTypeFilterChange = (type: OsTypeFilter) => {
        setOsTypeFilter(type);
        setStatusFilter('Todas'); // Reset status filter when type changes
    };

    const handleAttachmentUploaded = async (item: PopulatedRental | PopulatedOperation, newAttachment: Attachment) => {
        if (!accountId) return;

        let result;
        let collectionName: 'rentals' | 'operations';

        if (item.itemType === 'rental') {
            collectionName = 'rentals';
            result = await addAttachmentToRentalAction(accountId, item.id, newAttachment, collectionName);
        } else {
            collectionName = 'operations';
            result = await addAttachmentToOperationAction(accountId, item.id, newAttachment, collectionName);
        }

        if (result.message === 'success') {
            const updateState = (prevItems: any[]) => prevItems.map(i =>
                i.id === item.id
                    ? { ...i, attachments: [...(i.attachments || []), newAttachment] }
                    : i
            );

            if (item.itemType === 'rental') {
                setRentals(updateState);
            } else {
                setOperations(updateState);
            }

            toast({ title: 'Sucesso!', description: 'Anexo adicionado.' });
        } else {
            toast({ title: 'Erro ao adicionar anexo', description: result.error, variant: 'destructive' });
        }
    };

    const handleAttachmentDeleted = async (item: PopulatedRental | PopulatedOperation, attachmentToDelete: Attachment) => {
        if (!accountId) return;

        const collectionName = item.itemType === 'rental' ? 'rentals' : 'operations';
        const result = await deleteAttachmentAction(accountId, item.id, collectionName, attachmentToDelete);

        if (result.message === 'success') {
            const updateState = (prevItems: any[]) => prevItems.map(i => {
                if (i.id === item.id) {
                    return { ...i, attachments: (i.attachments || []).filter((att: Attachment) => att.url !== attachmentToDelete.url) };
                }
                return i;
            });

            if (item.itemType === 'rental') {
                setRentals(updateState);
            } else {
                setOperations(updateState);
            }

            toast({ title: 'Sucesso!', description: 'Anexo removido.' });
        } else {
            toast({ title: 'Erro ao remover anexo', description: result.error, variant: 'destructive' });
        }
    };

    const handleQuickAction = async (action: 'edit' | 'finalize' | 'pdf' | 'delete' | 'swap', item: PopulatedRental | PopulatedOperation) => {
        if (!accountId) return;
        const isRental = item.itemType === 'rental';

        switch (action) {
            case 'edit':
                router.push(`/${isRental ? 'rentals' : 'operations'}/${item.id}/edit`);
                break;
            case 'finalize': {
                const finalizeAction = isRental ? finishRentalAction : finishOperationAction;
                const result = await finalizeAction(accountId, item.id);
                if (result?.message === 'error') {
                    toast({ title: 'Erro ao finalizar', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Sucesso', description: 'OS finalizada.' });
                }
                break;
            }
            case 'pdf': {
                const pdfContainerId = `pdf-${isRental ? 'al' : 'op'}-${item.id}`;
                const pdfContainer = document.getElementById(pdfContainerId);
                if (!pdfContainer) {
                    toast({ title: "Erro", description: "Container do PDF não encontrado.", variant: "destructive" });
                    return;
                }

                const canvas = await html2canvas(pdfContainer, { useCORS: true, scale: 2 });
                if (canvas.width === 0 || canvas.height === 0) {
                    toast({ title: "Erro de Renderização", description: "Não foi possível gerar a imagem para o PDF. Tente novamente.", variant: "destructive" });
                    return;
                }

                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);

                const osId = `${isRental ? 'AL' : 'OP'}${item.sequentialId}`;
                pdf.save(`OS_${osId}.pdf`);

                break;
            }
            case 'delete': {
                const deleteAction = isRental ? deleteRentalAction : deleteOperationAction;
                const result = await deleteAction(accountId, item.id);
                if (result?.message === 'error') {
                    toast({ title: 'Erro ao excluir', description: result.error, variant: 'destructive' });
                } else {
                    toast({ title: 'Sucesso', description: 'OS excluída.' });
                }
                break;
            }
            case 'swap':
                if (isRental) {
                    const rental = item as PopulatedRental;
                    const query = new URLSearchParams({
                        swapOriginId: rental.id,
                        prefill: JSON.stringify({
                            clientId: rental.client?.id,
                            assignedTo: rental.assignedToUser?.id,
                            startAddress: rental.startAddress,
                            startLatitude: rental.startLatitude,
                            startLongitude: rental.startLongitude,
                            deliveryAddress: rental.deliveryAddress,
                            latitude: rental.latitude,
                            longitude: rental.longitude,
                            value: rental.value,
                            billingType: rental.billingType,
                            lumpSumValue: rental.lumpSumValue,
                            observations: rental.observations
                        })
                    }).toString();

                    router.push(`/rentals/new?${query}`);
                }
                break;
        }
    };

    const handleCancelRecurrence = async (item: PopulatedRental | PopulatedOperation) => {
        if (!item.recurrenceProfileId) return;

        const result = await cancelRecurrenceAction(accountId, item.recurrenceProfileId);
        if (result.message === 'success') {
            toast({ title: 'Sucesso', description: 'Recorrência cancelada.' });
            // Optionally refresh data here if needed, but the action revalidates path
        } else {
            toast({ title: 'Erro', description: result.error || 'Erro ao cancelar recorrência.', variant: 'destructive' });
        }
    };

    const isLoading = authLoading || loadingData;
    const hasAnyAccess = canAccessRentals || canAccessOperations || isSuperAdmin;

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <h1 className="text-3xl font-headline font-bold mb-8">Ordens de Serviço</h1>
                <OSCardSkeleton />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
                <div className="p-4 bg-destructive/10 rounded-full mb-4">
                    <ShieldAlert className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold font-headline mb-2">Erro de Carregamento</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                    Não foi possível carregar as ordens de serviço. Isso pode ser um problema nos dados de uma OS específica. Verifique os dados no servidor ou contate o suporte.
                </p>
                <Button onClick={() => window.location.reload()}>
                    Recarregar Página
                </Button>
            </div>
        )
    }

    if (!hasAnyAccess) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>
                        Você não tem permissão para visualizar Ordens de Serviço.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    const pageContent = (
        <>
            {/* Hidden container for PDF rendering */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
                {combinedItems.map(item => (
                    <OsPdfDocument
                        key={`pdf-doc-${item.id}`}
                        item={item}
                        owner={owner}
                    />
                ))}
            </div>

            <div className="space-y-4 mb-6">
                <div className="flex flex-col md:flex-row gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por cliente, responsável ou nº da OS..."
                            className="pl-9 bg-card"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full md:w-auto justify-start text-left font-normal",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Filtrar por data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <CalendarComponent
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => {
                                    setSelectedDate(date);
                                    setIsDatePopoverOpen(false);
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        {typeFilterOptions.map(option => (
                            <Button
                                key={option.value}
                                variant={osTypeFilter === option.value ? "default" : "outline"}
                                onClick={() => handleTypeFilterChange(option.value)}
                                className="py-2"
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {statusFilterOptions.map((option) => (
                            <Button
                                key={option.value}
                                variant={statusFilter === option.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter(option.value as StatusFilter)}
                                className="py-1 h-7 text-xs"
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Switch
                            id="title-view-mode"
                            checked={titleViewMode === 'client'}
                            onCheckedChange={(checked: boolean) => setTitleViewMode(checked ? 'client' : 'service')}
                        />
                        <Label htmlFor="title-view-mode">
                            {titleViewMode === 'client' ? "Visualizando por cliente" : "Visualizando por serviço"}
                        </Label>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {combinedItems.length > 0 ? (
                    combinedItems.map((item) => {
                        const uniqueKey = `${item.itemType}-${item.id}`;
                        if (item.itemType === 'rental') {
                            const rental = item as PopulatedRental;
                            const status = getRentalStatus(rental);

                            const title = titleViewMode === 'client' ? rental.client?.name : (rental.dumpsters || []).map(d => d.name).join(', ');
                            const subtitle = titleViewMode === 'client' ? (rental.dumpsters || []).map(d => `${d.name} (${d.size}m³)`).join(', ') : rental.client?.name;

                            return (
                                <DraggableActionCard
                                    key={uniqueKey}
                                    actions={
                                        <>
                                            {canEditRentals && <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('edit', rental)}><Edit className="h-6 w-6" /> Editar</Button>}
                                            <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('finalize', rental)}> <CheckCircle className="h-6 w-6" /> Finalizar</Button>
                                            <a href={`https://wa.me/${formatPhoneNumberForWhatsApp(rental.client?.phone || '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex">
                                                <Button variant="outline" size="lg" className="h-20 flex-col gap-2 w-full"><WhatsAppIcon className="h-6 w-6 fill-current" /> Contato</Button>
                                            </a>
                                            {canEditRentals && <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('swap', rental)}><ArrowRightLeft className="h-6 w-6" /> Trocar</Button>}
                                            <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('pdf', rental)}><Download className="h-6 w-6" /> Baixar PDF</Button>
                                            {rental.recurrenceProfileId && (
                                                <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleCancelRecurrence(rental)}><RefreshCw className="h-6 w-6 text-blue-500" /> Cancelar Recorrência</Button>
                                            )}
                                            {canEditRentals && <Button variant="destructive" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('delete', rental)}><Trash2 className="h-6 w-6" /> Excluir</Button>}
                                        </>
                                    }
                                >
                                    <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value={rental.id} className="border-none">
                                            <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                                                <div className="absolute top-2 left-3 flex items-center gap-1.5 text-xs font-mono font-bold text-primary">
                                                    <Container className="h-3 w-3" />
                                                    <span>AL{rental.sequentialId}</span>
                                                </div>
                                                <CardHeader className="pb-4 pt-8">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="pr-4">
                                                            <CardTitle className="text-xl font-headline">{title}</CardTitle>
                                                            <CardDescription>{subtitle}</CardDescription>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                                                            {rental.recurrenceProfileId && (
                                                                <div title="OS Recorrente">
                                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 flex items-center gap-1">
                                                                        <RefreshCw className="h-3 w-3" />
                                                                        Recorrente
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                            <Badge variant={status.variant} className="text-center">{status.text}</Badge>
                                                        </div>
                                                    </div>
                                                    <CardDescription className="text-sm mt-4">
                                                        <div className="flex flex-col md:flex-row justify-between items-start gap-y-2 gap-x-4">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <User className="h-4 w-4" />
                                                                    {canEditRentals && rental.assignedToUser ? (
                                                                        <EditAssignedUserDialog rental={rental} teamMembers={teamMembers}>
                                                                            {rental.assignedToUser.name}
                                                                        </EditAssignedUserDialog>
                                                                    ) : (
                                                                        <span>{rental.assignedToUser?.name}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-start md:items-end gap-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar className="h-4 w-4" />
                                                                    <span>{formatDateRange(rental.rentalDate, rental.returnDate)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    {rental.swapDate && (
                                                                        <p className="text-xs font-semibold text-blue-600">
                                                                            Troca agendada para: {format(parseISO(rental.swapDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                                        </p>
                                                                    )}
                                                                    <ScheduleSwapDialog rental={rental} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardDescription>
                                                </CardHeader>
                                                <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                                </AccordionTrigger>
                                                <AccordionContent className="p-6 pt-4">
                                                    <RentalCardActions rental={rental} status={status} />
                                                </AccordionContent>
                                            </Card>
                                        </AccordionItem>
                                    </Accordion>
                                </DraggableActionCard>
                            )
                        } else {
                            const op = item as PopulatedOperation;
                            const status = getOperationStatus(op);
                            const canEditOp = canEditOperations && op.status !== 'Concluído';
                            const isFinalizeOpDisabled = status.text !== 'Em Andamento' && status.text !== 'Em Atraso';
                            const attachmentCount = op.attachments?.length || 0;

                            const title = titleViewMode === 'client' ? op.client?.name : op.operationTypes.map(t => t.name).join(', ');
                            const subtitle = titleViewMode === 'client' ? op.operationTypes.map(t => t.name).join(', ') : op.client?.name;

                            return (
                                <DraggableActionCard
                                    key={uniqueKey}
                                    actions={
                                        <>
                                            {canEditOp && <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('edit', op)}><Edit className="h-6 w-6" /> Editar</Button>}
                                            <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('finalize', op)} disabled={isFinalizeOpDisabled}><CheckCircle className="h-6 w-6" /> Finalizar</Button>
                                            <a href={`https://wa.me/${formatPhoneNumberForWhatsApp(op.client?.phone || '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex">
                                                <Button variant="outline" size="lg" className="h-20 flex-col gap-2 w-full"><WhatsAppIcon className="h-6 w-6 fill-current" /> Contato</Button>
                                            </a>
                                            <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('pdf', op)}><Download className="h-6 w-6" /> Baixar PDF</Button>
                                            {op.recurrenceProfileId && (
                                                <Button variant="outline" size="lg" className="h-20 flex-col gap-2" onClick={() => handleCancelRecurrence(op)}><RefreshCw className="h-6 w-6 text-blue-500" /> Cancelar Recorrência</Button>
                                            )}
                                            {canEditOp && <Button variant="destructive" size="lg" className="h-20 flex-col gap-2" onClick={() => handleQuickAction('delete', op)}><Trash2 className="h-6 w-6" /> Excluir</Button>}
                                        </>
                                    }
                                >
                                    <Accordion type="single" collapsible className="w-full">
                                        <AccordionItem value={op.id} className="border-none">
                                            <Card className="relative h-full flex flex-col border rounded-lg shadow-sm overflow-hidden bg-card">
                                                <div className="absolute top-2 left-3 flex items-center gap-1.5 text-xs font-mono font-bold text-primary">
                                                    <Workflow className="h-3 w-3" />
                                                    <span>OP{op.sequentialId}</span>
                                                </div>
                                                <CardHeader className="pb-4 pt-8">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="pr-4">
                                                            <CardTitle className="text-xl font-headline">{title}</CardTitle>
                                                            <CardDescription>{subtitle}</CardDescription>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                                                            {op.recurrenceProfileId && (
                                                                <div title="OS Recorrente">
                                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 flex items-center gap-1">
                                                                        <RefreshCw className="h-3 w-3" />
                                                                        Recorrente
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                            <Badge variant={status.variant} className="text-center flex-shrink-0">{status.text}</Badge>
                                                        </div>
                                                    </div>
                                                    <CardDescription className="text-sm mt-4">
                                                        <div className="flex flex-col md:flex-row justify-between items-start gap-y-2 gap-x-4">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <User className="h-4 w-4" />
                                                                    {canEditOperations && op.driver ? (
                                                                        <EditOperationAssignedUserDialog operation={op} teamMembers={teamMembers}>
                                                                            {op.driver.name}
                                                                        </EditOperationAssignedUserDialog>
                                                                    ) : (
                                                                        <span>{op.driver?.name}</span>
                                                                    )}
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
                                                                    <Calendar className="h-4 w-4" />
                                                                    {formatDateRange(op.startDate, op.endDate)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardDescription>
                                                </CardHeader>
                                                <AccordionTrigger className="w-full bg-muted/50 hover:bg-muted/80 text-muted-foreground hover:no-underline p-2 rounded-none justify-center" hideChevron>
                                                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
                                                </AccordionTrigger>
                                                <AccordionContent className="p-6 pt-4">
                                                    <div className="space-y-4 text-sm">
                                                        <Separator />
                                                        <div className="mt-3 space-y-4">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <div className="flex-grow">
                                                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Destino:</p>
                                                                    <p className="font-medium">{op.destinationAddress}</p>
                                                                </div>
                                                                <a href={op.destinationGoogleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(op.destinationAddress)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0">
                                                                    <MapPinned className="h-5 w-5" />
                                                                    <span className="text-[10px] font-bold">GPS</span>
                                                                </a>
                                                            </div>
                                                            <Accordion type="single" collapsible className="w-full">
                                                                <AccordionItem value="start-address" className="border-none">
                                                                    <AccordionTrigger className="text-xs text-primary hover:no-underline p-0 justify-start [&>svg]:ml-1 data-[state=closed]:text-muted-foreground">
                                                                        <span className="font-normal">Mostrar endereço de partida</span>
                                                                    </AccordionTrigger>
                                                                    <AccordionContent className="pt-2">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <span className="font-semibold uppercase text-xs">Saída:</span>
                                                                            <span>{op.startAddress}</span>
                                                                        </div>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            </Accordion>
                                                        </div>

                                                        {op.observations && (
                                                            <div className="flex items-start gap-3">
                                                                <FileText className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                                                                <p className="whitespace-pre-wrap">{op.observations}</p>
                                                            </div>
                                                        )}
                                                        <Separator />

                                                        {canSeeServiceValue && (
                                                            <div className="flex items-center gap-2 pt-2">
                                                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-medium">Valor do Serviço:</span>
                                                                <span className="font-bold">{formatCurrency(op.value)}</span>
                                                            </div>
                                                        )}

                                                        <Separator />

                                                        <Accordion type="single" collapsible className="w-full">
                                                            <AccordionItem value="attachments" className="border-none">
                                                                <div className="pt-2 flex justify-between items-center w-full">
                                                                    {op.client?.phone && (
                                                                        <a
                                                                            href={`https://wa.me/${formatPhoneNumberForWhatsApp(op.client.phone)}?text=Olá, ${op.client.name}! Somos da equipe LogiApp, sobre a OS OP${op.sequentialId}.`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-2 hover:underline"
                                                                        >
                                                                            <WhatsAppIcon className="h-6 w-6 fill-green-600" />
                                                                            <span className="font-medium text-green-600">{op.client.phone}</span>
                                                                        </a>
                                                                    )}
                                                                    {canUseAttachments && (
                                                                        <AccordionTrigger className="text-sm text-primary hover:underline p-0 justify-end [&>svg]:ml-1">
                                                                            ({attachmentCount}) Anexos
                                                                        </AccordionTrigger>
                                                                    )}
                                                                </div>
                                                                {canUseAttachments && (
                                                                    <AccordionContent className="pt-4">
                                                                        {accountId && (
                                                                            <AttachmentsUploader
                                                                                accountId={accountId}
                                                                                attachments={op.attachments || []}
                                                                                onAttachmentUploaded={(att) => handleAttachmentUploaded(op, att)}
                                                                                onAttachmentDeleted={(att) => handleAttachmentDeleted(op, att)}
                                                                                uploadPath={`accounts/${accountId}/operations/${op.id}/attachments`}
                                                                                showDeleteButton
                                                                                showLabel={false}
                                                                            />
                                                                        )}
                                                                    </AccordionContent>
                                                                )}
                                                            </AccordionItem>
                                                        </Accordion>
                                                        <div className="flex w-full items-center gap-2 mt-auto pt-4">
                                                            <AlertDialog>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="nooutline" size="bigicon">
                                                                            <MoreVertical className="h-6 w-6" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent>
                                                                        {canEditOp && (
                                                                            <DropdownMenuItem asChild>
                                                                                <Link href={`/operations/${op.id}/edit`}>
                                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                                    Editar
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {op.recurrenceProfileId && (
                                                                            <DropdownMenuItem onSelect={() => handleCancelRecurrence(op)} className="text-blue-600 focus:text-blue-600 focus:bg-blue-50">
                                                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                                                Cancelar Recorrência
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {canEditOp && <DropdownMenuSeparator />}
                                                                        <AlertDialogTrigger asChild>
                                                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()} disabled={!canEditOp}>
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Excluir
                                                                            </DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Excluir Operação?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Esta ação não pode ser desfeita. A operação #{op.sequentialId} será permanentemente excluída.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleQuickAction('delete', op)} className="bg-destructive hover:bg-destructive/90">
                                                                            Excluir
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                            <Button onClick={() => handleQuickAction('finalize', op)} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isFinalizeOpDisabled}>
                                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                                Finalizar
                                                            </Button>
                                                            <Button variant="nooutline" onClick={() => handleQuickAction('pdf', op)} size="bigicon">
                                                                <Image src="/pdf.svg" alt="PDF Icon" width={26} height={26} />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </Card>
                                        </AccordionItem>
                                    </Accordion>
                                </DraggableActionCard>
                            )
                        }
                    })
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Nenhuma OS Encontrada</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground text-center py-8">Não há Ordens de Serviço que correspondam aos filtros selecionados.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );

    return (
        <div className="container mx-auto py-8 px-4 md:px-6">

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Ordens de Serviço</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie suas ordens de aluguel e operações.
                    </p>
                </div>
                {canAccessRoutes && (
                    <>
                        <Button asChild variant="outline" className="hidden md:inline-flex">
                            <Link href="/route-planning">
                                <Sparkles className="mr-2 h-4 w-4" />
                                Planejar Rota com IA
                            </Link>
                        </Button>
                        <Button asChild variant="default" className="md:hidden flex-col h-auto p-2">
                            <Link href="/route-planning">
                                <Sparkles className="h-6 w-6" />
                                <span className="text-xs">Rota IA</span>
                            </Link>
                        </Button>
                    </>
                )}
            </div>
            {pageContent}
        </div>
    );
}
