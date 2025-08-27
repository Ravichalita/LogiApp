
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Edit } from 'lucide-react';

interface AddressInputProps {
  id?: string;
  initialValue?: string;
  onInputChange?: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  initialLocation?: { lat: number; lng: number } | null;
  className?: string;
  value?: string; // Controlled value from parent
}

export function AddressInput({ 
  id, 
  initialValue = '', 
  onInputChange, 
  onLocationSelect, 
  initialLocation, 
  className,
  value: controlledValue 
}: AddressInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? initialValue);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const [currentLocation, setCurrentLocation] = useState(initialLocation);

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
    }
  }, [initialLocation]);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const onLoad = useCallback((ref: google.maps.places.SearchBox) => {
    setSearchBox(ref);
  }, []);

  const onPlacesChanged = () => {
    const places = searchBox?.getPlaces();
    if (places && places.length > 0) {
      const place = places[0];
      if (place.geometry?.location && place.formatted_address) {
        const locationData = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address,
        };
        setInternalValue(place.formatted_address);
        setCurrentLocation({ lat: locationData.lat, lng: locationData.lng });
        onLocationSelect(locationData);
        onInputChange?.(place.formatted_address);
        setIsDialogOpen(false); 
      }
    }
  };
  
  const handleMapLocationSelect = (location: Location) => {
    setInternalValue(location.address);
    setCurrentLocation({ lat: location.lat, lng: location.lng });
    onLocationSelect(location);
    onInputChange?.(location.address);
    setIsDialogOpen(false);
  }

  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }
  
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <div className={cn("relative w-full", className)}>
            <Textarea
                id={id}
                value={internalValue}
                onClick={() => setIsDialogOpen(true)}
                readOnly
                placeholder="Clique para adicionar um endereço..."
                rows={3}
                className="w-full cursor-pointer pr-10"
                required
            />
             <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Endereço</span>
                </Button>
            </DialogTrigger>
        </div>

        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>Buscar Endereço</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 items-center py-4">
                <div className="flex-grow">
                     <StandaloneSearchBox
                        onLoad={onLoad}
                        onPlacesChanged={onPlacesChanged}
                        >
                        <Input
                            placeholder="Digite o endereço..."
                            className="w-full"
                            autoFocus
                        />
                    </StandaloneSearchBox>
                </div>
                <MapDialog 
                  onLocationSelect={handleMapLocationSelect} 
                  initialLocation={currentLocation}
                />
            </div>
             <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                    Fechar
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
