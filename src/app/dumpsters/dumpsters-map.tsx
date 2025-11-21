
'use client';

import React, from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { EnhancedDumpster } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X } from 'lucide-react';

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

// Represents a single dumpster at a location for the InfoWindow
type DumpsterInfo = {
    dumpsterName: string;
    clientName: string;
    status: string;
    rentalDate: string;
    returnDate: string;
};

// Represents a marker on the map, which can group multiple dumpsters
type MapMarkerData = {
    id: string; // Unique key for the marker, e.g., latitude-longitude
    position: { lat: number; lng: number };
    count: number;
    dumpsters: DumpsterInfo[];
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
  const [map, setMap] = React.useState<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = React.useState<MapMarkerData | null>(null);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: ['places', 'geocoding'],
    preventLoad: !googleMapsApiKey,
  });

  const markers = React.useMemo((): MapMarkerData[] => {
    const locations = new Map<string, MapMarkerData>();

    dumpsters.forEach(dumpster => {
        const rentals = Array.isArray(dumpster.scheduledRentals) ? dumpster.scheduledRentals : [];
        
        rentals
            .filter(rental => rental && typeof rental.latitude === 'number' && typeof rental.longitude === 'number')
            .forEach(rental => {
                const key = `${rental.latitude!.toFixed(5)},${rental.longitude!.toFixed(5)}`;
                
                const dumpsterInfo: DumpsterInfo = {
                    dumpsterName: dumpster.name,
                    clientName: rental.client?.name || 'N/A',
                    status: dumpster.derivedStatus,
                    rentalDate: rental.rentalDate,
                    returnDate: rental.returnDate,
                };

                if (!locations.has(key)) {
                    locations.set(key, {
                        id: key,
                        position: { lat: rental.latitude!, lng: rental.longitude! },
                        count: 0,
                        dumpsters: [],
                    });
                }
                
                const locationData = locations.get(key)!;
                locationData.count += 1;
                locationData.dumpsters.push(dumpsterInfo);
            });
    });

    return Array.from(locations.values());
  }, [dumpsters]);

  const onLoad = React.useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = React.useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  React.useEffect(() => {
    if (map && markers.length > 0 && isLoaded) {
        const bounds = new window.google.maps.LatLngBounds();
        markers.forEach(marker => {
            bounds.extend(marker.position);
        });
        map.fitBounds(bounds);

        // Optional: Prevent over-zooming on a single marker
        if (markers.length === 1) {
            const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
                if (map.getZoom() > 15) map.setZoom(15);
            });
            return () => window.google.maps.event.removeListener(listener);
        }
    }
  }, [map, markers, isLoaded]);

  const handleMarkerClick = (marker: MapMarkerData) => {
    setActiveMarker(marker);
  };

  const handleInfoWindowClose = () => {
    setActiveMarker(null);
  };

  const getMarkerIcon = (markerData: MapMarkerData) => {
    const color = getStatusColor(markerData.dumpsters[0].status);
    const iconPath = "M22 8.72V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.72A2 2 0 0 1 3.42 7.2L12 2.2l8.58 5.02A2 2 0 0 1 22 8.72ZM12 12.5V2.2m0 10.3-8.58-5.02m8.58 5.02 8.58-5.02M2 13.28V20m20-6.72V20";
    
    let iconSvgString;

    if (markerData.count > 1) {
        iconSvgString = `
            <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                <g transform="translate(4, 4)">
                    <path d="${iconPath}" stroke-width="2" stroke="white" fill="${color}" />
                </g>
                <circle cx="28" cy="8" r="8" fill="#DC3545" stroke="white" stroke-width="1.5" />
                <text x="28" y="11" font-size="10" font-family="Arial, sans-serif" font-weight="bold" fill="white" text-anchor="middle">${markerData.count}</text>
            </svg>
        `;
    } else {
        iconSvgString = `
            <svg width="32" height="32" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                <path d="${iconPath}" stroke-width="2" stroke="white" fill="${color}" />
            </svg>
        `;
    }

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(iconSvgString)}`,
      scaledSize: new window.google.maps.Size(36, 36),
      anchor: new window.google.maps.Point(18, 18),
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
      center={defaultCenter}
      zoom={4}
      onLoad={onLoad}
      onUnmount={onUnmount}
    >
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          icon={getMarkerIcon(marker)}
          onClick={() => handleMarkerClick(marker)}
        />
      ))}

      {activeMarker && (
        <InfoWindow
          position={activeMarker.position}
          onCloseClick={handleInfoWindowClose}
          options={{ disableAutoPan: true }}
        >
          <div className="p-1 space-y-2 text-black max-h-48 overflow-y-auto relative">
             <button onClick={handleInfoWindowClose} className="absolute top-0 right-0 p-1 bg-transparent border-none cursor-pointer text-black">
                <X size={16} />
             </button>
             {activeMarker.dumpsters.map((d, index) => (
                <div key={index} className="border-b last:border-b-0 pb-2 mb-2 pr-4">
                     <h3 className="font-bold">{d.dumpsterName}</h3>
                     <p className="text-sm">Cliente: {d.clientName}</p>
                     <p className="text-sm">Status: {d.status}</p>
                     <p className="text-sm">Período: {format(parseISO(d.rentalDate), 'dd/MM/yy', { locale: ptBR })} - {format(parseISO(d.returnDate), 'dd/MM/yy', { locale: ptBR })}</p>
                </div>
             ))}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
