
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { OptimizedStop } from '@/ai/flows/optimize-route-flow';
import type { Location } from '@/lib/types';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -14.235, // Centered on Brazil
  lng: -51.9253,
};

interface OptimizedRouteMapProps {
    baseLocation: Location;
    stops: OptimizedStop[];
}

export function OptimizedRouteMap({ baseLocation, stops }: OptimizedRouteMapProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const directionsOptions = useMemo(() => {
    if (stops.length === 0 || !isLoaded) return null;

    const waypoints = stops.slice(0, -1).map(stop => ({
        location: {
            lat: stop.ordemServico.destinationLatitude!,
            lng: stop.ordemServico.destinationLongitude!,
        },
        stopover: true,
    }));

    const destinationStop = stops[stops.length - 1].ordemServico;

    return {
        origin: { lat: baseLocation.lat, lng: baseLocation.lng },
        destination: { lat: destinationStop.destinationLatitude!, lng: destinationStop.destinationLongitude! },
        waypoints: waypoints,
        travelMode: 'DRIVING' as google.maps.TravelMode,
    };
  }, [baseLocation, stops, isLoaded]);

  const directionsCallback = useCallback((
    result: google.maps.DirectionsResult | null,
    status: google.maps.DirectionsStatus
  ) => {
    if (status === 'OK' && result) {
      setDirections(result);
      setError(null);
    } else {
      console.error(`Directions request failed due to ${status}`);
      setError(`Não foi possível calcular a rota: ${status}`);
    }
  }, []);

  if (!googleMapsApiKey) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Chave da API do Google Maps ausente</AlertTitle>
        <AlertDescription>
          A funcionalidade do mapa está desativada. Por favor, configure sua chave de API do Google Maps.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (loadError) {
    return <Alert variant="destructive"><AlertTitle>Erro ao carregar mapa</AlertTitle></Alert>;
  }

  if (!isLoaded) {
    return <Skeleton className="h-full w-full" />;
  }
  
  if(error) {
    return <Alert variant="destructive"><AlertTitle>{error}</AlertTitle></Alert>
  }

  return (
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={baseLocation || defaultCenter}
        zoom={12}
      >
        {directionsOptions && !directions && (
            <DirectionsService
                options={directionsOptions}
                callback={directionsCallback}
            />
        )}
        {directions && (
            <DirectionsRenderer
                options={{ 
                    directions,
                    suppressMarkers: false, // Let DirectionsRenderer handle markers
                 }}
            />
        )}
      </GoogleMap>
  );
}
