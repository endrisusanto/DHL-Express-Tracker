import React, { useEffect, useRef, useState } from 'react';
import { DHLShipment } from '../types';
import { Map as MapIcon } from 'lucide-react';

interface Props {
  shipment: DHLShipment;
}

interface LocationPoint {
  name: string;
  lat: number;
  lng: number;
  type: 'origin' | 'transit' | 'current' | 'destination';
  timestamp?: string;
}

// Coordinate cache to ensure speed and reliability
const KNOWN_LOCATIONS: Record<string, [number, number]> = {
  'Berlin': [52.5200, 13.4050],
  'DE': [51.1657, 10.4515],
  'Jakarta': [-6.2088, 106.8456],
  'Jakarta - Indonesia': [-6.2088, 106.8456],
  'ID': [-0.7893, 113.9213],
  'Leipzig': [51.3397, 12.3731],
  'Leipzig - Germany': [51.3397, 12.3731],
  'Jakarta Gateway': [-6.1256, 106.6559],
  'London': [51.5074, -0.1278],
  'New York': [40.7128, -74.0060],
  'Hong Kong': [22.3193, 114.1694],
  'Singapore': [1.3521, 103.8198],
  'Los Angeles': [34.0522, -118.2437],
  'Dubai': [25.2048, 55.2708],
  'Cincinnati': [39.1031, -84.5120],
  'Frankfurt': [50.1109, 8.6821],
  'Brussels': [50.8503, 4.3517],
  'Amsterdam': [52.3676, 4.9041],
  'Paris': [48.8566, 2.3522]
};

