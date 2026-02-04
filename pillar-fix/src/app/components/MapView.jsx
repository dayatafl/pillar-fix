import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import 'leaflet/dist/leaflet.css';

export function MapView({ cases, onCaseSelect }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
  
    // Initialize map (Kuala Lumpur center)
    const map = L.map(mapContainerRef.current).setView([3.1390, 101.6869], 12);
  
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
  
    mapRef.current = map;
  
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Add markers for each case
    cases.forEach((case_) => {
      const color =
        case_.severity === 'Critical' ? 'red' :
        case_.severity === 'High' ? 'orange' :
        case_.severity === 'Medium' ? 'yellow' :
        'blue';

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            background-color: ${color};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 12px;
          ">
            !
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([case_.coordinates.lat, case_.coordinates.lng], { icon })
        .addTo(mapRef.current);

      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="font-weight: bold; margin-bottom: 8px;">${case_.location}</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${case_.address}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
            ${case_.faults.map(f => `
              <span style="
                background-color: #f3f4f6;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 10px;
              ">${f}</span>
            `).join('')}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="
              background-color: ${
                case_.severity === 'Critical' ? '#fee2e2' :
                case_.severity === 'High' ? '#fed7aa' :
                case_.severity === 'Medium' ? '#fef3c7' :
                '#dbeafe'
              };
              color: ${
                case_.severity === 'Critical' ? '#991b1b' :
                case_.severity === 'High' ? '#9a3412' :
                case_.severity === 'Medium' ? '#854d0e' :
                '#1e40af'
              };
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 600;
            ">${case_.severity}</span>
            <button
              onclick="window.viewCase('${case_.id}')"
              style="
                background-color: #3b82f6;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                font-weight: 500;
              "
            >View Details</button>
          </div>
        </div>
      `);
    });

    // Fit bounds to show all markers
    if (cases.length > 0) {
      const bounds = L.latLngBounds(
        cases.map(c => [c.coordinates.lat, c.coordinates.lng])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [cases]);

  // Set up global function for marker click
  useEffect(() => {
    window.viewCase = (caseId) => {
      onCaseSelect(caseId);
    };

    return () => {
      delete window.viewCase;
    };
  }, [onCaseSelect]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Map View</h2>
        <p className="text-gray-600 mt-1">
          Geographical overview of all feeder pillar cases
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Locations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={mapContainerRef}
            className="w-full h-[600px] rounded-b-lg"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
          <div className="w-4 h-4 rounded-full bg-red-600"></div>
          <div>
            <p className="text-sm font-medium text-red-900">Critical</p>
            <p className="text-xl font-bold text-red-700">
              {cases.filter(c => c.severity === 'Critical').length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
          <div className="w-4 h-4 rounded-full bg-orange-600"></div>
          <div>
            <p className="text-sm font-medium text-orange-900">High</p>
            <p className="text-xl font-bold text-orange-700">
              {cases.filter(c => c.severity === 'High').length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
          <div className="w-4 h-4 rounded-full bg-yellow-600"></div>
          <div>
            <p className="text-sm font-medium text-yellow-900">Medium</p>
            <p className="text-xl font-bold text-yellow-700">
              {cases.filter(c => c.severity === 'Medium').length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
          <div className="w-4 h-4 rounded-full bg-blue-600"></div>
          <div>
            <p className="text-sm font-medium text-blue-900">Low</p>
            <p className="text-xl font-bold text-blue-700">
              {cases.filter(c => c.severity === 'Low').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
