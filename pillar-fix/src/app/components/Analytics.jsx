import { useEffect, useRef } from 'react';
import { TrendingUp, DollarSign, MapPin, AlertTriangle } from 'lucide-react';
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

export function Analytics({ maintenanceItems }) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  // Cost forecasting data
  const costData = [
    { month: 'Jan', actual: 45000, predicted: 42000, preventive: 35000 },
    { month: 'Feb', actual: 52000, predicted: 48000, preventive: 38000 },
    { month: 'Mar', actual: 48000, predicted: 50000, preventive: 36000 },
    { month: 'Apr', actual: 61000, predicted: 55000, preventive: 40000 },
    { month: 'May', actual: 55000, predicted: 58000, preventive: 42000 },
    { month: 'Jun', actual: 67000, predicted: 62000, preventive: 45000 },
    { month: 'Jul', actual: 0, predicted: 65000, preventive: 47000 },
    { month: 'Aug', actual: 0, predicted: 68000, preventive: 48000 },
    { month: 'Sep', actual: 0, predicted: 70000, preventive: 50000 },
  ];

  // Severity distribution
  const severityData = [
    { name: 'Critical', value: maintenanceItems.filter(i => i.severity === 'Critical').length, color: '#EF4444' },
    { name: 'High', value: maintenanceItems.filter(i => i.severity === 'High').length, color: '#F97316' },
    { name: 'Medium', value: maintenanceItems.filter(i => i.severity === 'Medium').length, color: '#EAB308' },
    { name: 'Low', value: maintenanceItems.filter(i => i.severity === 'Low').length, color: '#3B82F6' },
  ];

  // Hotspot areas (Malaysia)
  const hotspotAreas = [
    {
      locality: 'Kuala Lumpur City Centre (KLCC)',
      coordinates: { lat: 3.1579, lng: 101.7123 },
      issueCount: 48,
      criticalCount: 14,
      averageCost: 6200,
    },
    {
      locality: 'Bukit Bintang',
      coordinates: { lat: 3.1466, lng: 101.7101 },
      issueCount: 36,
      criticalCount: 9,
      averageCost: 5100,
    },
    {
      locality: 'Petaling Jaya',
      coordinates: { lat: 3.1073, lng: 101.6067 },
      issueCount: 29,
      criticalCount: 6,
      averageCost: 4700,
    },
    {
      locality: 'Subang Jaya',
      coordinates: { lat: 3.0439, lng: 101.5800 },
      issueCount: 22,
      criticalCount: 4,
      averageCost: 4300,
    },
  ];

  // Fault type distribution
  const faultTypeData = maintenanceItems.reduce((acc, item) => {
    item.faults.forEach(fault => {
      const existing = acc.find(a => a.name === fault);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: fault, value: 1 });
      }
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

  // Add hotspot markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Circle) {
        mapRef.current?.removeLayer(layer);
      }
    });

    // Add hotspot circles
    hotspotAreas.forEach((area) => {
      const radius = area.issueCount * 100;
      const circle = L.circle([area.coordinates.lat, area.coordinates.lng], {
        color: area.criticalCount > 8 ? '#EF4444' : area.criticalCount > 5 ? '#F97316' : '#EAB308',
        fillColor: area.criticalCount > 8 ? '#EF4444' : area.criticalCount > 5 ? '#F97316' : '#EAB308',
        fillOpacity: 0.3,
        radius: radius,
      }).addTo(mapRef.current);

      circle.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="font-weight: bold; margin-bottom: 8px;">${area.locality}</h3>
          <p style="font-size: 12px; margin: 4px 0;">Total Issues: ${area.issueCount}</p>
          <p style="font-size: 12px; margin: 4px 0;">Critical: ${area.criticalCount}</p>
          <p style="font-size: 12px; margin: 4px 0;">Avg Cost: $${area.averageCost.toLocaleString()}</p>
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
        <p className="text-gray-600 mt-1">
          Cost optimization forecasting and hotspot analysis
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Maintenance Cost
            </CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalCost.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Average Cost per Issue
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${Math.round(avgCost).toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Per maintenance item</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Potential Savings
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${potentialSavings.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">With preventive maintenance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Hotspot Areas
            </CardTitle>
            <MapPin className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hotspotAreas.length}</div>
            <p className="text-xs text-gray-500 mt-1">High-activity zones</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Optimization Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) => `$${value.toLocaleString()}`}
              />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#3B82F6" strokeWidth={2} name="Actual Cost" />
              <Line type="monotone" dataKey="predicted" stroke="#F97316" strokeWidth={2} strokeDasharray="5 5" name="Predicted Cost" />
              <Line type="monotone" dataKey="preventive" stroke="#10B981" strokeWidth={2} name="With Preventive Maintenance" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-900">
              <strong>Insight:</strong> Implementing preventive maintenance could reduce costs by ${potentialSavings.toLocaleString()} per month. 
              The AI detection system helps identify issues early, reducing expensive reactive repairs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Issue Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
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

        {/* Fault Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Fault Type Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={faultTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" name="Occurrences" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hotspot Map */}
      <Card>
        <CardHeader>
          <CardTitle>Issue Hotspot Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={mapContainerRef}
            className="w-full h-[500px] rounded-lg mb-4"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hotspotAreas.map((area, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{area.locality}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {area.issueCount} total issues
                    </p>
                  </div>
                  {area.criticalCount > 8 ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : area.criticalCount > 5 ? (
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p>Critical: {area.criticalCount}</p>
                  <p>Avg Cost: RM ${area.averageCost.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
