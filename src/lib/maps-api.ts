
'use client';

import { Location } from "./types";

export async function geocodeAddress(address: string): Promise<Location | null> {
  if (!window.google || !window.google.maps) {
    console.error("Google Maps API not loaded.");
    return null;
  }
  const geocoder = new window.google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({ address: address });
    if (results && results[0]) {
      const location = results[0].geometry.location;
      return {
        lat: location.lat(),
        lng: location.lng(),
        address: results[0].formatted_address,
      };
    }
    return null;
  } catch (error) {
    console.warn(`Geocode was not successful for the following reason: ${error}`);
    return null;
  }
}

export async function geocodeLatLng(position: { lat: number; lng: number }): Promise<Location> {
  if (!window.google || !window.google.maps) {
    console.error("Google Maps API not loaded.");
    return { ...position, address: `Coordenadas: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` };
  }
  const geocoder = new window.google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({ location: position });
    if (results && results[0]) {
      return {
        ...position,
        address: results[0].formatted_address,
      };
    }
  } catch (error) {
    console.error(`Reverse geocode was not successful for the following reason: ${error}`);
  }
  // Fallback if geocoding fails
  return {
    ...position,
    address: `Coordenadas: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
  };
}
