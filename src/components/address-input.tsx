
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Skeleton } from './ui/skeleton';
import type { Location } from '@/lib/types';
import { X } from 'lucide-react';

interface AddressInputProps {
  id?: string;
  onInputChange?: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  value: string;
  initialLocation?: { lat: number; lng: number } | null;
  enableSuggestions?: boolean; // default: false
}

export function AddressInput({
  id,
  onInputChange,
  onLocationSelect,
  value,
  onKeyDown,
  initialLocation,
  enableSuggestions = false,
}: AddressInputProps) {
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey || !enableSuggestions,
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
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange?.(e.target.value);
  }

  const handleClear = () => {
    onInputChange?.('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  // Simple input without suggestions
  const renderSimpleInput = () => (
    <div className="relative w-full">
      <Input
        id={id}
        ref={inputRef}
        placeholder="Digite o endereço..."
        value={value}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        className="pr-8"
      />
      {value && (
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
  );

  // If suggestions are disabled, render simple input
  if (!enableSuggestions) {
    return (
      <div className="flex gap-2 items-center w-full">
        <div className="flex-grow">
          {renderSimpleInput()}
        </div>
      </div>
    );
  }

  // If suggestions enabled but not loaded yet
  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  // Render with StandaloneSearchBox for autocomplete
  return (
    <div className="flex gap-2 items-center w-full">
      <div className="flex-grow">
        <StandaloneSearchBox
          onLoad={onLoad}
          onPlacesChanged={onPlacesChanged}
        >
          <div className="relative w-full">
            <Input
              id={id}
              ref={inputRef}
              placeholder="Digite para buscar um endereço..."
              value={value}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              className="pr-8"
            />
            {value && (
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
      </div>
    </div>
  );
}
