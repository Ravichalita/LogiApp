
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateMapSettingsAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import type { Account } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Salvando...
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          Salvar Configurações
        </>
      )}
    </Button>
  );
}

interface MapSettingsFormProps {
  account: Account;
}

export function MapSettingsForm({ account }: MapSettingsFormProps) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<'google' | 'locationiq'>(account.geocodingProvider || 'locationiq');
  const [enabled, setEnabled] = useState(account.isGeocodingEnabled ?? true);
  const updateWithId = updateMapSettingsAction.bind(null, account.id);
  const [state, formAction] = useActionState(updateWithId, { message: '' });

  useEffect(() => {
    if (state?.message === 'success') {
      toast({
        title: 'Sucesso',
        description: 'Configurações de mapa atualizadas.',
        className: 'bg-green-500 text-white',
      });
    } else if (state?.message === 'error') {
      toast({
        title: 'Erro',
        description: state.error || 'Erro ao atualizar configurações.',
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  // Sync state with prop if it changes (revalidation)
  useEffect(() => {
      setProvider(account.geocodingProvider || 'locationiq');
      setEnabled(account.isGeocodingEnabled ?? true);
  }, [account.geocodingProvider, account.isGeocodingEnabled]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
            <Switch
                id="isGeocodingEnabled"
                name="isGeocodingEnabled"
                checked={enabled}
                onCheckedChange={setEnabled}
            />
            <Label htmlFor="isGeocodingEnabled">Ativar Sugestões de Endereço (Autocomplete)</Label>
        </div>

        <div className={enabled ? '' : 'opacity-50 pointer-events-none'}>
            <div className="space-y-2">
                <Label>Provedor de Geocodificação</Label>
                <RadioGroup
                    name="geocodingProvider"
                    value={provider}
                    onValueChange={(v) => setProvider(v as 'google' | 'locationiq')}
                    className="flex flex-col space-y-1"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="locationiq" id="provider-locationiq" />
                        <Label htmlFor="provider-locationiq" className="font-normal cursor-pointer">
                            LocationIQ (Recomendado / Gratuito)
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="google" id="provider-google" />
                        <Label htmlFor="provider-google" className="font-normal cursor-pointer">
                            Google Maps (Requer chave de API paga)
                        </Label>
                    </div>
                </RadioGroup>
            </div>
        </div>

        {provider === 'google' && enabled && (
            <div className="space-y-2 pt-2">
                <Label htmlFor="googleMapsApiKey">Chave de API do Google Maps</Label>
                <Input
                    id="googleMapsApiKey"
                    name="googleMapsApiKey"
                    type="password"
                    placeholder="AIzaSy..."
                    defaultValue={account.googleMapsApiKey || ''}
                />
                 <p className="text-xs text-muted-foreground">
                    Necessária para usar o autocompletar e mapas do Google. Deixe em branco para usar a variável de ambiente do servidor (se configurada).
                </p>
            </div>
        )}

        {provider === 'locationiq' && (
             <div className="space-y-2 pt-2">
                <Label htmlFor="locationIqToken">Token do LocationIQ</Label>
                <Input
                    id="locationIqToken"
                    name="locationIqToken"
                    type="password"
                    placeholder="pk.7b73..."
                    defaultValue={account.locationIqToken || ''}
                />
                <p className="text-xs text-muted-foreground">
                    Chave pública para o autocompletar de endereços. Deixe em branco para usar a chave padrão.
                </p>
            </div>
        )}
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
