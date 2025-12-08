
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Edit, Plus, ArrowLeft } from 'lucide-react';
import { TransactionCategory } from '@/lib/types';
import { createCategoryAction, updateCategoryAction, deleteCategoryAction } from '@/lib/finance-actions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ManageCategories({
    categories,
    onClose,
    onRefresh,
    onCategoryChange
}: {
    categories: TransactionCategory[],
    onClose?: () => void,
    onRefresh?: () => void,
    onCategoryChange?: (category: TransactionCategory | null, action: 'create' | 'update' | 'delete') => void
}) {
    const { accountId } = useAuth();
    const { toast } = useToast();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!accountId) return;
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            type: formData.get('type') as 'income' | 'expense',
            color: formData.get('color') as string,
        };

        let result;
        if (editingCategory) {
            result = await updateCategoryAction(accountId, { ...editingCategory, ...data });
        } else {
            result = await createCategoryAction(accountId, data);
        }

        setLoading(false);

        if (result.message === 'success') {
            toast({ title: 'Sucesso', description: 'Categoria salva.' });

            if (result.category && onCategoryChange) {
                onCategoryChange(result.category, editingCategory ? 'update' : 'create');
            } else if (onRefresh) {
                onRefresh();
            }

            setView('list');
            setEditingCategory(null);
        } else {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!accountId) return;
        if (!confirm('Tem certeza? Isso pode afetar relatórios de transações antigas.')) return;

        const result = await deleteCategoryAction(accountId, id);
        if (result.message === 'success') {
            toast({ title: 'Sucesso', description: 'Categoria excluída.' });
            if (onCategoryChange) {
                onCategoryChange({ id } as TransactionCategory, 'delete');
            } else if (onRefresh) {
                onRefresh();
            }
        } else {
            toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        }
    };

    if (view === 'form') {
        return (
            <>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => { setView('list'); setEditingCategory(null); }}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" name="name" required defaultValue={editingCategory?.name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type">Tipo</Label>
                        <Select name="type" defaultValue={editingCategory?.type || 'expense'}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="income">Receita</SelectItem>
                                <SelectItem value="expense">Despesa</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="color">Cor</Label>
                        <div className="flex gap-2">
                            <Input id="color" name="color" type="color" className="w-12 p-1 h-9" defaultValue={editingCategory?.color || '#000000'} />
                            <Input type="text" readOnly value="Selecione a cor" className="flex-1 text-muted-foreground" tabIndex={-1} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => { setView('list'); setEditingCategory(null); }}>Cancelar</Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Spinner size="small" className="mr-2" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </>
        );
    }

    return (
        <>
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <DialogTitle>Gerenciar Categorias</DialogTitle>
                <Button size="sm" onClick={() => { setEditingCategory(null); setView('form'); }}>
                    <Plus className="mr-2 h-4 w-4" /> Nova
                </Button>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] py-2">
                <div className="space-y-4">
                    <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground uppercase text-xs tracking-wider">Receitas</h4>
                        <div className="space-y-2">
                            {categories.filter(c => c.type === 'income').map(c => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/40 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#22c55e' }} />
                                        <span className="font-medium">{c.name}</span>
                                        {c.isDefault && <Badge variant="outline" className="text-[10px] h-5">Padrão</Badge>}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(c); setView('form'); }}>
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        {!c.isDefault && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {categories.filter(c => c.type === 'income').length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-2 italic">Nenhuma categoria.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground uppercase text-xs tracking-wider">Despesas</h4>
                        <div className="space-y-2">
                            {categories.filter(c => c.type === 'expense').map(c => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-md border bg-muted/40 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color || '#ef4444' }} />
                                        <span className="font-medium">{c.name}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(c); setView('form'); }}>
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                             {categories.filter(c => c.type === 'expense').length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-2 italic">Nenhuma categoria.</p>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>
             <DialogFooter className="mt-4">
                 <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
            </DialogFooter>
        </>
    );
}
