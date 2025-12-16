
import { geocodeAddress } from '@/lib/data-server-actions';

interface LocationInfo {
    lat?: number;
    lng?: number;
    address?: string;
    googleMapsLink?: string;
}

/**
 * Parses coordinates from a Google Maps link or raw coordinate string.
 * Supports:
 * - https://www.google.com/maps?q=-23.5,-46.6
 * - https://www.google.com/maps/place/.../@-23.5,-46.6,17z
 * - -23.5, -46.6 (Raw string)
 * - lat, lng keys in URL params
 */
export function parseCoordinates(input: string): { lat: number, lng: number } | null {
    if (!input) return null;

    // 1. Try to find "lat,lng" pattern in the string (e.g. from q= param or raw text)
    // Matches: -23.123, -46.123 or -23.123,-46.123
    const coordRegex = /(-?\d+\.\d+),\s*(-?\d+\.\d+)/;

    // Check if it's a URL
    try {
        const url = new URL(input);

        // Search in q param
        const qParam = url.searchParams.get('q');
        if (qParam) {
            const match = qParam.match(coordRegex);
            if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        }

        // Search in path (e.g. /@lat,lng,z)
        const pathMatch = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (pathMatch) {
            return { lat: parseFloat(pathMatch[1]), lng: parseFloat(pathMatch[2]) };
        }

        // Search in ll param (rare but possible)
        const llParam = url.searchParams.get('ll');
        if (llParam) {
            const match = llParam.match(coordRegex);
             if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        }

    } catch (e) {
        // Not a valid URL, treat as raw text
    }

    // Try raw regex on the whole string
    const match = input.match(coordRegex);
    if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    return null;
}

/**
 * Determines the best location coordinates based on available info.
 * Priority:
 * 1. Google Maps Link (extract coords)
 * 2. Address string (extract coords if present)
 * 3. Geocode Address string
 */
export async function determineLocation(info: LocationInfo): Promise<{ lat: number, lng: number } | null> {
    // 1. Try Google Maps Link
    if (info.googleMapsLink) {
        const coords = parseCoordinates(info.googleMapsLink);
        if (coords) return coords;
    }

    // 2. Try Address String for coordinates
    if (info.address) {
        const coords = parseCoordinates(info.address);
        if (coords) return coords;
    }

    // 3. Fallback: Geocode the address
    if (info.address) {
        const result = await geocodeAddress(info.address);
        if (result) {
            return { lat: result.lat, lng: result.lng };
        }
    }

    // 4. Return existing lat/lng if present and nothing else worked
    if (typeof info.lat === 'number' && typeof info.lng === 'number') {
        return { lat: info.lat, lng: info.lng };
    }

    return null;
}
