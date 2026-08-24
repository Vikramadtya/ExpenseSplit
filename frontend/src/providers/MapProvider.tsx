import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Location = {
  lat: number;
  lng: number;
  address: string;
};

type MapContextType = {
  isLoaded: boolean;
  geocodeAddress: (address: string) => Promise<Location | null>;
};

const MapContext = createContext<MapContextType | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  // Stubbed as true for now. In a real app, this might track Google Maps script loading status.
  const [isLoaded] = useState(true);

  // Stub geocoding functionality
  const geocodeAddress = async (address: string): Promise<Location | null> => {
    console.log(`[MapProvider Mock] Geocoding address: ${address}`);
    return new Promise((resolve) => {
      setTimeout(() => {
        // Mock returning New York coordinates for any address
        resolve({
          lat: 40.7128,
          lng: -74.006,
          address: address,
        });
      }, 500);
    });
  };

  return <MapContext.Provider value={{ isLoaded, geocodeAddress }}>{children}</MapContext.Provider>;
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}
