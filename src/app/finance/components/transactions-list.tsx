
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit, Plus, Filter, ArrowUpCircle, ArrowDownCircle, CheckCircle2, Clock, Settings2, ChevronLeft, ChevronRight, LayoutList, TrendingUp, TrendingDown, Container, User, CalendarClock } from 'lucide-react';
import { format, parseISO, addMonths, subMonths, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/context/auth-context';
import { Transaction, TransactionCategory, RecurringTransactionProfile } from '@/lib/types';
import { createTransactionAction, updateTransactionAction, deleteTransactionAction, toggleTransactionStatusAction } from '@/lib/finance-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { ManageCategories } from './categories-settings';
import { RecurringTransactionsSettings } from './recurring-transactions-settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as RealAlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


type TransactionStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

const STATUS_LABELS: Record<TransactionStatus, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    overdue: 'Vencido',
    cancelled: 'Cancelado'
};

const STATUS_COLORS: Record<TransactionStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
}

export function TransactionsList({
    transactions,
    categories,
    recurringProfiles,
    onTransactionChange,
    onRefresh,
    selectedDate,
    onDateChange
}: {
    transactions: Transaction[],
    categories: TransactionCategory[],
    recurringProfiles?: RecurringTransactionProfile[],
    onTransactionChange?: (transaction: Transaction | null, action: 'create' | 'update' | 'delete') => void,
    onRefresh?: () => void,
    selectedDate: Date,
    onDateChange: (date: Date) => void
}) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
    const [isRecurringDialogOpen, setIsRecurringDialogOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [defaultTransactionType, setDefaultTransactionType] = useState<'income' | 'expense'>('expense');

    const filteredTransactions = transactions.filter(t => {
        const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
        const matchesType = filterType === 'all' || t.type === filterType;
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesType && matchesSearch;
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!accountId) return;

        const formData = new FormData(e.currentTarget);
        setLoadingAction('save');

        let result;
        if (editingTransaction) {
            formData.set('id', editingTransaction.id);
            result = await updateTransactionAction(accountId, null, formData);
        } else {
            result = await createTransactionAction(accountId, null, formData);
        }

        setLoadingAction(null);

        if (result.message === 'success') {
            toast({ title: 'Sucesso', description: editingTransaction ? 'Transação atualizada.' : 'Transação criada.' });
            setIsAddDialogOpen(false);
            if (onRefresh) onRefresh();
            setEditingTransaction(null);
        } else {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!accountId) return;

        setDeletingId(id);
        const result = await deleteTransactionAction(accountId, id);
        setDeletingId(null);

        if (result.message === 'success') {
            toast({ title: 'Sucesso', description: 'Transação excluída.' });
            if (onTransactionChange) {
                // Optimistic removal
                onTransactionChange({ id } as Transaction, 'delete');
            } else if (onRefresh) {
                onRefresh();
            }
        } else {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        if (!accountId) return;

        // Optimistic update
        const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
        const transaction = transactions.find(t => t.id === id);
        if (transaction && onTransactionChange) {
            onTransactionChange({ ...transaction, status: newStatus as any }, 'update');
        }

        const result = await toggleTransactionStatusAction(accountId, id, currentStatus);
        if (result.message !== 'success') {
            // Revert on failure
             if (transaction && onTransactionChange) {
                onTransactionChange({ ...transaction, status: currentStatus as any }, 'update');
            }
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        } else {
             // If we didn't optimistic update, we refresh
             if (!onTransactionChange && onRefresh) onRefresh();
        }
    };

    return (
        <div className="space-y-4 relative">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <div className="relative w-full md:w-64">
                        <Input
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center bg-muted/50 rounded-md border">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => onDateChange(subMonths(selectedDate, 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 font-medium min-w-[140px] text-center capitalize text-sm">
                            {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => onDateChange(addMonths(selectedDate, 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Tipos</SelectItem>
                            <SelectItem value="income">Receitas</SelectItem>
                            <SelectItem value="expense">Despesas</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os Status</SelectItem>
                            <SelectItem value="pending">Pendentes</SelectItem>
                            <SelectItem value="paid">Pagos</SelectItem>
                            <SelectItem value="overdue">Vencidos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.length > 0 ? filteredTransactions.map((t) => {
                            const category = categories.find(c => c.id === t.categoryId);
                            const isFuture = isAfter(parseISO(t.dueDate), startOfDay(new Date()));
                            const isRecurringFuture = t.recurringProfileId && isFuture && t.status === 'pending';

                            return (
                                <TableRow key={t.id} className={cn(isFuture && t.status === 'pending' && "opacity-60 hover:opacity-100 transition-opacity")}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {t.type === 'income' ?
                                                <ArrowUpCircle className="h-4 w-4 text-green-500" /> :
                                                <ArrowDownCircle className="h-4 w-4 text-red-500" />
                                            }
                                            {t.description}
                                            {t.source === 'service' && <Badge variant="outline" className="text-[10px] h-5">Auto</Badge>}
                                            {isRecurringFuture && (
                                                <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                    Transação Futura
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {category ? (
                                            <Badge variant="secondary" style={category.color ? { backgroundColor: category.color + '20', color: category.color } : {}}>
                                                {category.name}
                                            </Badge>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>{format(parseISO(t.dueDate), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className={cn(STATUS_COLORS[t.status])}>
                                                {STATUS_LABELS[t.status]}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 rounded-full"
                                                onClick={() => handleToggleStatus(t.id, t.status)}
                                                title={t.status === 'paid' ? 'Marcar como pendente' : 'Marcar como pago'}
                                            >
                                                {t.status === 'paid' ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className={cn("text-right font-bold", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                                        {t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTransaction(t); setIsAddDialogOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                    disabled={deletingId === t.id}
                                                >
                                                    {deletingId === t.id ? <Spinner size="small" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Tem certeza que deseja excluir esta transação?</AlertDialogTitle>
                                                    <RealAlertDialogDescription>
                                                        Esta ação não pode ser desfeita e excluirá permanentemente o registro desta transação.
                                                    </RealAlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(t.id)}>
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            );
                        }) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                    Nenhuma transação encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
                        <DialogDescription>
                            Preencha os detalhes da transação financeira.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Input id="description" name="description" required defaultValue={editingTransaction?.description} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Valor (R$)</Label>
                                <Input id="amount" name="amount" type="number" step="0.01" required defaultValue={editingTransaction?.amount} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="type">Tipo</Label>
                                <Select name="type" defaultValue={editingTransaction?.type || defaultTransactionType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="income">Receita</SelectItem>
                                        <SelectItem value="expense">Despesa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="categoryId">Categoria</Label>
                                <Select name="categoryId" defaultValue={editingTransaction?.categoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.type === 'income' ? 'Entrada' : 'Saída'})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="dueDate">Data de Vencimento</Label>
                                <Input id="dueDate" name="dueDate" type="date" required defaultValue={editingTransaction?.dueDate ? format(parseISO(editingTransaction.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} />
                            </div>
                        </div>

                        {editingTransaction && (
                             <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select name="status" defaultValue={editingTransaction.status}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="paid">Pago</SelectItem>
                                        <SelectItem value="overdue">Vencido</SelectItem>
                                        <SelectItem value="cancelled">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={!!loadingAction}>
                                {loadingAction === 'save' && <Spinner size="small" className="mr-2" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isCategoriesDialogOpen} onOpenChange={setIsCategoriesDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <ManageCategories
                        categories={categories}
                        onClose={() => setIsCategoriesDialogOpen(false)}
                        onRefresh={onRefresh}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isRecurringDialogOpen} onOpenChange={setIsRecurringDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Configuração de Recorrências</DialogTitle>
                        <DialogDescription>
                             Gerencie suas receitas e despesas fixas.
                        </DialogDescription>
                    </DialogHeader>
                    <RecurringTransactionsSettings
                        profiles={recurringProfiles || []}
                        categories={categories}
                        accountId={accountId || ''}
                        onRefresh={onRefresh}
                    />
                </DialogContent>
            </Dialog>

            <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className="h-16 w-16 rounded-full shadow-lg">
                            <Plus className="h-8 w-8" />
                            <span className="sr-only">Menu Financeiro</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="mb-2 w-56">
                        <DropdownMenuItem
                            className="py-3 cursor-pointer"
                            onSelect={() => {
                                setDefaultTransactionType('income');
                                setEditingTransaction(null);
                                setIsAddDialogOpen(true);
                            }}
                        >
                            <TrendingUp className="mr-2 h-4 w-4 text-green-600" />
                            <span>Receita</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="py-3 cursor-pointer"
                            onSelect={() => {
                                setDefaultTransactionType('expense');
                                setEditingTransaction(null);
                                setIsAddDialogOpen(true);
                            }}
                        >
                            <TrendingDown className="mr-2 h-4 w-4 text-red-600" />
                            <span>Despesa</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="py-3 cursor-pointer"
                            onSelect={() => setIsRecurringDialogOpen(true)}
                        >
                            <CalendarClock className="mr-2 h-4 w-4 text-blue-600" />
                            <span>Recorrências Fixas</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="py-3 cursor-pointer"
                            onSelect={() => setIsCategoriesDialogOpen(true)}
                        >
                            <LayoutList className="mr-2 h-4 w-4" />
                            <span>Categorias</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
