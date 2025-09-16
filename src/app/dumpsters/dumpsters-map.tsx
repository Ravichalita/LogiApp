
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { EnhancedDumpster, PopulatedRental } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { renderToString } from 'react-dom/server';
import { Container } from 'lucide-react';
import { container } from 'googleapis/build/src/apis/container';


const containerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: -14.235, // Brazil's center
  lng: -51.9253,
};

interface DumpstersMapProps {
  dumpsters: EnhancedDumpster[];
}

type MapMarkerData = {
    id: string; // Unique key for the marker, e.g., `${dumpster.id}-${rental.id}`
    position: { lat: number; lng: number };
    dumpsterName: string;
    clientName: string;
    status: string;
    rentalDate: string;
    returnDate: string;
};

// Function to map status to a color
const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('atraso')) return '#DC3545'; // Red for destructive
    if (lowerStatus.includes('reservada')) return '#007BFF'; // Blue for info
    if (lowerStatus.includes('encerra hoje')) return '#FFC700'; // Yellow for warning
    if (lowerStatus.includes('alugada')) return '#28A745'; // Green for success
    return '#6c757d'; // Gray for secondary/default
};


export function DumpstersMap({ dumpsters }: DumpstersMapProps) {
  const [activeMarker, setActiveMarker] = useState<MapMarkerData | null>(null);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const markers = useMemo((): MapMarkerData[] => {
    return dumpsters.flatMap(dumpster => 
        (dumpster.scheduledRentals || [])
            .filter(rental => rental.latitude && rental.longitude)
            .map(rental => ({
                id: `${dumpster.id}-${rental.id}`,
                position: { lat: rental.latitude!, lng: rental.longitude! },
                dumpsterName: dumpster.name,
                clientName: rental.client?.name || 'N/A',
                status: dumpster.derivedStatus,
                rentalDate: rental.rentalDate,
                returnDate: rental.returnDate,
            }))
    );
  }, [dumpsters]);

  const mapCenter = useMemo(() => {
    if (markers.length === 0) return defaultCenter;
    
    const latSum = markers.reduce((sum, marker) => sum + marker.position.lat, 0);
    const lngSum = markers.reduce((sum, marker) => sum + marker.position.lng, 0);

    return {
      lat: latSum / markers.length,
      lng: lngSum / markers.length,
    };
  }, [markers]);


  const handleMarkerClick = (marker: MapMarkerData) => {
    setActiveMarker(marker);
  };

  const handleInfoWindowClose = () => {
    setActiveMarker(null);
  };

  const getMarkerIcon = (status: string) => {
    const color = getStatusColor(status);
    const iconSvgString = renderToString(<Container color={color} fill={color} />);

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(iconSvgString)}`,
      scaledSize: new window.google.maps.Size(30, 30),
      anchor: new window.google.maps.Point(15, 15),
    };
  };

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


  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={markers.length > 0 ? 12 : 4}
    >
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          icon={getMarkerIcon(marker.status)}
          onClick={() => handleMarkerClick(marker)}
        />
      ))}

      {activeMarker && (
        <InfoWindow
          position={activeMarker.position}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="p-1 space-y-1 text-gray-800">
            <h3 className="font-bold">{activeMarker.dumpsterName}</h3>
            <p className="text-sm">Cliente: {activeMarker.clientName}</p>
            <p className="text-sm">Status: {activeMarker.status}</p>
            <p className="text-sm">Período: {format(parseISO(activeMarker.rentalDate), 'dd/MM/yy', { locale: ptBR })} - {format(parseISO(activeMarker.returnDate), 'dd/MM/yy', { locale: ptBR })}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
