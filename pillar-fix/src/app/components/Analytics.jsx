import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TrendingUp, Banknote, MapPin, AlertTriangle, HandCoins,
  Sparkles, RefreshCw, ChevronRight, ShieldAlert,
  ChevronDown, ChevronUp, Zap, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_COORDINATES = { lat: 3.1390, lng: 101.6869 };
const API_BASE = 'http://localhost:8000';

async function geocodeLocality(locality) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locality + ', Malaysia')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (_) {}
  return DEFAULT_COORDINATES;
}

// ── Severity color map ────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  Critical: { bg: 'bg-red-50',     border: 'border-red-200',   badge: 'bg-red-100 text-red-800',     dot: 'bg-red-500',    bar: '#EF4444' },
  High:     { bg: 'bg-orange-50',  border: 'border-orange-200',badge: 'bg-orange-100 text-orange-800',dot: 'bg-orange-500', bar: '#F97316' },
  Medium:   { bg: 'bg-yellow-50',  border: 'border-yellow-200',badge: 'bg-yellow-100 text-yellow-800',dot: 'bg-yellow-500', bar: '#EAB308' },
  Low:      { bg: 'bg-blue-50',    border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500',   bar: '#3B82F6' },
};

const RISK_CONTRIBUTION_CONFIG = {
  High:   'bg-red-100 text-red-800 border-red-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low:    'bg-green-100 text-green-800 border-green-200',
};

// ── Small reusable pieces ─────────────────────────────────────────────────
function RiskBadge({ level }) {
  const styles = {
    Low:      'bg-green-100 text-green-800 border-green-200',
    Medium:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    High:     'bg-orange-100 text-orange-800 border-orange-200',
    Critical: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[level] || styles.Low}`}>
      <ShieldAlert className="h-3 w-3" />
      {level}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? 'bg-red-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

function SkeletonBlock({ rows = 3, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-4 bg-gray-200 rounded ${i % 2 === 0 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  );
}

// ── Collapsible section wrapper ───────────────────────────────────────────
function CollapsibleSection({ title, icon: Icon, iconClass = '', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 text-left group"
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400" />
          : <ChevronDown className="h-4 w-4 text-gray-400" />
        }
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Severity Report sub-component ─────────────────────────────────────────
function SeverityReport({ severityInsights, severitySummary, loading }) {
  if (loading) return <SkeletonBlock rows={4} />;
  if (!severityInsights?.length) return <p className="text-sm text-gray-400">No severity data available.</p>;

  return (
    <div className="space-y-4">
      {severitySummary && (
        <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3 italic">
          {severitySummary}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {severityInsights.map((item) => {
          const cfg = SEVERITY_CONFIG[item.level] || SEVERITY_CONFIG.Low;
          return (
            <div key={item.level} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="font-semibold text-sm text-gray-800">{item.level}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                    {item.count} pillars
                  </span>
                  <span className="text-xs text-gray-400">({item.percentage.toFixed(1)}%)</span>
                </div>
              </div>

              {/* Percentage bar */}
              <div className="h-1.5 bg-white/60 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.percentage}%`, backgroundColor: cfg.bar }}
                />
              </div>

              <p className="text-xs text-gray-600 leading-relaxed mb-2">{item.analysis}</p>
              <div className="flex items-center gap-1.5 mt-auto">
                <Zap className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="text-xs font-medium text-gray-500">{item.urgency}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fault Type Report sub-component ──────────────────────────────────────
