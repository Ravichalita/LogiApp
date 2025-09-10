
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Location, Account, Base } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { AddressInput } from '@/components/address-input';
import { updateBasesAction } from '@/lib/actions';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useDebounce } from 'use-debounce';

export function BaseAddressForm({ account }: { account: Account }) {
  const { accountId } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const [bases, setBases] = useState<Base[]>(account.bases || []);
  const [debouncedBases] = useDebounce(bases, 1000); // Debounce state changes by 1 second

  // Ref to track if it's the initial load
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!account.bases || account.bases.length === 0) {
      setBases([{ id: nanoid(5), name: 'Principal', address: '' }]);
    } else {
      setBases(account.bases);
    }
  }, [account.bases]);
  
  // This effect will run when debouncedBases changes, triggering a save.
  useEffect(() => {
    // Skip the very first render
    if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
    }
    handleSave();
  }, [debouncedBases]);
  
  const handleSave = () => {
    if (isPending) return;

    startTransition(async () => {
      if (!accountId) return;

      const validBases = bases.filter(b => b.name.trim() !== '' && b.address.trim() !== '');

      const result = await updateBasesAction(accountId, validBases);
      if (result.message === 'error') {
         toast({ title: 'Erro ao Salvar', description: result.error, variant: 'destructive' });
      } else {
         // The toast on save is a bit noisy, so we can comment it out or make it more subtle
         // toast({ title: 'Salvo!', description: 'Endereços das bases atualizados.' });
      }
    });
  };
  
  const handleBaseChange = <K extends keyof Base>(id: string, field: K, value: Base[K]) => {
      setBases(currentBases =>
          currentBases.map(b => (b.id === id ? { ...b, [field]: value } : b))
      );
  };
  
  const handleLocationSelect = (id: string, location: Location) => {
    setBases(currentBases =>
      currentBases.map(b =>
        b.id === id
          ? { ...b, address: location.address, latitude: location.lat, longitude: location.lng }
          : b
      )
    );
  };

  const addBase = () => {
      setBases(prev => [...prev, { id: nanoid(5), name: '', address: '' }]);
  }
  
  const removeBase = (id: string) => {
      setBases(prev => prev.filter(b => b.id !== id));
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {bases.map((base, index) => (
                <div key={base.id} className="p-3 border rounded-lg space-y-3 relative bg-muted/50">
                    {bases.length > 1 && (
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeBase(base.id)}
                            aria-label="Remover Base"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-1">
                            <Label htmlFor={`base-name-${base.id}`}>Nome da Base</Label>
                            <Input
                                id={`base-name-${base.id}`}
                                placeholder={`Ex: Garagem ${index + 1}`}
                                value={base.name}
                                onChange={(e) => handleBaseChange(base.id, 'name', e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor={`base-address-${base.id}`}>Endereço</Label>
                            <AddressInput
                                id={`base-address-${base.id}`}
                                value={base.address}
                                onInputChange={(value) => handleBaseChange(base.id, 'address', value)}
                                onLocationSelect={(location) => handleLocationSelect(base.id, location)}
                                onKeyDown={handleKeyDown}
                                initialLocation={base.latitude && base.longitude ? { lat: base.latitude, lng: base.longitude } : null}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addBase}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Nova Base
        </Button>
         <Button type="submit" className="hidden">Salvar</Button>
    </form>
  );
}
