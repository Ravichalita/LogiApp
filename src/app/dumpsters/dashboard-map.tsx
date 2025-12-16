'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EnhancedDumpster } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { isWithinInterval, parseISO, endOfDay } from 'date-fns';
import { parseCoordinates } from '@/lib/location-utils';

interface DashboardMapProps {
  dumpsters: EnhancedDumpster[];
  onViewDetails?: (id: string) => void;
}

const DEFAULT_CENTER: [number, number] = [-22.88, -42.02]; // Cabo Frio
const ZOOM_LEVEL = 13;

interface MapMarker {
  id: string;
  name: string;
  position: [number, number];
  status: string;
  clientName: string;
  address: string;
}

function MapEffect({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      // Filter out markers that are at the base (Available or Maintenance) for bounds calculation
      // providing a better view of active rentals
      const activeMarkers = markers.filter(m => m.status !== 'Disponível' && m.status !== 'Em Manutenção');
      const markersToFit = activeMarkers.length > 0 ? activeMarkers : markers;

      const bounds = L.latLngBounds(markersToFit.map(m => m.position));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
       map.setView(DEFAULT_CENTER, ZOOM_LEVEL);
    }
  }, [map, markers]);

  return null;
}

export default function DashboardMap({ dumpsters, onViewDetails }: DashboardMapProps) {
  const { account } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const geoapifyKey = account?.geoapifyApiKey || process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  const markers = useMemo(() => {
    if (!account) return [];

    return dumpsters.map(dumpster => {
      let position: [number, number] | null = null;
      let status = dumpster.derivedStatus;
      let address = '';
      let clientName = '';

      // Determine Status and Position logic
      const isRented = ['Alugada', 'Encerra hoje', 'Em Atraso'].some(s => status.includes(s));

      // Find active rental
      const now = new Date();
      const rentals = [...(dumpster.scheduledRentals || [])].sort((a, b) => new Date(a.rentalDate).getTime() - new Date(b.rentalDate).getTime());

      const activeRental = rentals.find(r =>
          isWithinInterval(now, { start: parseISO(r.rentalDate), end: endOfDay(parseISO(r.returnDate)) })
      );

      if (isRented && activeRental) {
        if (activeRental.latitude && activeRental.longitude) {
           position = [activeRental.latitude, activeRental.longitude];
        } else if (activeRental.deliveryGoogleMapsLink) {
           const coords = parseCoordinates(activeRental.deliveryGoogleMapsLink);
           if (coords) position = [coords.lat, coords.lng];
        }

        if (position) {
             address = activeRental.deliveryAddress;
             clientName = activeRental.client?.name || 'Cliente Desconhecido';
        }
      } else if (status === 'Disponível' || status === 'Em Manutenção') {
         // Place at Base if available
         if (account.bases && account.bases.length > 0) {
            const base = account.bases[0];
            if (base.latitude && base.longitude) {
                position = [base.latitude, base.longitude];
                address = base.address;
                clientName = `Base: ${base.name}`;
            }
         }
      } else if (activeRental) {
           if (activeRental.latitude && activeRental.longitude) {
               position = [activeRental.latitude, activeRental.longitude];
           } else if (activeRental.deliveryGoogleMapsLink) {
               const coords = parseCoordinates(activeRental.deliveryGoogleMapsLink);
               if (coords) position = [coords.lat, coords.lng];
           }

           if (position) {
               address = activeRental.deliveryAddress;
               clientName = activeRental.client?.name || 'Cliente Desconhecido';
           }
      }

      if (!position) return null;

      return {
        id: dumpster.id,
        name: dumpster.name,
        position,
        status,
        clientName,
        address
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null);
  }, [dumpsters, account]);

  if (!isMounted) return <div className="h-[450px] w-full bg-muted animate-pulse rounded-md" />;

  if (!geoapifyKey) {
     return <div className="h-[450px] w-full bg-muted flex items-center justify-center rounded-md text-muted-foreground">Chave API Geoapify não configurada.</div>;
  }

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={ZOOM_LEVEL} style={{ height: '450px', width: '100%', borderRadius: '0.5rem', zIndex: 0 }}>
      <MapEffect markers={markers} />
      <TileLayer
        attribution='Powered by <a href="https://www.geoapify.com/">Geoapify</a> | © OpenStreetMap'
        url={`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${geoapifyKey}`}
      />
      {markers.map(marker => (
        <Marker
            key={marker.id}
            position={marker.position}
            icon={getMarkerIcon(marker.status, geoapifyKey)}
        >
          <Popup>
            <div className="text-sm">
              <p><strong>{marker.clientName}</strong></p>
              <p className="text-muted-foreground">{marker.address}</p>
              <p className="uppercase text-xs font-bold mt-2 text-primary">{marker.status}</p>
              {onViewDetails && (
                <button
                  className="text-primary text-xs underline mt-2 cursor-pointer"
                  onClick={() => onViewDetails(marker.id)}
                >
                  Ver Detalhes
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function getMarkerIcon(status: string, apiKey: string) {
    const isOccupied = ['Alugada', 'Encerra hoje', 'Em Atraso'].some(s => status.includes(s));

    // Logic: Occupied = Red/Trash, Free = Green/Check
    const color = isOccupied ? 'red' : 'green';
    const icon = isOccupied ? 'trash' : 'check';

    return L.icon({
        iconUrl: `https://api.geoapify.com/v1/icon/?type=awesome&color=${color}&icon=${icon}&apiKey=${apiKey}`,
        iconSize: [31, 46],
        iconAnchor: [15.5, 42],
        popupAnchor: [0, -45],
    });
}
