import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserLocation = { lat: number; lng: number; label: string; source: 'gps' | 'manual' | 'default' };

/** Default to the DMV area (Adey's launch region) until the user allows GPS or picks a city. */
const DEFAULT_LOCATION: UserLocation = { lat: 38.9907, lng: -77.0261, label: 'Silver Spring, MD', source: 'default' };

/** Launch-region presets for the location selector — user-chosen, not inferred. */
export const LOCATION_PRESETS: UserLocation[] = [
  { lat: 38.9907, lng: -77.0261, label: 'Silver Spring, MD', source: 'manual' },
  { lat: 38.9072, lng: -77.0369, label: 'Washington, DC', source: 'manual' },
  { lat: 38.8048, lng: -77.0469, label: 'Alexandria, VA', source: 'manual' },
  { lat: 38.8816, lng: -77.091, label: 'Arlington, VA', source: 'manual' },
  { lat: 38.9897, lng: -76.9378, label: 'Hyattsville, MD', source: 'manual' },
  { lat: 39.2904, lng: -76.6122, label: 'Baltimore, MD', source: 'manual' },
  { lat: 33.749, lng: -84.388, label: 'Atlanta, GA', source: 'manual' },
  { lat: 32.7767, lng: -96.797, label: 'Dallas, TX', source: 'manual' },
  { lat: 44.9778, lng: -93.265, label: 'Minneapolis, MN', source: 'manual' },
  { lat: 47.6062, lng: -122.3321, label: 'Seattle, WA', source: 'manual' },
  { lat: 34.0522, lng: -118.2437, label: 'Los Angeles, CA', source: 'manual' },
  { lat: 39.7392, lng: -104.9903, label: 'Denver, CO', source: 'manual' },
];

type Ctx = {
  location: UserLocation;
  permission: 'unknown' | 'granted' | 'denied';
  requestDeviceLocation: () => Promise<boolean>;
  setManual: (loc: UserLocation) => void;
};

const LocationContext = createContext<Ctx | null>(null);
const KEY = 'adey.location';

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<UserLocation>(DEFAULT_LOCATION);
  const [permission, setPermission] = useState<Ctx['permission']>('unknown');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) {
        try {
          setLocation(JSON.parse(v));
        } catch {
          /* ignore */
        }
      }
    });
    Location.getForegroundPermissionsAsync().then((p) => setPermission(p.granted ? 'granted' : p.canAskAgain ? 'unknown' : 'denied'));
  }, []);

  const persist = (loc: UserLocation) => {
    setLocation(loc);
    AsyncStorage.setItem(KEY, JSON.stringify(loc)).catch(() => {});
  };

  const requestDeviceLocation = useCallback(async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (!p.granted) {
      setPermission('denied');
      return false;
    }
    setPermission('granted');
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    let label = 'Current location';
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (place?.city) label = `${place.city}${place.region ? ', ' + place.region : ''}`;
    } catch {
      /* reverse geocode is best-effort */
    }
    persist({ lat: pos.coords.latitude, lng: pos.coords.longitude, label, source: 'gps' });
    return true;
  }, []);

  const value = useMemo<Ctx>(() => ({ location, permission, requestDeviceLocation, setManual: persist }), [location, permission, requestDeviceLocation]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within LocationProvider');
  return ctx;
}
