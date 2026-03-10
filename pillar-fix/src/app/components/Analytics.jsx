import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Banknote, MapPin, AlertTriangle, HandCoins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Coordinates lookup for known localities — extend as needed
const LOCALITY_COORDINATES = {
  'Majlis Perbandaran Selayang':              { lat: 3.1579, lng: 101.7123 },
  'Bukit Bintang':                   { lat: 3.1466, lng: 101.7101 },
  'Petaling Jaya':                   { lat: 3.1073, lng: 101.6067 },
  'Subang Jaya':                     { lat: 3.0439, lng: 101.5800 },
  'Chow Kit':                        { lat: 3.1620, lng: 101.6970 },
  'Bangsar':                         { lat: 3.1302, lng: 101.6726 },
  'Mont Kiara':                      { lat: 3.1726, lng: 101.6530 },
  'Kepong':                          { lat: 3.2115, lng: 101.6368 },
  'Wangsa Maju':                     { lat: 3.2077, lng: 101.7384 },
  'Cheras':                          { lat: 3.0800, lng: 101.7500 },
};

const DEFAULT_COORDINATES = { lat: 3.1390, lng: 101.6869 };

export function Analytics({ maintenanceItems, tasks = [] }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

   useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const rmFormatter = (value) => `RM ${Number(value).toLocaleString()}`;

  const costTooltipStyles = isMobile
    ? {
        contentStyle: {
          fontSize: 12,
          padding: '8px 10px',
          borderRadius: 10,
          borderColor: '#E5E7EB',
        },
        labelStyle: { fontSize: 11, marginBottom: 4, color: '#374151' },
        itemStyle: { fontSize: 12, paddingTop: 2, paddingBottom: 2 },
      }
    : {
        contentStyle: {
          fontSize: 13,
          padding: '10px 12px',
          borderRadius: 10,
          borderColor: '#E5E7EB',
        },
        labelStyle: { fontSize: 12, marginBottom: 4, color: '#374151' },
        itemStyle: { fontSize: 13, paddingTop: 2, paddingBottom: 2 },
      };

  // Cost forecasting data
  const costData = [
    { year: '2020', actual: 45000, predicted: 42000, preventive: 35000 },
    { year: '2021', actual: 45000, predicted: 42000, preventive: 35000 },
    { year: '2022', actual: 52000, predicted: 48000, preventive: 38000 },
    { year: '2023', actual: 48000, predicted: 50000, preventive: 36000 },
    { year: '2024', actual: 61000, predicted: 55000, preventive: 40000 },
    { year: '2025', actual: 55000, predicted: 58000, preventive: 42000 },
  ];

  // Severity distribution
  const severityData = [
    { name: 'Critical', value: maintenanceItems.filter(i => i.severity === 'Critical').length, color: '#EF4444' },
    { name: 'High',     value: maintenanceItems.filter(i => i.severity === 'High').length,     color: '#F97316' },
    { name: 'Medium',   value: maintenanceItems.filter(i => i.severity === 'Medium').length,   color: '#EAB308' },
    { name: 'Low',      value: maintenanceItems.filter(i => i.severity === 'Low').length,      color: '#3B82F6' },
  ];

  // Derive hotspot areas from real task data grouped by locality
  const hotspotAreas = Object.entries(
    tasks.reduce((acc, task) => {
      const loc = task.locality || 'Unknown';
      if (!acc[loc]) acc[loc] = { tasks: [] };
      acc[loc].tasks.push(task);
      return acc;
    }, {})
  )
    .map(([locality, { tasks: localTasks }]) => {
      const criticalCount = localTasks.filter(t => t.severity === 'Critical').length;
      const costs = localTasks.map(t => t.estimatedCost).filter(Boolean);
      const averageCost = costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0;
      return {
        locality,
        coordinates: LOCALITY_COORDINATES[locality] || DEFAULT_COORDINATES,
        issueCount: localTasks.length,
        criticalCount,
        averageCost,
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount);

  // Fault type distribution
  const faultTypeData = maintenanceItems.reduce((acc, item) => {
    item.faults.forEach(fault => {
      const existing = acc.find(a => a.name === fault);
      if (existing) existing.value += 1;
      else acc.push({ name: fault, value: 1 });
    });
    return acc;
  }, []);

  // Initialize hotspot map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([3.1390, 101.6869], 11);
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

  // Add hotspot markers — re-runs when hotspotAreas changes
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Circle) mapRef.current?.removeLayer(layer);
    });

    hotspotAreas.forEach((area) => {
      const circle = L.circle([area.coordinates.lat, area.coordinates.lng], {
        color:       area.criticalCount > 8 ? '#EF4444' : area.criticalCount > 5 ? '#F97316' : '#EAB308',
        fillColor:   area.criticalCount > 8 ? '#EF4444' : area.criticalCount > 5 ? '#F97316' : '#EAB308',
        fillOpacity: 0.3,
        radius:      area.issueCount * 100,
      }).addTo(mapRef.current);

      circle.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="font-weight: bold; margin-bottom: 8px;">${area.locality}</h3>
          <p style="font-size: 12px; margin: 4px 0;">Total Issues: ${area.issueCount}</p>
          <p style="font-size: 12px; margin: 4px 0;">Critical: ${area.criticalCount}</p>
          <p style="font-size: 12px; margin: 4px 0;">Avg Cost: RM ${area.averageCost.toLocaleString()}</p>
        </div>
      `);
    });
  }, [hotspotAreas]);

  const totalCost = maintenanceItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  const avgCost = maintenanceItems.length > 0 ? totalCost / maintenanceItems.length : 0;
  const potentialSavings = costData[costData.length - 1].predicted - costData[costData.length - 1].preventive;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Analytics & Insights</h2>
        <p className="text-gray-500 mt-1">Cost optimization forecasting and hotspot analysis</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Maintenance Cost</CardTitle>
            <Banknote className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {totalCost.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average Cost per Pillar</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {Math.round(avgCost).toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Per maintenance item</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Potential Savings</CardTitle>
            <HandCoins className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">RM {potentialSavings.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">With preventive maintenance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Hotspot Areas</CardTitle>
            <MapPin className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hotspotAreas.length}</div>
            <p className="text-xs text-gray-500 mt-1">High-activity zones</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">Cost Optimization Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile: scrollable wrapper so chart isn't clipped */}
          <div className={isMobile ? "w-full overflow-x-auto" : ""}>
            <ResponsiveContainer
              width="100%"
              height={isMobile ? 320 : 400}
              minWidth={isMobile ? 320 : undefined}
            >
              <LineChart
                data={costData}
                margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 4 } : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: isMobile ? 11 : 12 }} />
                <YAxis tick={{ fontSize: isMobile ? 11 : 12 }} width={isMobile ? 48 : undefined} />
                <Tooltip
                  formatter={rmFormatter}
                  contentStyle={costTooltipStyles.contentStyle}
                  labelStyle={costTooltipStyles.labelStyle}
                  itemStyle={costTooltipStyles.itemStyle}
                />
                <Legend
                  align="center"
                  verticalAlign="bottom"
                  height={isMobile ? 52 : 36}
                  iconSize={isMobile ? 10 : 14}
                  wrapperStyle={{
                    fontSize: isMobile ? 12 : 13,
                    lineHeight: isMobile ? '16px' : '18px',
                  }}
                />
                <Line type="monotone" dataKey="actual"     stroke="#3B82F6" strokeWidth={2} name="Actual Cost" />
                <Line type="monotone" dataKey="predicted"  stroke="#F97316" strokeWidth={2} strokeDasharray="5 5" name="Predicted Cost" />
                <Line type="monotone" dataKey="preventive" stroke="#10B981" strokeWidth={2} name="With Preventive Maintenance" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={isMobile ? "mt-3 rounded-lg bg-green-50 p-3" : "mt-4 rounded-lg bg-green-50 p-4"}>
            <p className={isMobile ? "text-xs text-green-900" : "text-sm text-green-900"}>
              <strong>Insight:</strong> Implementing preventive maintenance could reduce costs by RM {potentialSavings.toLocaleString()} per year.
              The AI detection system helps identify issues early, reducing expensive reactive repairs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pillar Count by Severity Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  label={({ name, value }) => (value > 0 ? `${name}: ${value}` : null)}
                  labelLine={false}
                  outerRadius={100}
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pillar Fault Type Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
              <BarChart
                data={faultTypeData}
                margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 0 } : undefined}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={isMobile ? -20 : -45}
                  textAnchor="end"
                  height={isMobile ? 60 : 100}
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  tickFormatter={(value) =>
                    isMobile && typeof value === 'string' && value.length > 14 ? `${value.slice(0, 14)}...` : value
                  }
                />
                <YAxis tick={{ fontSize: isMobile ? 11 : 12 }} width={isMobile ? 42 : undefined} />
                <Tooltip
                  contentStyle={isMobile ? { fontSize: 12, padding: '8px 10px', borderRadius: 10 } : undefined}
                  labelStyle={isMobile ? { fontSize: 11, marginBottom: 4, color: '#374151' } : undefined}
                  itemStyle={isMobile ? { fontSize: 12, paddingTop: 2, paddingBottom: 2 } : undefined}
                />
                <Bar dataKey="value" fill="#3B82F6" name="Occurrences" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hotspot Map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Pillar Hotspot Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={mapContainerRef} className="w-full h-[500px] relative z-0 rounded-lg mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hotspotAreas.map((area, index) => (
              <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{area.locality}</h4>
                    <p className="text-sm text-gray-600 mt-1">{area.issueCount} total pillars</p>
                  </div>
                  <AlertTriangle className={`h-5 w-5 ${
                    area.criticalCount > 8 ? 'text-red-600' :
                    area.criticalCount > 5 ? 'text-orange-600' : 'text-yellow-600'
                  }`} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p>Critical: {area.criticalCount}</p>
                  <p>Avg Cost: RM {area.averageCost.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
