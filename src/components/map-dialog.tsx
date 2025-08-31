

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
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
import { MapPin, Route } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Location } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
}

export function MapDialog({ onLocationSelect, initialLocation, origin, destination }: MapDialogProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | undefined>(initialLocation || undefined);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const { toast } = useToast();
  
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const isRouteMap = origin && destination;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding', 'routes'],
    preventLoad: !googleMapsApiKey,
  });
  
  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const calculateRoute = useCallback(() => {
    if (!isRouteMap || !window.google) return;
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.lat, destination.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
          if (result?.routes[0]?.legs[0]) {
            setDistance(result.routes[0].legs[0].distance?.text || null);
            setDuration(result.routes[0].legs[0].duration?.text || null);
          }
        } else {
          console.error(`Directions request failed due to ${status}`);
          toast({ title: "Erro", description: "Não foi possível calcular a rota.", variant: "destructive" });
        }
      }
    );
  }, [origin, destination, isRouteMap, toast]);


  useEffect(() => {
    if (isOpen && !initialLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(newCenter);
          if (map) map.panTo(newCenter);
        },
        () => console.log("User denied Geolocation")
      );
    } else if (initialLocation) {
        setCenter(initialLocation);
        setSelectedPosition(initialLocation);
    }
  }, [isOpen, map, initialLocation]);

  useEffect(() => {
      if (isOpen && isRouteMap) {
          calculateRoute();
      } else if (isOpen) {
          setDirections(null);
      }
  }, [isOpen, isRouteMap, calculateRoute]);

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (isRouteMap || !event.latLng) return;
    
    const newPos = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };
    setSelectedPosition(newPos);
    // For selection maps, we confirm immediately.
    handleConfirm(newPos);
  };

  const handleConfirm = async (positionToConfirm?: { lat: number; lng: number }) => {
    const position = positionToConfirm || selectedPosition;
    if (!position || !window.google) return;

    setIsGeocoding(true);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: position }, (results, status) => {
      setIsGeocoding(false);
      if (status === 'OK' && results && results[0]) {
        onLocationSelect({
          ...position,
          address: results[0].formatted_address,
        });
        setIsOpen(false);
      } else {
        console.error(`Geocode was not successful for the following reason: ${status}`);
        onLocationSelect({
          ...position,
          address: `Coordenadas: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
        });
        setIsOpen(false);
      }
    });
  };
  
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && !isRouteMap) {
        // Reset state when closing if not a directions map
        setSelectedPosition(initialLocation || undefined);
    }
  }

  const renderMap = () => {
    if (!googleMapsApiKey) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Chave da API do Google Maps ausente</AlertTitle>
          <AlertDescription>
            <p>A chave da API do Google Maps não foi configurada. Por favor, adicione sua chave ao arquivo `.env.local` com o nome `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para ativar o mapa.</p>
          </AlertDescription>
        </Alert>
      );
    }

    if (loadError) {
      return (
         <Alert variant="destructive">
          <AlertTitle>Erro ao Carregar o Mapa</AlertTitle>
          <AlertDescription>
           Não foi possível carregar o Google Maps. Verifique sua chave da API e as configurações do projeto.
          </AlertDescription>
        </Alert>
      );
    }

    if (!isLoaded) {
      return <Skeleton className="h-[400px] w-full" />;
    }

    return (
        <div className="relative">
             <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={directions ? undefined : 15}
                onLoad={onMapLoad}
                onClick={handleMapClick}
                options={{
                    disableDefaultUI: isRouteMap,
                    clickableIcons: !isRouteMap,
                }}
            >
                {directions ? (
                    <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />
                ) : selectedPosition ? (
                    <Marker position={selectedPosition} />
                ) : null}

                {origin && <Marker position={origin} label="A" />}
                {destination && <Marker position={destination} label="B" />}
            </GoogleMap>
            {distance && duration && (
                <div className="absolute bottom-2 left-2 bg-background p-2 rounded-md shadow-lg text-xs font-medium">
                    <p>Distância: {distance}</p>
                    <p>Duração: {duration}</p>
                </div>
            )}
        </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          {isRouteMap ? <Route className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
          <span className="sr-only">{isRouteMap ? "Ver Rota" : "Localizar no Mapa"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isRouteMap ? "Rota da Operação" : "Selecione a Localização no Mapa"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">{renderMap()}</div>
        {!isRouteMap && (
            <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => handleConfirm()} disabled={!selectedPosition || !googleMapsApiKey || isGeocoding}>
                {isGeocoding ? 'Buscando endereço...' : 'Confirmar Localização'}
            </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
