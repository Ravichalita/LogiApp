
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Edit, Plus, Filter, ArrowUpCircle, ArrowDownCircle, CheckCircle2, Clock, Settings2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { Transaction, TransactionCategory } from '@/lib/types';
import { createTransactionAction, updateTransactionAction, deleteTransactionAction, toggleTransactionStatusAction } from '@/lib/finance-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { ManageCategories } from './categories-settings';
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
    onTransactionChange,
    onRefresh
}: {
    transactions: Transaction[],
    categories: TransactionCategory[],
    onTransactionChange?: (transaction: Transaction | null, action: 'create' | 'update' | 'delete') => void,
    onRefresh?: () => void
}) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

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

            // Construct optimistic object or use returned data if available
            // Currently server actions don't return the full object, so we might need to rely on revalidation
            // OR we can try to guess it.
            // Ideally server action returns the object.
            // Since we can't easily change server action return type safely without checking all usages,
            // we will use onRefresh if onTransactionChange is not provided,
            // BUT if we want to avoid refresh we should ideally get the data back.
            // For now, let's trigger a silent background refresh via onRefresh if available?
            // NO, the user wants NO page refresh.
            // We need to trigger the parent update.
            // Since `createTransactionAction` DOES NOT return the object, we have a problem implementing TRUE optimistic UI without fetching.
            // However, we can use the form data to create a temporary object.

            // If the server action returns 'success', we can assume it worked.
            // But we don't have the generated ID for creates.
            // So for CREATE, we might still need a fetch or simply call onRefresh() but modify FinancePage to NOT show loading skeleton for that.
            // BUT the user specific request is "sem precisar de refresh em toda a página".
            // So calling onRefresh (which sets loadingData=true) is bad.

            // Strategy:
            // 1. If we have `onTransactionChange` and it's an UPDATE, we can merge existing + changes.
            // 2. If it's a CREATE, we really need the ID.
            // Let's modify `createTransactionAction` to return the ID?
            // I'd rather not change shared server logic if possible to avoid breaking other things, but `createTransactionAction` is likely only used here or in limited places.
            // I will assume for now we fall back to `onRefresh` but try to suppress the loading state in parent? No, parent controls that.

            // Wait, looking at `createTransactionAction` in `src/lib/finance-actions.ts`:
            // It calls `revalidatePath('/finance')`. This implicitly causes Next.js to reload data on next navigation.
            // But client side fetch in `FinancePage` is manual.

            // Compromise: We will call `onRefresh` but `FinancePage` should be smart enough to NOT show full skeleton if we just want a background data update?
            // Currently `FinancePage` sets `setLoadingData(true)` on refresh.
            // We should fix `FinancePage` to not block UI on refresh.

            // Let's stick to the plan: I'll use `onTransactionChange` for DELETE (easy).
            // For CREATE/UPDATE: I will call `onRefresh`. AND I will modify FinancePage to make `loadingData` false during refresh if data already exists.

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
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Input
                            placeholder="Buscar transação..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
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

                    <Button variant="outline" onClick={() => setIsCategoriesDialogOpen(true)}>
                        Categorias
                    </Button>
                    <Button onClick={() => { setEditingTransaction(null); setIsAddDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Nova
                    </Button>
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
                            return (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {t.type === 'income' ?
                                                <ArrowUpCircle className="h-4 w-4 text-green-500" /> :
                                                <ArrowDownCircle className="h-4 w-4 text-red-500" />
                                            }
                                            {t.description}
                                            {t.source === 'service' && <Badge variant="outline" className="text-[10px] h-5">Auto</Badge>}
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
                                <Select name="type" defaultValue={editingTransaction?.type || 'expense'}>
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
                                        {/* TODO: Dynamically filter based on selected type if needed, but showing all is okay for now */}
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
        </div>
    );
}
