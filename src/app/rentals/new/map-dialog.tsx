
'use client';
import { useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
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
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const containerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: -14.235,
  lng: -51.9253,
};

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface MapDialogProps {
  onLocationSelect: (location: Location) => void;
}

export function MapDialog({ onLocationSelect }: MapDialogProps) {
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | undefined>();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      setSelectedPosition({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      });
    }
  };

  const handleConfirm = async () => {
    if (!selectedPosition || !window.google) return;

    setIsGeocoding(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: selectedPosition }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results && results[0]) {
        onLocationSelect({
          ...selectedPosition,
          address: results[0].formatted_address,
        });
        setIsOpen(false);
      } else {
        console.error(`Geocode was not successful for the following reason: ${status}`);
        // Fallback if geocoding fails
        onLocationSelect({
          ...selectedPosition,
          address: `Coordenadas: ${selectedPosition.lat.toFixed(6)}, ${selectedPosition.lng.toFixed(6)}`,
        });
        setIsOpen(false);
      }
    });
  };

  const renderMap = () => {
    if (!googleMapsApiKey) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Chave da API do Google Maps ausente</AlertTitle>
          <AlertDescription>
            <p>A chave da API do Google Maps não foi configurada. Por favor, adicione sua chave ao arquivo `.env.local` com o nome `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para ativar o mapa.</p>
            <p className="mt-2 text-xs">Exemplo: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI`</p>
          </AlertDescription>
        </Alert>
      );
    }

    if (loadError) {
      return (
         <Alert variant="destructive">
          <AlertTitle>Erro ao Carregar o Mapa</AlertTitle>
          <AlertDescription>
           Não foi possível carregar o Google Maps. Verifique se a sua chave da API é válida, se as APIs "Maps JavaScript API" e "Geocoding API" estão ativadas e se a fatura está configurada no seu projeto do Google Cloud.
          </AlertDescription>
        </Alert>
      );
    }

    if (!isLoaded) {
      return <Skeleton className="h-[400px] w-full" />;
    }

    return (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={4}
        onClick={handleMapClick}
      >
        {selectedPosition && <Marker position={selectedPosition} />}
      </GoogleMap>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <MapPin className="h-4 w-4" />
          <span className="sr-only">Localizar no Mapa</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecione a Localização no Mapa</DialogTitle>
        </DialogHeader>
        <div className="py-4">{renderMap()}</div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!selectedPosition || !googleMapsApiKey || isGeocoding}>
            {isGeocoding ? 'Buscando endereço...' : 'Confirmar Localização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
