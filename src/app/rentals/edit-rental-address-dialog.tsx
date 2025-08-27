
'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateRentalAction } from '@/lib/actions';
import type { PopulatedRental, Location } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapDialog } from '@/components/map-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Spinner } from '@/components/ui/spinner';

interface EditRentalDialogProps {
  rental: PopulatedRental;
  children: React.ReactNode;
}

export function EditRentalAddressDialog({ rental, children }: EditRentalDialogProps) {
  const { accountId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [deliveryAddress, setDeliveryAddress] = useState(rental.deliveryAddress);
  const [location, setLocation] = useState<Omit<Location, 'address'> | null>(
     rental.latitude && rental.longitude ? { lat: rental.latitude, lng: rental.longitude } : null
  );
  
  const [errors, setErrors] = useState<any>({});
  const { toast } = useToast();

  const handleLocationSelect = (selectedLocation: Location) => {
    setLocation({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    setDeliveryAddress(selectedLocation.address);
  };

  const handleFormAction = (formData: FormData) => {
    startTransition(async () => {
      if (!accountId) {
        toast({ title: 'Erro', description: 'Conta não identificada.', variant: 'destructive' });
        return;
      }
      
      if (location) {
        formData.set('latitude', String(location.lat));
        formData.set('longitude', String(location.lng));
      }
      
      const boundAction = updateRentalAction.bind(null, accountId);
      const result = await boundAction(null, formData);

      if (result.errors) {
        setErrors(result.errors);
        const errorMessages = Object.values(result.errors).flat().join(' ');
        toast({
          title: 'Erro de Validação',
          description: errorMessages,
          variant: 'destructive',
        });
      } else if (result.message === 'error') {
         toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Endereço da OS atualizado.' });
        setIsOpen(false);
      }
    });
  };

  useEffect(() => {
    // Reset form if dialog is closed without saving
    if (!isOpen) {
      setDeliveryAddress(rental.deliveryAddress);
      setLocation(rental.latitude && rental.longitude ? { lat: rental.latitude, lng: rental.longitude } : null);
      setErrors({});
    }
  }, [isOpen, rental]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Endereço da OS</DialogTitle>
        </DialogHeader>
        <form action={handleFormAction} className="space-y-4 pt-4">
            <input type="hidden" name="id" value={rental.id} />
            
            <div className="space-y-2">
                <Label htmlFor="deliveryAddress">Endereço de Entrega</Label>
                <div className="flex gap-2">
                <Textarea id="deliveryAddress" name="deliveryAddress" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />
                <MapDialog onLocationSelect={handleLocationSelect} />
                </div>
                {location && (
                <p className="text-sm text-muted-foreground">
                    Coordenadas selecionadas: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
                )}
                {errors?.deliveryAddress && <p className="text-sm font-medium text-destructive">{errors.deliveryAddress[0]}</p>}
            </div>

            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Spinner size="small" /> : 'Salvar Endereço'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