export const ShipmentMap: React.FC<Props> = ({ shipment }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Extract Locations and Geocode
  useEffect(() => {
    const fetchCoordinates = async () => {
      setLoading(true);
      const locationsToMap: LocationPoint[] = [];
      
      // Helper to get coords (Mock or Fetch)
      const getCoords = async (query: string): Promise<[number, number] | null> => {
        const normalized = query.trim();
        // Check cache/known locations first
        if (KNOWN_LOCATIONS[normalized]) return KNOWN_LOCATIONS[normalized];
        
        const simpleCity = normalized.split(' - ')[0];
        if (KNOWN_LOCATIONS[simpleCity]) return KNOWN_LOCATIONS[simpleCity];

        // Real Geocoding via Nominatim (OpenStreetMap)
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalized)}&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          }
        } catch (e) {
          console.warn(`Failed to geocode ${query}`, e);
        }
        return null;
      };

      // Process Origin
      if (shipment.origin?.address?.addressLocality) {
        const originCoords = await getCoords(shipment.origin.address.addressLocality);
        if (originCoords) {
          locationsToMap.push({ 
            name: shipment.origin.address.addressLocality, 
            lat: originCoords[0], 
            lng: originCoords[1], 
            type: 'origin' 
          });
        }
      }

      // Process Events
      // The events are usually newest first. We reverse to get chronological path.
      const chronoEvents = [...shipment.events].reverse();
      
      for (let i = 0; i < chronoEvents.length; i++) {
        const event = chronoEvents[i];
        const locName = event.serviceArea?.[0]?.description;
        
        if (locName) {
          // Avoid duplicates nearby
          const prevLoc = locationsToMap[locationsToMap.length - 1];
          if (prevLoc && (prevLoc.name === locName || prevLoc.name.includes(locName) || locName.includes(prevLoc.name))) {
             // If it's the last event, upgrade the type of the existing point to 'current' later
             continue; 
          }

          const coords = await getCoords(locName);
          if (coords) {
             // Geocoord check (jitter filter)
             const isSame = prevLoc && Math.abs(prevLoc.lat - coords[0]) < 0.01 && Math.abs(prevLoc.lng - coords[1]) < 0.01;
             if (!isSame) {
                locationsToMap.push({ 
                  name: locName, 
                  lat: coords[0], 
                  lng: coords[1], 
                  type: 'transit',
                  timestamp: `${event.date} ${event.time}`
                });
             }
          }
        }
      }

      // Mark the last point in the list (which is the latest event) as "current"
      if (locationsToMap.length > 0) {
        locationsToMap[locationsToMap.length - 1].type = 'current';
      }

      // Process Destination
      // If the shipment is delivered, the destination is likely the same as 'current'. 
      // If not, we add the destination as a future target.
      if (shipment.destination?.address?.addressLocality) {
        const destCoords = await getCoords(shipment.destination.address.addressLocality);
        if (destCoords) {
           const prevLoc = locationsToMap[locationsToMap.length - 1];
           const isSame = prevLoc && Math.abs(prevLoc.lat - destCoords[0]) < 0.01 && Math.abs(prevLoc.lng - destCoords[1]) < 0.01;
           
           if (isSame) {
              // If we are at destination, make sure it's marked as destination type but keeps current property implies arrival
              locationsToMap[locationsToMap.length - 1].type = 'destination'; 
              // Note: If delivered, we might want to style it as delivered. For now, destination style is fine.
           } else {
              locationsToMap.push({ 
                name: shipment.destination.address.addressLocality, 
                lat: destCoords[0], 
                lng: destCoords[1], 
                type: 'destination' 
              });
           }
        }
      }

      setPoints(locationsToMap);
      setLoading(false);
    };

    fetchCoordinates();
  }, [shipment.id]);

  // 2. Initialize Map
  useEffect(() => {
    if (loading || points.length === 0 || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapContainerRef.current, {
        center: [points[0].lat, points[0].lng],
        zoom: 4,
        scrollWheelZoom: false,
        attributionControl: false,
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    // Draw Route
    const latLngs = points.map(p => [p.lat, p.lng]);
    if (latLngs.length > 1) {
        L.polyline(latLngs, {
            color: '#D40511',
            weight: 3,
            opacity: 0.6,
            className: 'route-line',
            dashArray: '10, 10'
        }).addTo(map);
    }

    // Add Custom Markers
    points.forEach((p) => {
        let iconHtml = '';
        let iconSize: [number, number] = [32, 32];
        let anchor: [number, number] = [16, 32];
        let className = 'marker-icon-wrapper';

        // SVG Icons
        const originIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFCC00" stroke="#B91C1C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 drop-shadow-md">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        `;

        const destinationIcon = `
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D40511" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-9 h-9 drop-shadow-md">
             <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
             <line x1="4" y1="22" x2="4" y2="15"></line>
           </svg>
        `;

        const currentIcon = `
           <div class="relative w-4 h-4 bg-dhl-red rounded-full border-2 border-white shadow-md"></div>
        `;
        
        const transitIcon = `
            <div class="w-2 h-2 bg-gray-400 rounded-full opacity-80"></div>
        `;

        if (p.type === 'origin') {
            iconHtml = originIcon;
        } else if (p.type === 'destination') {
            iconHtml = destinationIcon;
            iconSize = [36, 36];
            anchor = [4, 36]; // Bottom-left of flag pole approx
        } else if (p.type === 'current') {
            iconHtml = currentIcon;
            className += ' marker-pulse'; // Add pulse animation
            iconSize = [20, 20];
            anchor = [10, 10];
        } else {
            iconHtml = transitIcon;
            iconSize = [8, 8];
            anchor = [4, 4];
        }

        const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="${className}">${iconHtml}</div>`,
            iconSize: iconSize,
            iconAnchor: anchor,
            popupAnchor: [0, -anchor[1]/2]
        });

        L.marker([p.lat, p.lng], { icon })
         .addTo(map)
         .bindPopup(`
            <div class="font-sans p-1">
                <div class="text-[10px] font-bold text-gray-500 uppercase mb-0.5 tracking-wider">
                  ${p.type === 'current' ? 'Current Location' : p.type}
                </div>
                <div class="text-sm font-bold text-gray-900 leading-tight">${p.name}</div>
                ${p.timestamp ? `<div class="text-xs text-gray-400 mt-1">${p.timestamp}</div>` : ''}
            </div>
         `);
    });

    // Fit bounds with padding
    if (points.length > 0) {
        const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    }

    mapInstanceRef.current = map;

    return () => {
       if (mapInstanceRef.current) {
           mapInstanceRef.current.remove();
           mapInstanceRef.current = null;
       }
    };
  }, [loading, points]);

  if (loading) {
      return (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-80 mb-6 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-dhl-red border-t-transparent rounded-full animate-spin"></div>
              <div className="text-gray-400 text-sm font-medium flex items-center gap-2">
                  <MapIcon size={16} /> Mapping shipment route...
              </div>
          </div>
      );
  }

  if (points.length === 0) return null;

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-1.5 overflow-hidden">
            <div className="relative w-full h-80 md:h-96 bg-gray-100 rounded-xl overflow-hidden border border-gray-100" ref={mapContainerRef}>
                <div className="absolute bottom-1 left-2 z-[400] opacity-60 hover:opacity-100 transition-opacity">
                     <span className="text-[10px] text-gray-500 bg-white/80 px-1.5 py-0.5 rounded shadow-sm">
                        Route visualization
                     </span>
                </div>
            </div>
        </div>
    </div>
  );
};