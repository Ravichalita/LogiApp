
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Skeleton } from './ui/skeleton';
import type { Location } from '@/lib/types';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { MapDialog } from './map-dialog';

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
  value: controlledValue,
  initialLocation,
}: AddressInputProps) {
  const [searchValue, setSearchValue] = useState(initialValue);
  const [selectedAddress, setSelectedAddress] = useState(initialValue);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const value = controlledValue ?? initialValue;
    setSearchValue(value);
    setSelectedAddress(value);
  }, [controlledValue, initialValue]);

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
        const locationData: Location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address,
        };
        
        onLocationSelect(locationData);
        onInputChange?.(locationData.address);

        setSearchValue(locationData.address);
        setSelectedAddress(locationData.address);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    if(newValue === '') {
        setSelectedAddress('');
        onInputChange?.('');
    }
  }

  const handleClear = () => {
      setSearchValue('');
      setSelectedAddress('');
      onInputChange?.('');
      if(inputRef.current) {
          inputRef.current.focus();
      }
  }

  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className="space-y-2">
       <div className="flex gap-2 items-center w-full">
            <StandaloneSearchBox
                onLoad={onLoad}
                onPlacesChanged={onPlacesChanged}
            >
                <div className="relative w-full">
                <Input
                    id={id}
                    ref={inputRef}
                    placeholder="Digite para buscar um endereço..."
                    value={searchValue}
                    onChange={handleInputChange}
                    className="pr-8"
                />
                {searchValue && (
                    <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 flex items-center pr-2"
                    aria-label="Limpar endereço"
                    >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                )}
                </div>
            </StandaloneSearchBox>
            <MapDialog onLocationSelect={onLocationSelect} initialLocation={initialLocation} />
      </div>
      {selectedAddress && (
        <div className="p-3 min-h-[60px] text-sm rounded-md border bg-muted">
          {selectedAddress}
        </div>
      )}
    </div>
  );
}
