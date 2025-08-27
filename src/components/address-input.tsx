
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface AddressInputProps {
  id?: string;
  value: string;
  onInputChange: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  initialLocation?: { lat: number; lng: number } | null;
  className?: string;
}

export function AddressInput({ id, value, onInputChange, onLocationSelect, initialLocation, className }: AddressInputProps) {
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const onLoad = useCallback((ref: google.maps.places.SearchBox) => {
    if (portalRef.current) {
      // This is the key: we find the .pac-container and move it into our portal div
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer) {
        portalRef.current.appendChild(pacContainer);
        pacContainer.classList.add('relative'); // Ensure it's positioned correctly within the portal
      }
    }
    setSearchBox(ref);
  }, []);

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

  useEffect(() => {
    // This effect ensures that when the component unmounts (e.g., dialog is closed),
    // we move the .pac-container back to the body to avoid memory leaks.
    isMounted.current = true;
    return () => {
      if (isMounted.current) {
        const pacContainer = portalRef.current?.querySelector('.pac-container');
        if (pacContainer) {
          document.body.appendChild(pacContainer);
        }
      }
    };
  }, []);


  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div className="flex gap-2">
        <StandaloneSearchBox
          onLoad={onLoad}
          onPlacesChanged={onPlacesChanged}
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
        <MapDialog
          onLocationSelect={onLocationSelect}
          initialLocation={initialLocation}
        />
      </div>
      {/* This div is the portal where suggestions will be rendered */}
      <div ref={portalRef} className="absolute z-50 w-full" />
    </div>
  );
}
