'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { useEffect, useMemo } from 'react';
import '@/styles/leaflet-custom.css';

// Fix for default marker icon in Next.js
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

interface LocationEntity {
  id: string;
  type: string;
  value: string;
  data: {
    lat?: number;
    lon?: number;
    label?: string;
    color?: string;
    address?: string;
    country?: string;
    [key: string]: any;
  };
}

interface MapCanvasProps {
  entities: LocationEntity[];
  onEntityClick?: (entity: LocationEntity) => void;
}

function MapController({ entities }: { entities: LocationEntity[] }) {
  const map = useMap();

  useEffect(() => {
    if (entities.length > 0) {
      const bounds = entities
        .filter(e => e.data.lat && e.data.lon)
        .map(e => [e.data.lat!, e.data.lon!] as LatLngExpression);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds as any, { padding: [50, 50] });
      }
    }
  }, [entities, map]);

  return null;
}

export default function MapCanvas({ entities, onEntityClick }: MapCanvasProps) {
  // Filter entities that have geolocation data
  const locationEntities = useMemo(() => {
    return entities.filter(e => {
      // Multiple checks for lat/lon data attributes
      const hasCoords = (
        (e.data?.lat !== undefined && e.data?.lon !== undefined) ||
        (e.data?.latitude !== undefined && e.data?.longitude !== undefined) ||
        (e.data?.properties?.lat !== undefined && e.data?.properties?.lon !== undefined)
      );
      
      if (!hasCoords) return false;
      
      // Get the actual lat/lon values
      const lat = e.data?.lat ?? e.data?.latitude ?? e.data?.properties?.lat;
      const lon = e.data?.lon ?? e.data?.longitude ?? e.data?.properties?.lon;
      
      return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }).map(e => ({
      ...e,
      // Normalize lat/lon properties
      data: {
        ...e.data,
        lat: e.data?.lat ?? e.data?.latitude ?? e.data?.properties?.lat,
        lon: e.data?.lon ?? e.data?.longitude ?? e.data?.properties?.lon,
      }
    }));
  }, [entities]);

  // Default center (London)
  const defaultCenter: LatLngExpression = [51.505, -0.09];
  const center = locationEntities.length > 0 
    ? [locationEntities[0].data.lat!, locationEntities[0].data.lon!] as LatLngExpression
    : defaultCenter;

  if (locationEntities.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold mb-2">No Location Data</h3>
          <p className="text-sm">Add entities with latitude/longitude to see them on the map</p>
          <p className="text-xs mt-2">Try using IP Geolocation or adding location entities</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ background: '#1e293b' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController entities={locationEntities} />

        {locationEntities.map((entity) => (
          <Marker
            key={entity.id}
            position={[entity.data.lat!, entity.data.lon!]}
            eventHandlers={{
              click: () => onEntityClick?.(entity),
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm mb-1">
                  {entity.data.label || entity.value}
                </h3>
                <p className="text-xs text-gray-600">Type: {entity.type}</p>
                {entity.data.address && (
                  <p className="text-xs text-gray-600 mt-1">{entity.data.address}</p>
                )}
                {entity.data.country && (
                  <p className="text-xs text-gray-600">Country: {entity.data.country}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {entity.data.lat?.toFixed(6)}, {entity.data.lon?.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Entity count badge */}
      <div className="absolute top-4 right-4 z-[1000] bg-slate-800 px-3 py-2 rounded-lg shadow-lg border border-slate-700">
        <p className="text-white text-sm font-medium">
          📍 {locationEntities.length} {locationEntities.length === 1 ? 'Location' : 'Locations'}
        </p>
      </div>
    </div>
  );
}
