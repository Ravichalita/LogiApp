
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import {
    RecurringTransactionProfile,
    TransactionCategory,
    RecurringTransactionProfileSchema
} from '@/lib/types';
import {
    saveRecurringTransactionProfileAction,
    deleteRecurringTransactionProfileAction
} from '@/lib/finance-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger,
    DialogDescription
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Edit2, Plus, CalendarClock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { Spinner } from '@/components/ui/spinner';


interface RecurringTransactionsSettingsProps {
    profiles: RecurringTransactionProfile[];
    categories: TransactionCategory[];
    accountId: string;
    onRefresh?: () => void;
}

const DAYS_OF_WEEK = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terça' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sábado' },
];

export function RecurringTransactionsSettings({
    profiles,
    categories,
    accountId,
    onRefresh
}: RecurringTransactionsSettingsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<RecurringTransactionProfile | null>(null);

    const handleEdit = (profile: RecurringTransactionProfile) => {
        setEditingProfile(profile);
        setIsOpen(true);
    };

    const handleCreate = () => {
        setEditingProfile(null);
        setIsOpen(true);
    };

    const handleSuccess = () => {
        setIsOpen(false);
        if (onRefresh) {
            onRefresh();
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CalendarClock className="h-5 w-5" />
                    Transações Recorrentes
                </h3>
                <Button onClick={handleCreate} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Recorrência
                </Button>
            </div>

            <div className="space-y-2">
                {profiles.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
                        Nenhuma recorrência cadastrada.
                    </div>
                )}
                {profiles.map(profile => (
                    <div
                        key={profile.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors bg-card"
                    >
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "font-medium",
                                    profile.type === 'income' ? 'text-green-600' : 'text-red-600'
                                )}>
                                    {profile.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profile.amount)}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                    {profile.frequency === 'daily' ? 'Diária' :
                                     profile.frequency === 'weekly' ? 'Semanal' :
                                     profile.frequency === 'biweekly' ? 'Quinzenal' : 'Mensal'}
                                </Badge>
                                {profile.frequency === 'daily' && profile.daysOfWeek && (
                                    <span className="text-xs text-muted-foreground">
                                        ({profile.daysOfWeek.length === 7 ? 'Todos os dias' : profile.daysOfWeek.length + ' dias/sem'})
                                    </span>
                                )}
                            </div>
                            <div className="text-sm font-medium">{profile.description}</div>
                            <div className="text-xs text-muted-foreground">
                                Início: {format(new Date(profile.startDate), 'dd/MM/yyyy')}
                                {profile.endDate && ` • Fim: ${format(new Date(profile.endDate), 'dd/MM/yyyy')}`}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(profile)}
                            >
                                <Edit2 className="h-4 w-4" />
                            </Button>
                            <DeleteProfileButton
                                accountId={accountId}
                                profileId={profile.id}
                                description={profile.description}
                                onRefresh={onRefresh}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingProfile ? 'Editar Recorrência' : 'Nova Recorrência'}</DialogTitle>
                        <DialogDescription>
                            Configure lançamentos automáticos de receitas ou despesas.
                        </DialogDescription>
                    </DialogHeader>
                    <RecurringProfileForm
                        profile={editingProfile}
                        categories={categories}
                        accountId={accountId}
                        onSuccess={handleSuccess}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DeleteProfileButton({ accountId, profileId, description, onRefresh }: { accountId: string, profileId: string, description: string, onRefresh?: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteRecurringTransactionProfileAction(accountId, profileId);
            if (result.message === 'success') {
                toast({ title: 'Sucesso', description: 'Recorrência excluída com sucesso.' });
                if (onRefresh) onRefresh();
            } else {
                toast({ title: 'Erro', description: 'Erro ao excluir: ' + result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={isPending}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Recorrência?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tem certeza que deseja excluir a recorrência "{description}"? Isso removerá todos os lançamentos futuros pendentes.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? <Spinner size="small" /> : 'Excluir'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function RecurringProfileForm({
    profile,
    categories,
    accountId,
    onSuccess
}: {
    profile: RecurringTransactionProfile | null,
    categories: TransactionCategory[],
    accountId: string,
    onSuccess: () => void
}) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [type, setType] = useState<'income' | 'expense'>(profile?.type || 'expense');
    const [frequency, setFrequency] = useState<string>(profile?.frequency || 'monthly');
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>(profile?.daysOfWeek || [1, 2, 3, 4, 5]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        // Append missing controlled fields
        formData.set('type', type);
        formData.set('frequency', frequency);

        if (frequency === 'daily') {
             formData.set('daysOfWeek', JSON.stringify(daysOfWeek));
        }

        // Add ID if editing
        if (profile) {
            formData.set('id', profile.id);
        } else {
             formData.set('id', crypto.randomUUID());
        }

        startTransition(async () => {
            const result = await saveRecurringTransactionProfileAction(accountId, null, formData);
            if (result.message === 'success') {
                toast({ title: 'Sucesso', description: profile ? 'Recorrência atualizada!' : 'Recorrência criada!' });
                onSuccess();
            } else {
                toast({ title: 'Erro', description: 'Erro: ' + result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Tipo</Label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={type === 'expense' ? 'destructive' : 'outline'}
                            className="w-full"
                            onClick={() => setType('expense')}
                        >
                            Despesa
                        </Button>
                        <Button
                            type="button"
                            variant={type === 'income' ? 'default' : 'outline'}
                            className={cn("w-full", type === 'income' && "bg-green-600 hover:bg-green-700")}
                            onClick={() => setType('income')}
                        >
                            Receita
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="amount">Valor</Label>
                    <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        defaultValue={profile?.amount}
                        placeholder="0,00"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                    id="description"
                    name="description"
                    required
                    defaultValue={profile?.description}
                    placeholder="Ex: Aluguel, Internet..."
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <Select name="categoryId" required defaultValue={profile?.categoryId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories
                            .filter(c => c.type === type)
                            .map(category => (
                                <SelectItem key={category.id} value={category.id}>
                                    <div className="flex items-center gap-2">
                                        {category.color && (
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                                        )}
                                        {category.name}
                                    </div>
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Data do Primeiro Vencimento</Label>
                    <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        required
                        defaultValue={profile?.startDate}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="endDate">Data Fim (Opcional)</Label>
                    <Input
                        id="endDate"
                        name="endDate"
                        type="date"
                        defaultValue={profile?.endDate || ''}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="daily">Diária</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quinzenal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {frequency === 'daily' && (
                <div className="space-y-2 border p-3 rounded-md bg-muted/20">
                    <Label className="text-xs text-muted-foreground uppercase font-bold">Dias da Semana</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {DAYS_OF_WEEK.map(day => (
                            <div key={day.value} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`day-${day.value}`}
                                    checked={daysOfWeek.includes(day.value)}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setDaysOfWeek([...daysOfWeek, day.value]);
                                        } else {
                                            setDaysOfWeek(daysOfWeek.filter(d => d !== day.value));
                                        }
                                    }}
                                />
                                <label
                                    htmlFor={`day-${day.value}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                    {day.label}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <DialogFooter className="pt-4">
                <Button type="submit" disabled={isPending}>
                    {isPending ? 'Salvando...' : (profile ? 'Atualizar' : 'Criar Recorrência')}
                </Button>
            </DialogFooter>
        </form>
    );
}
