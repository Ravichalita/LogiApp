
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface AddressInputProps {
  id?: string;
  initialValue?: string;
  onInputChange?: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  initialLocation?: { lat: number; lng: number } | null;
  className?: string;
  value?: string;
}

export function AddressInput({ id, initialValue = '', onInputChange, onLocationSelect, initialLocation, className, value }: AddressInputProps) {
  const [inputValue, setInputValue] = useState(value ?? initialValue);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const [currentLocation, setCurrentLocation] = useState(initialLocation);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, [value]);
  
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
        onLocationSelect(locationData);
        setInputValue(place.formatted_address);
        setCurrentLocation({ lat: locationData.lat, lng: locationData.lng });
        onInputChange?.(place.formatted_address);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onInputChange?.(e.target.value);
  }


  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div className="flex gap-2 items-start">
        <div className="flex-grow">
            <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
            >
            <Input
                id={id}
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Digite o endereço..."
                required
                className="w-full"
                autoComplete="off"
            />
            </StandaloneSearchBox>
        </div>
        <MapDialog
          onLocationSelect={onLocationSelect}
          initialLocation={currentLocation}
        />
      </div>
    </div>
  );
}
