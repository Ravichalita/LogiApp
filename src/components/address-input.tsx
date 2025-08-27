
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

interface AddressInputProps {
  id?: string;
  initialValue: string;
  onLocationSelect: (location: Location) => void;
}

export function AddressInput({ id, initialValue, onLocationSelect }: AddressInputProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places'],
    preventLoad: !googleMapsApiKey,
  });

  const handlePlaceSelect = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry?.location && place.formatted_address) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address,
        };
        setInputValue(location.address);
        onLocationSelect(location);
      }
    }
  };

  useEffect(() => {
    setInputValue(initialValue);
  }, [initialValue]);

  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className="flex gap-2">
      <Autocomplete
        onLoad={(ac) => setAutocomplete(ac)}
        onPlaceChanged={handlePlaceSelect}
        options={{
            componentRestrictions: { country: 'br' }, // Restrict to Brazil
            fields: ['formatted_address', 'geometry.location'] // Optimize by fetching only needed data
        }}
      >
        <Input
          id={id}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Digite o endereço..."
          required
        />
      </Autocomplete>
      <MapDialog
        onLocationSelect={onLocationSelect}
        initialLocation={
          autocomplete?.getPlace()?.geometry?.location?.toJSON() || null
        }
      />
    </div>
  );
}