function FaultTypeReport({ faultTypeInsights, faultSummary, loading }) {
  if (loading) return <SkeletonBlock rows={4} />;
  if (!faultTypeInsights?.length) return <p className="text-sm text-gray-400">No fault type data available.</p>;

  return (
    <div className="space-y-4">
      {faultSummary && (
        <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3 italic">
          {faultSummary}
        </p>
      )}
      <div className="space-y-2">
        {faultTypeInsights.map((item, idx) => {
          const riskCfg = RISK_CONTRIBUTION_CONFIG[item.risk_contribution] || RISK_CONTRIBUTION_CONFIG.Low;
          return (
            <div key={item.fault_type} className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-4">#{idx + 1}</span>
                  <span className="font-semibold text-sm text-gray-800">{item.fault_type}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${riskCfg}`}>
                    {item.risk_contribution} Risk
                  </span>
                  <span className="text-xs text-gray-500">{item.occurrences}×</span>
                </div>
              </div>

              {/* AI confidence bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">AI Confidence</span>
                </div>
                <ConfidenceBar value={item.avg_confidence} />
              </div>

              {/* Recommendation */}
              <div className="flex items-start gap-1.5 mt-2">
                <Wrench className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">{item.recommendation}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Analytics component
// ═══════════════════════════════════════════════════════════════════════════
export function Analytics({ maintenanceItems, tasks = [] }) {
  const mapRef          = useRef(null);
  const mapContainerRef = useRef(null);
  const hotspotCirclesRef = useRef(new Map());
  const [isMobile, setIsMobile] = useState(false);

  // Geocoded coordinates keyed by locality name
  const [localityCoords, setLocalityCoords] = useState({});

  // AI insights state
  const [insights, setInsights]               = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError]     = useState(null);
  const [lastFetched, setLastFetched]         = useState(null);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/insights`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setInsights(data);
      setLastFetched(new Date());
    } catch (err) {
      setInsightsError(err.message || 'Failed to load AI insights');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const localities = [...new Set(tasks.map(t => t.locality).filter(Boolean))];
    if (!localities.length) return;
    localities.forEach((locality, i) => {
      setTimeout(async () => {
        const coords = await geocodeLocality(locality);
        setLocalityCoords(prev => ({ ...prev, [locality]: coords }));
      }, i * 300);
    });
  }, []);

  // Derived values
  const rmFormatter  = (value) => `RM ${Number(value).toLocaleString()}`;
  const costData     = insights?.costProjection ?? [];

  const severityData = [
    { name: 'Critical', value: maintenanceItems.filter(i => i.severity === 'Critical').length, color: '#EF4444' },
    { name: 'High',     value: maintenanceItems.filter(i => i.severity === 'High').length,     color: '#F97316' },
    { name: 'Medium',   value: maintenanceItems.filter(i => i.severity === 'Medium').length,   color: '#EAB308' },
    { name: 'Low',      value: maintenanceItems.filter(i => i.severity === 'Low').length,      color: '#3B82F6' },
  ];

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
      const costs         = localTasks.map(t => t.estimatedCost).filter(Boolean);
      const averageCost   = costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0;
      return {
        locality,
        coordinates: localityCoords[locality] || DEFAULT_COORDINATES,
        issueCount: localTasks.length,
        criticalCount,
        averageCost,
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount);

  const faultTypeData = maintenanceItems.reduce((acc, item) => {
    item.faults.forEach(fault => {
      const existing = acc.find(a => a.name === fault);
      if (existing) existing.value += 1;
      else acc.push({ name: fault, value: 1 });
    });
    return acc;
  }, []);

  const totalCost        = maintenanceItems.reduce((sum, item) => sum + item.estimatedCost, 0);
  const avgCost          = maintenanceItems.length > 0 ? totalCost / maintenanceItems.length : 0;
  const potentialSavings = insights?.potentialSavings ?? 0;

  const tooltipStyles = isMobile
    ? { contentStyle: { fontSize: 12, padding: '8px 10px', borderRadius: 10, borderColor: '#E5E7EB' }, labelStyle: { fontSize: 11, marginBottom: 4, color: '#374151' }, itemStyle: { fontSize: 12 } }
    : { contentStyle: { fontSize: 13, padding: '10px 12px', borderRadius: 10, borderColor: '#E5E7EB' }, labelStyle: { fontSize: 12, marginBottom: 4, color: '#374151' }, itemStyle: { fontSize: 13 } };

  // Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([3.1390, 101.6869], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Re-draw circles whenever hotspotAreas or localityCoords updates
  useEffect(() => {
    if (!mapRef.current) return;
    hotspotCirclesRef.current.clear();
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
        <div style="min-width:200px;">
          <h3 style="font-weight:bold;margin-bottom:8px;">${area.locality}</h3>
          <p style="font-size:12px;margin:4px 0;">Total Issues: ${area.issueCount}</p>
          <p style="font-size:12px;margin:4px 0;">Critical: ${area.criticalCount}</p>
          <p style="font-size:12px;margin:4px 0;">Avg Cost: RM ${area.averageCost.toLocaleString()}</p>
        </div>
      `);
      hotspotCirclesRef.current.set(area.locality, circle);
    });
  }, [hotspotAreas, localityCoords]);

  const handleHotspotClick = (area) => {
    const map = mapRef.current;
    if (!map) return;

    const targetZoom = Math.max(map.getZoom(), 15);
    map.flyTo([area.coordinates.lat, area.coordinates.lng], targetZoom, { duration: 0.8 });

    const circle = hotspotCirclesRef.current.get(area.locality);
    if (circle) window.setTimeout(() => circle.openPopup(), 250);

    if (isMobile && mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Analytics & Insights</h2>
          <p className="text-gray-500 mt-1">AI-powered cost forecasting and hotspot analysis</p>
        </div>
        {lastFetched && (
          <p className="text-xs text-gray-400 mt-1 hidden md:block">
            Updated {lastFetched.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* KPI cards */}
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
            {insightsLoading
              ? <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
              : <div className="text-2xl font-bold text-green-600">RM {potentialSavings.toLocaleString()}</div>
            }
            <p className="text-xs text-gray-500 mt-1">With preventive maintenance (6 mo)</p>
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

      {/* ── AI Insights panel ─────────────────────────────────────────────── */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-blue-900">AI-Generated Insights</CardTitle>
              {insights?.riskLevel && <RiskBadge level={insights.riskLevel} />}
            </div>
            <button
              onClick={fetchInsights}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Error state */}
          {insightsError && !insightsLoading && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{insightsError}</span>
              <button onClick={fetchInsights} className="ml-auto underline text-xs">Retry</button>
            </div>
          )}

          {/* Executive summary */}
          {(insightsLoading || insights) && (
            <div>
              {insightsLoading
                ? <SkeletonBlock rows={2} />
                : <p className="text-sm text-blue-900 leading-relaxed">{insights.insight}</p>
              }
            </div>
          )}

          {/* Divider */}
          {(insightsLoading || insights) && <hr className="border-blue-100" />}

          {/* Severity report */}
          {(insightsLoading || insights?.severityInsights) && (
            <CollapsibleSection
              title="Severity Level Analysis"
              icon={ShieldAlert}
              iconClass="text-orange-500"
              defaultOpen
            >
              <SeverityReport
                severityInsights={insights?.severityInsights}
                severitySummary={insights?.severitySummary}
                loading={insightsLoading}
              />
            </CollapsibleSection>
          )}

          {/* Divider */}
          {(insightsLoading || insights?.faultTypeInsights) && <hr className="border-blue-100" />}

          {/* Fault type report */}
          {(insightsLoading || insights?.faultTypeInsights) && (
            <CollapsibleSection
              title="Fault Type Analysis"
              icon={Wrench}
              iconClass="text-blue-500"
              defaultOpen
            >
              <FaultTypeReport
                faultTypeInsights={insights?.faultTypeInsights}
                faultSummary={insights?.faultSummary}
                loading={insightsLoading}
              />
            </CollapsibleSection>
          )}

          {/* Divider */}
          {(insightsLoading || insights?.recommendations) && <hr className="border-blue-100" />}

          {/* Recommendations */}
          {(insightsLoading || insights?.recommendations) && (
            <CollapsibleSection
              title="Recommendations"
              icon={ChevronRight}
              iconClass="text-green-500"
              defaultOpen
            >
              {insightsLoading
                ? <SkeletonBlock rows={3} />
                : (
                  <ul className="space-y-2">
                    {insights.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                )
              }
            </CollapsibleSection>
          )}
        </CardContent>
      </Card>

      {/* ── Cost Forecast chart ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-600">
            6-Month Cost Projection
            {insights?.costProjection && (
              <span className="ml-2 text-xs text-gray-400 font-normal">AI-generated from current data</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <div className="w-full h-64 bg-gray-100 rounded-lg animate-pulse" />
          ) : costData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400">
              No projection data available yet
            </div>
          ) : (
            <>
              <div className={isMobile ? 'w-full overflow-x-auto' : ''}>
                <ResponsiveContainer width="100%" height={isMobile ? 320 : 400} minWidth={isMobile ? 320 : undefined}>
                  <LineChart data={costData} margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 4 } : undefined}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: isMobile ? 11 : 12 }} />
                    <YAxis tick={{ fontSize: isMobile ? 11 : 12 }} width={isMobile ? 48 : undefined} />
                    <Tooltip formatter={rmFormatter} contentStyle={tooltipStyles.contentStyle} labelStyle={tooltipStyles.labelStyle} itemStyle={tooltipStyles.itemStyle} />
                    <Legend align="center" verticalAlign="bottom" height={isMobile ? 52 : 36} iconSize={isMobile ? 10 : 14} wrapperStyle={{ fontSize: isMobile ? 12 : 13 }} />
                    <Line type="monotone" dataKey="projected"  stroke="#F97316" strokeWidth={2} strokeDasharray="5 5" name="Projected (Reactive)" />
                    <Line type="monotone" dataKey="preventive" stroke="#10B981" strokeWidth={2} name="With Preventive Maintenance" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {potentialSavings > 0 && (
                <div className={`mt-4 rounded-lg bg-green-50 ${isMobile ? 'p-3' : 'p-4'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-900`}>
                    <strong>Projected Savings:</strong> Adopting preventive maintenance could save up to{' '}
                    <strong>RM {potentialSavings.toLocaleString()}</strong> over the next 6 months.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Severity pie + fault bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Pillar Count by Severity Level</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle>Pillar Fault Type Frequency</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
              <BarChart data={faultTypeData} margin={isMobile ? { top: 8, right: 8, left: 0, bottom: 0 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={isMobile ? -20 : -45}
                  textAnchor="end"
                  height={isMobile ? 60 : 100}
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  tickFormatter={v => isMobile && typeof v === 'string' && v.length > 14 ? `${v.slice(0, 14)}…` : v}
                />
                <YAxis tick={{ fontSize: isMobile ? 11 : 12 }} width={isMobile ? 42 : undefined} />
                <Tooltip contentStyle={isMobile ? { fontSize: 12, padding: '8px 10px', borderRadius: 10 } : undefined} />
                <Bar dataKey="value" fill="#3B82F6" name="Occurrences" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Hotspot map ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>Pillar Hotspot Areas</CardTitle></CardHeader>
        <CardContent>
          <div ref={mapContainerRef} className="w-full h-[500px] relative z-0 rounded-lg mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hotspotAreas.map((area, index) => (
	              <button
	                key={index}
	                type="button"
	                onClick={() => handleHotspotClick(area)}
	                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left cursor-pointer"
	                title="Zoom map to this locality"
	              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{area.locality}</h4>
                    <p className="text-sm text-gray-600 mt-1">{area.issueCount} total pillars</p>
                  </div>
                  <AlertTriangle className={`h-5 w-5 ${area.criticalCount > 8 ? 'text-red-600' : area.criticalCount > 5 ? 'text-orange-600' : 'text-yellow-600'}`} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p>Critical: {area.criticalCount}</p>
                  <p>Avg Cost: RM {area.averageCost.toLocaleString()}</p>
                </div>
	              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}