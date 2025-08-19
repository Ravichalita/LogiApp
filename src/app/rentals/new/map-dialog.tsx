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

const containerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: -14.235,
  lng: -51.9253,
};

interface MapDialogProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
}

export function MapDialog({ onLocationSelect }: MapDialogProps) {
  const [selectedPosition, setSelectedPosition] = useState<
    { lat: number; lng: number } | undefined
  >();
  const [isOpen, setIsOpen] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      setSelectedPosition({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      });
    }
  };

  const handleConfirm = () => {
    if (selectedPosition) {
      onLocationSelect(selectedPosition);
    }
    setIsOpen(false);
  };
  
  const renderMap = () => {
    if (loadError) {
      return <div>Erro ao carregar o mapa. Verifique a chave da API.</div>;
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
          <Button onClick={handleConfirm} disabled={!selectedPosition}>
            Confirmar Localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
