
'use client';
import { useState, useEffect, useCallback } from 'react';
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
import type { Location } from '@/lib/types';
import { geocodeAddress, geocodeLatLng } from '@/lib/maps-api';


const containerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: -14.235, // Centered on Brazil
  lng: -51.9253,
};

interface MapDialogProps {
  onLocationSelect: (location: Location) => void;
  initialLocation?: { lat: number; lng: number } | null;
  address?: string; 
}

export function MapDialog({ onLocationSelect, initialLocation, address }: MapDialogProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | undefined>(initialLocation || undefined);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });
  
  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  useEffect(() => {
    if (isOpen && isLoaded) {
      if (initialLocation) {
        setCenter(initialLocation);
        setSelectedPosition(initialLocation);
      } else if (address) {
        geocodeAddress(address).then(location => {
            if (location) {
                const newCenter = { lat: location.lat, lng: location.lng };
                setCenter(newCenter);
                setSelectedPosition(newCenter);
                if (map) map.panTo(newCenter);
            }
        });
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newCenter = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setCenter(newCenter);
            if (map) {
              map.panTo(newCenter);
            }
          }
        );
      }
    }
  }, [isOpen, map, isLoaded, initialLocation, address]);

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      setSelectedPosition({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      });
    }
  };

  const handleConfirm = async () => {
    if (!selectedPosition) return;
    setIsGeocoding(true);
    const locationData = await geocodeLatLng(selectedPosition);
    setIsGeocoding(false);
    onLocationSelect(locationData);
    setIsOpen(false);
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
        center={center}
        zoom={initialLocation || address ? 17 : 10}
        onLoad={onMapLoad}
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
