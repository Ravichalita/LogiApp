
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

interface AddressInputProps {
  id?: string;
  value: string;
  onInputChange: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  initialLocation?: { lat: number; lng: number } | null;
}

export function AddressInput({ id, value, onInputChange, onLocationSelect, initialLocation }: AddressInputProps) {
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const onPlacesChanged = () => {
    const places = searchBox?.getPlaces();
    if (places && places.length > 0) {
      const place = places[0];
      if (place.geometry?.location && place.formatted_address) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address,
        };
        onLocationSelect(location);
      }
    }
  };

  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className="flex gap-2 w-full">
      <div className="flex-grow">
        <StandaloneSearchBox
          onLoad={setSearchBox}
          onPlacesChanged={onPlacesChanged}
          bounds={new google.maps.LatLngBounds(
              new google.maps.LatLng(-34.0, -74.0), // Approximate SW corner of Brazil
              new google.maps.LatLng(5.0, -34.0)   // Approximate NE corner of Brazil
          )}
        >
          <Input
            id={id}
            value={value}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Digite o endereço..."
            required
            className="w-full"
            autoComplete="off"
          />
        </StandaloneSearchBox>
      </div>
      <MapDialog
        onLocationSelect={onLocationSelect}
        initialLocation={initialLocation}
      />
    </div>
  );
}
