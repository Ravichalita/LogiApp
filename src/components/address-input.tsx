
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Skeleton } from './ui/skeleton';
import type { Location } from '@/lib/types';
import { X, Loader2, MapPin } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

interface AddressInputProps {
  id?: string;
  onInputChange?: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  value: string;
  initialLocation?: { lat: number; lng: number } | null;
  enableSuggestions?: boolean; // default: false
  provider?: 'google' | 'locationiq';
  disabled?: boolean;
}

// Custom debounce hook
function useDebounceValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function AddressInput({
  id,
  onInputChange,
  onLocationSelect,
  value,
  onKeyDown,
  initialLocation,
  enableSuggestions = false,
  provider = 'locationiq', // Default to LocationIQ as requested
  disabled = false,
}: AddressInputProps) {
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // LocationIQ State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingIQ, setIsLoadingIQ] = useState(false);

  const debouncedSearchTerm = useDebounceValue(value, 500); // 500ms Debounce

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const locationIqToken = process.env.NEXT_PUBLIC_LOCATIONIQ_TOKEN || 'pk.7b731f867a11326a628704e56212defb'; // Use env or fallback to provided token

  // Google Maps Loader
  // We must always pass the same API key options to prevent "Loader must not be called again with different options" error.
  // We control the *rendering* of the Google components based on the provider, not the loading of the script.
  const { isLoaded: isGoogleLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || '',
    libraries: ['places', 'geocoding'],
  });

  const shouldRenderGoogle = provider === 'google' && enableSuggestions && !disabled && !!googleMapsApiKey;

  // LocationIQ Effect
  useEffect(() => {
    if (disabled || !enableSuggestions || provider !== 'locationiq' || !debouncedSearchTerm || debouncedSearchTerm.length < 3) {
      setSuggestions([]);
      // Only close if we are not typing anymore (handled by other logic? No, close if criteria not met)
      if (debouncedSearchTerm.length < 3) setIsOpen(false);
      return;
    }

    const fetchLocationIqSuggestions = async () => {
      setIsLoadingIQ(true);
      try {
        const response = await fetch(
          `https://api.locationiq.com/v1/autocomplete?key=${locationIqToken}&q=${encodeURIComponent(debouncedSearchTerm)}&limit=5&dedupe=1&tag=place:city,place:town,place:village,road`
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setIsOpen(data.length > 0);
        } else {
            console.error("LocationIQ Error:", response.statusText);
            setSuggestions([]);
        }
      } catch (error) {
        console.error("Failed to fetch LocationIQ suggestions:", error);
        setSuggestions([]);
      } finally {
        setIsLoadingIQ(false);
      }
    };

    fetchLocationIqSuggestions();
  }, [debouncedSearchTerm, disabled, enableSuggestions, provider, locationIqToken]);


  const onLoadGoogle = useCallback((ref: google.maps.places.SearchBox) => {
    setSearchBox(ref);
  }, []);

  const onPlacesChangedGoogle = () => {
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

  const handleLocationIqSelect = (item: any) => {
    onInputChange?.(item.display_name);
    const locationData: Location = {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
    };
    onLocationSelect(locationData);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange?.(e.target.value);
    if (provider === 'locationiq' && enableSuggestions && !disabled) {
        setIsOpen(true);
    }
  }

  const handleClear = () => {
    onInputChange?.('');
    setSuggestions([]);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  // --- Render Logic ---

  // 1. Disabled (Geocoding Permission False) or Suggestions Disabled -> Simple Input
  if (disabled || !enableSuggestions) {
    return (
        <div className="relative w-full">
        <Input
            id={id}
            ref={inputRef}
            placeholder={disabled ? "Digite o endereço manualmente..." : "Digite o endereço..."}
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
  }

  // 2. Google Provider
  if (provider === 'google') {
    if (shouldRenderGoogle && !isGoogleLoaded) return <Skeleton className="h-10 w-full" />;

    return (
        <div className="flex gap-2 items-center w-full">
            <div className="flex-grow">
            <StandaloneSearchBox
                onLoad={onLoadGoogle}
                onPlacesChanged={onPlacesChangedGoogle}
            >
                <div className="relative w-full">
                <Input
                    id={id}
                    ref={inputRef}
                    placeholder="Digite para buscar um endereço (Google)..."
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

  // 3. LocationIQ Provider (Custom Autocomplete)
  return (
    <div className="relative w-full">
         <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className="relative w-full" aria-expanded={isOpen}>
                    <Input
                        id={id}
                        ref={inputRef}
                        placeholder="Digite para buscar um endereço..."
                        value={value}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                             if (e.key === 'Escape') setIsOpen(false);
                             onKeyDown?.(e);
                        }}
                        className="pr-8"
                        autoComplete="off"
                    />
                     {isLoadingIQ && (
                        <div className="absolute inset-y-0 right-8 flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    )}
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
            </PopoverTrigger>
            <PopoverContent className="p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                     <CommandList>
                        {suggestions.length === 0 && !isLoadingIQ && (
                            <CommandEmpty className="py-2 text-center text-sm text-muted-foreground">
                                {value.length < 3 ? 'Digite pelo menos 3 caracteres' : 'Nenhum endereço encontrado.'}
                            </CommandEmpty>
                        )}
                        <CommandGroup>
                            {suggestions.map((item) => (
                                <CommandItem
                                    key={item.place_id}
                                    value={item.display_name}
                                    onSelect={() => handleLocationIqSelect(item)}
                                >
                                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <span>{item.display_name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                     </CommandList>
                </Command>
            </PopoverContent>
         </Popover>
    </div>
  );
}
