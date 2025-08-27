
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { MapDialog } from '@/components/map-dialog';
import type { Location } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from './ui/command';

interface AddressInputProps {
  id?: string;
  value: string;
  onInputChange: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  initialLocation?: { lat: number; lng: number } | null;
}

export function AddressInput({ id, value, onInputChange, onLocationSelect, initialLocation }: AddressInputProps) {
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const [predictions, setPredictions] = useState<google.maps.places.PlaceResult[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const onPlacesChanged = () => {
    const places = searchBox?.getPlaces();
    if (places && places.length > 0) {
      setPredictions(places);
      setIsPopoverOpen(true);
    } else {
        setPredictions([]);
        setIsPopoverOpen(false);
    }
  };

  const handleSelectPrediction = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location && place.formatted_address) {
      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        address: place.formatted_address,
      };
      onLocationSelect(location);
      setIsPopoverOpen(false);
    }
  };

  useEffect(() => {
    if (value === '') {
        setPredictions([]);
        setIsPopoverOpen(false);
    }
  }, [value]);
  
  const handleInputBlur = () => {
    // A small delay is necessary to allow the click event on the suggestion to register
    setTimeout(() => {
        setIsPopoverOpen(false);
    }, 150);
  }


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
          <Popover open={isPopoverOpen && predictions.length > 0} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                {/* This trigger is now a wrapper and doesn't render anything itself,
                    allowing the Input below to be the main interactive element. */}
                <div />
            </PopoverTrigger>
             <Input
                ref={inputRef}
                id={id}
                value={value}
                onChange={(e) => onInputChange(e.target.value)}
                onBlur={handleInputBlur}
                placeholder="Digite o endereço..."
                required
                className="w-full"
                autoComplete="off"
            />
            <PopoverContent className="p-0 border-0 shadow-md">
                 <Command>
                    <CommandList>
                    {predictions.map((place, index) => (
                        <CommandItem 
                            key={place.id || index} 
                            onSelect={() => handleSelectPrediction(place)}
                            className="cursor-pointer"
                        >
                            {place.name}
                            <span className="text-xs text-muted-foreground ml-2 truncate">{place.formatted_address?.replace(`${place.name}, `, '')}</span>
                        </CommandItem>
                    ))}
                    </CommandList>
                </Command>
            </PopoverContent>
          </Popover>
        </StandaloneSearchBox>
      </div>
      <MapDialog
        onLocationSelect={onLocationSelect}
        initialLocation={initialLocation}
      />
    </div>
  );
}
