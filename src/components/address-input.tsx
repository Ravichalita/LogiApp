
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { Textarea } from './ui/textarea';

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
  // Start in editing mode if there's no initial value, otherwise start in display mode.
  const [isEditing, setIsEditing] = useState(!initialValue && !value);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const [currentLocation, setCurrentLocation] = useState(initialLocation);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
      // If a new value is passed (e.g., from selecting a client), switch to display mode.
      if (value) {
        setIsEditing(false);
      }
    }
  }, [value]);
  
  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
    }
  }, [initialLocation]);

  useEffect(() => {
    // When switching to editing mode, focus the input field to allow immediate typing.
    if (isEditing) {
      // Use a timeout to ensure the input is rendered before trying to focus it.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing]);

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
        setInputValue(place.formatted_address);
        onLocationSelect(locationData);
        setCurrentLocation({ lat: locationData.lat, lng: locationData.lng });
        onInputChange?.(place.formatted_address);
        setIsEditing(false); // Switch to display mode (Textarea)
      }
    }
  };

  // Handles text change for both Input and Textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onInputChange?.(newValue);
  };
  
  const switchToEditing = () => {
    setIsEditing(true);
  }

  if (!isLoaded) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div className="flex gap-2 items-start">
        <div className="flex-grow relative">
          {isEditing ? (
            <StandaloneSearchBox
              onLoad={onLoad}
              onPlacesChanged={onPlacesChanged}
            >
              <Input
                ref={inputRef}
                id={id}
                value={inputValue}
                onChange={handleTextChange}
                placeholder="Digite para buscar o endereço..."
                required
                className="w-full"
                autoComplete="off"
              />
            </StandaloneSearchBox>
          ) : (
            <Textarea
              id={id}
              value={inputValue}
              onChange={handleTextChange}
              onFocus={switchToEditing}
              onClick={switchToEditing}
              placeholder="Endereço selecionado"
              rows={3}
              className="w-full cursor-text"
              required
            />
          )}
        </div>
        <MapDialog
          onLocationSelect={(location) => {
            onLocationSelect(location);
            setInputValue(location.address);
            setCurrentLocation(location);
            setIsEditing(false);
          }}
          initialLocation={currentLocation}
        />
      </div>
    </div>
  );
}
