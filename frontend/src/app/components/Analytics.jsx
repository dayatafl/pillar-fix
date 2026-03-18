import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Banknote, MapPin, AlertTriangle,
  HandCoins, Sparkles, RefreshCw, ChevronRight, ShieldAlert,
  ChevronDown, ChevronUp, Zap, Wrench, DollarSign, BarChart2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE =
  (typeof window !== 'undefined' && window.__ENV__?.API_URL) ||
  'http://localhost:8000';

const DEFAULT_COORDINATES = { lat: 3.1390, lng: 101.6869 };

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

// ── Config maps ───────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  Critical: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-800',     dot: 'bg-red-500',    bar: '#EF4444' },
  High:     { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800',dot: 'bg-orange-500', bar: '#F97316' },
  Medium:   { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800',dot: 'bg-yellow-500', bar: '#EAB308' },
  Low:      { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800',   dot: 'bg-blue-500',   bar: '#3B82F6' },
};
const RISK_CONTRIBUTION_CONFIG = {
  High:   'bg-red-100 text-red-800 border-red-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low:    'bg-green-100 text-green-800 border-green-200',
};
const EFFICIENCY_CONFIG = {
  Excellent: 'bg-green-100 text-green-800 border-green-200',
  Good:      'bg-blue-100 text-blue-800 border-blue-200',
  Fair:      'bg-yellow-100 text-yellow-800 border-yellow-200',
  Poor:      'bg-red-100 text-red-800 border-red-200',
};
const TREND_CONFIG = {
  Rising:   { color: 'text-red-600',   icon: TrendingUp,   label: 'Rising' },
  Stable:   { color: 'text-blue-600',  icon: Minus,        label: 'Stable' },
  Declining:{ color: 'text-green-600', icon: TrendingDown, label: 'Declining' },
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

function CollapsibleSection({ title, icon: Icon, iconClass = '', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Cost Analysis sub-component ───────────────────────────────────────────
function CostAnalysisReport({ costAnalysis, savingRatePct, savingRateSource, loading }) {
  if (loading) return <SkeletonBlock rows={5} />;
  if (!costAnalysis) return <p className="text-sm text-gray-400">No cost analysis available.</p>;

  const trend     = TREND_CONFIG[costAnalysis.cost_trend] || TREND_CONFIG.Stable;
  const TrendIcon = trend.icon;
  const effCfg    = EFFICIENCY_CONFIG[costAnalysis.cost_efficiency_rating?.split(' ')[0]] || EFFICIENCY_CONFIG.Fair;

  // Locality bar chart data
  const localityChartData = (costAnalysis.locality_breakdown || [])
    .filter(l => l.locality !== 'Unknown' || l.total_cost > 0)
    .map(l => ({ name: l.locality, cost: l.total_cost, avg: l.avg_cost }))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Summary narrative */}
      {costAnalysis.cost_summary && (
        <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3 italic">
          {costAnalysis.cost_summary}
        </p>
      )}

      {/* Saving rate provenance badge */}
      {savingRateSource && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <BarChart2 className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-blue-800">
              Saving rate: {savingRatePct}%
            </span>
            <span className="text-xs text-blue-600 ml-1">— {savingRateSource}</span>
          </div>
        </div>
      )}

      {/* Trend + Efficiency + Most expensive */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Cost trend */}
        <div className="rounded-xl bg-white border border-gray-200 p-3">
          <p className="text-xs text-gray-400 mb-2">Cost Trend</p>
          <div className={`flex items-center gap-1.5 font-semibold text-sm ${trend.color} mb-1`}>
            <TrendIcon className="h-4 w-4" />
            {costAnalysis.cost_trend}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{costAnalysis.cost_trend_explanation}</p>
        </div>

        {/* Efficiency rating */}
        <div className="rounded-xl bg-white border border-gray-200 p-3">
          <p className="text-xs text-gray-400 mb-2">Cost Efficiency</p>
          <span className={`inline-block text-xs px-2 py-1 rounded-sm font-medium border ${effCfg} mb-1`}>
            {costAnalysis.cost_efficiency_rating}
          </span>
        </div>

        {/* Most expensive locality */}
        <div className="rounded-xl bg-white border border-gray-200 p-3">
          <p className="text-xs text-gray-400 mb-2">Highest Cost Area</p>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">{costAnalysis.most_expensive_locality || '—'}</span>
          </div>
        </div>
      </div>

      {/* Locality cost breakdown */}
      {localityChartData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cost by Locality</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={localityChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={v => `RM${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`RM ${v.toLocaleString()}`, 'Total Cost']} />
              <Bar dataKey="cost" fill="#3B82F6" name="Total Cost" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Locality table */}
          <div className="mt-3 space-y-2">
            {costAnalysis.locality_breakdown.map((loc, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-800">{loc.locality}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{loc.task_count} tasks</span>
                    <span className="font-medium text-gray-700">RM {(loc.total_cost || 0).toLocaleString()}</span>
                    <span className="text-gray-400">({(loc.cost_share || 0).toFixed(1)}%)</span>
                  </div>
                </div>
                {/* Cost share bar */}
                <div className="h-1 bg-gray-100 rounded-full mb-1.5 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(loc.cost_share || 0, 100)}%` }} />
                </div>
                <p className="text-xs text-gray-500">{loc.assessment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Severity Report ───────────────────────────────────────────────────────
function SeverityReport({ severityInsights, severitySummary, loading }) {
  if (loading) return <SkeletonBlock rows={4} />;
  if (!severityInsights?.length) return <p className="text-sm text-gray-400">No severity data available.</p>;
  return (
    <div className="space-y-4">
      {severitySummary && (
        <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3 italic">{severitySummary}</p>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{item.count} pillars</span>
                  <span className="text-xs text-gray-400">({item.percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full mb-3 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: cfg.bar }} />
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">{item.analysis}</p>
              <div className="flex items-center gap-1.5">
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

// ── Fault Type Report ─────────────────────────────────────────────────────
function FaultTypeReport({ faultTypeInsights, faultSummary, loading }) {
  if (loading) return <SkeletonBlock rows={4} />;
  if (!faultTypeInsights?.length) return <p className="text-sm text-gray-400">No fault type data available.</p>;
  return (
    <div className="space-y-4">
      {faultSummary && (
        <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3 italic">{faultSummary}</p>
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${riskCfg}`}>{item.risk_contribution} Risk</span>
                  <span className="text-xs text-gray-500">{item.occurrences}×</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-xs text-gray-400">AI Confidence</span>
                <ConfidenceBar value={item.avg_confidence} />
              </div>
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
  const [isMobile, setIsMobile]             = useState(false);
  const [localityCoords, setLocalityCoords] = useState({});
  // ── Chart data (fast, no AI — loads on mount) ───────────────────────────
  const [chartData, setChartData]             = useState([]);
  const [chartLoading, setChartLoading]       = useState(false);
  const [chartMeta, setChartMeta]             = useState(null);

  // ── AI insights (slow, manual only — triggered by Refresh button) ────────
  const [insights, setInsights]               = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError]     = useState(null);
  const [lastFetched, setLastFetched]         = useState(null);

  // Fetch chart data immediately on mount — no AI, just DB costs
  const fetchChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/chart-data`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setChartData(data.chart);
      setChartMeta(data);
    } catch (_) {
      // silent — chart will just be empty until retry
    } finally {
      setChartLoading(false);
    }
  }, []);

  // Fetch AI insights on demand — merges projections into chart
  const fetchInsights = useCallback(async (force = false) => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const url = force
        ? `${API_BASE}/analytics/insights?refresh=true`
        : `${API_BASE}/analytics/insights`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setInsights(data);
      // Merge AI projections into the chart — replace chart with the full series
      if (data.costProjection?.length) {
        setChartData(data.costProjection);
      }
      setLastFetched(new Date());
    } catch (err) {
      setInsightsError(err.message || 'Failed to load AI insights');
    } finally {
      setInsightsLoading(false);
    }
  }, []);
  // Chart data loads immediately on mount — no AI needed
  useEffect(() => { fetchChartData(); }, [fetchChartData]);
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

  const rmFormatter  = v => `RM ${Number(v).toLocaleString()}`;
  const costData     = chartData;  // loaded immediately; AI projections merged in after Refresh
  const potentialSavings = insights?.potentialSavings ?? 0;

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
      const costs = localTasks.map(t => t.estimatedCost).filter(Boolean);
      const averageCost = costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0;
      return { locality, coordinates: localityCoords[locality] || DEFAULT_COORDINATES, issueCount: localTasks.length, criticalCount, averageCost };
    })
    .sort((a, b) => b.issueCount - a.issueCount);

  const faultTypeData = maintenanceItems.reduce((acc, item) => {
    (item.faults || []).forEach(fault => {
      const ex = acc.find(a => a.name === fault);
      if (ex) ex.value += 1; else acc.push({ name: fault, value: 1 });
    });
    return acc;
  }, []);

  const totalCost = maintenanceItems.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
  const avgCost   = maintenanceItems.length > 0 ? totalCost / maintenanceItems.length : 0;

  const tooltipStyles = isMobile
    ? { contentStyle: { fontSize: 12, padding: '8px 10px', borderRadius: 10, borderColor: '#E5E7EB' }, labelStyle: { fontSize: 11, marginBottom: 4, color: '#374151' }, itemStyle: { fontSize: 12 } }
    : { contentStyle: { fontSize: 13, padding: '10px 12px', borderRadius: 10, borderColor: '#E5E7EB' }, labelStyle: { fontSize: 12, marginBottom: 4, color: '#374151' }, itemStyle: { fontSize: 13 } };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([3.1390, 101.6869], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.eachLayer(l => { if (l instanceof L.Circle) mapRef.current?.removeLayer(l); });
    hotspotAreas.forEach(area => {
      const circle = L.circle([area.coordinates.lat, area.coordinates.lng], {
        color:       area.criticalCount > 8 ? '#EF4444' : area.criticalCount > 5 ? '#F97316' : '#EAB308',
        fillColor:   area.criticalCount > 8 ? '#EF4444' : area.criticalCount > 5 ? '#F97316' : '#EAB308',
        fillOpacity: 0.3, radius: area.issueCount * 100,
      }).addTo(mapRef.current);
      circle.bindPopup(`
        <div style="min-width:200px;">
          <h3 style="font-weight:bold;margin-bottom:8px;">${area.locality}</h3>
          <p style="font-size:12px;margin:4px 0;">Total Issues: ${area.issueCount}</p>
          <p style="font-size:12px;margin:4px 0;">Critical: ${area.criticalCount}</p>
          <p style="font-size:12px;margin:4px 0;">Avg Cost: RM ${area.averageCost.toLocaleString()}</p>
        </div>`);
    });
  }, [hotspotAreas, localityCoords]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold">Analytics & Insights</h2>
          <p className="text-gray-500 mt-1">AI-powered cost forecasting and hotspot analysis</p>
        </div>
        {lastFetched && <p className="text-xs text-gray-400 mt-1 hidden md:block">Updated {lastFetched.toLocaleTimeString()}</p>}
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
              : insights
                ? <div className="text-2xl font-bold text-green-600">RM {potentialSavings.toLocaleString()}</div>
                : <div className="text-2xl font-bold text-gray-300">—</div>
            }
            <p className="text-xs text-gray-500 mt-1">
              With preventive maintenance (12 mo)
              {insights?.stats?.saving_rate_pct != null && (
                <span className="ml-1 text-gray-400">
                  · {insights.stats.saving_rate_pct}% saving
                </span>
              )}
            </p>
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

      {/* AI Insights panel */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-blue-900">AI-Generated Insights</CardTitle>
              {insights?.riskLevel && <RiskBadge level={insights.riskLevel} />}
            </div>
            <button
              onClick={() => fetchInsights(true)}
              disabled={insightsLoading}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Error */}
          {insightsError && !insightsLoading && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{insightsError}</span>
              <button onClick={fetchInsights} className="ml-auto underline text-xs">Retry</button>
            </div>
          )}

          {(insightsLoading || insights) && (
            <>
              {/* Executive summary */}
              <div>
                {insightsLoading
                  ? <SkeletonBlock rows={2} />
                  : insights
                    ? <p className="text-sm text-blue-900 leading-relaxed">{insights.insight}</p>
                    : <p className="text-sm text-gray-400 italic">Click Refresh to generate the AI report.</p>
                }
              </div>

              <hr className="border-blue-100" />

              {/* Cost Analysis */}
              <CollapsibleSection title="Cost Analysis" icon={DollarSign} iconClass="text-blue-500" defaultOpen={false}>
                <CostAnalysisReport
                  costAnalysis={insights?.costAnalysis}
                  savingRatePct={insights?.stats?.saving_rate_pct}
                  savingRateSource={insights?.stats?.saving_rate_source}
                  loading={insightsLoading}
                />
              </CollapsibleSection>

              <hr className="border-blue-100" />

              {/* Severity */}
              <CollapsibleSection title="Severity Level Analysis" icon={ShieldAlert} iconClass="text-orange-500" defaultOpen={false}>
                <SeverityReport
                  severityInsights={insights?.severityInsights}
                  severitySummary={insights?.severitySummary}
                  loading={insightsLoading}
                />
              </CollapsibleSection>

              <hr className="border-blue-100" />

              {/* Fault types */}
              <CollapsibleSection title="Fault Type Analysis" icon={Wrench} iconClass="text-blue-500" defaultOpen={false}>
                <FaultTypeReport
                  faultTypeInsights={insights?.faultTypeInsights}
                  faultSummary={insights?.faultSummary}
                  loading={insightsLoading}
                />
              </CollapsibleSection>

              <hr className="border-blue-100" />

              {/* Recommendations */}
              <CollapsibleSection title="Recommendations" icon={ChevronRight} iconClass="text-green-500" defaultOpen>
                {insightsLoading
                  ? <SkeletonBlock rows={3} />
                  : (
                    <ul className="space-y-2">
                      {(insights?.recommendations ?? []).map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )
                }
              </CollapsibleSection>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cost History + 12-Month Projection chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Cost History &amp; 12-Month Projection
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 h-0.5 bg-blue-500" />
                Actual
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 h-0.5 bg-orange-400" style={{borderTop: '2px dashed #fb923c'}} />
                Projected
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 h-0.5 bg-emerald-500" />
                Preventive
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="w-full h-64 bg-gray-100 rounded-lg animate-pulse" />
          ) : costData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-sm text-gray-400">No data yet.</p>
            </div>
          ) : (
            <>
              {/* Projection pending notice — shown before AI is run */}
              {!insights && !insightsLoading && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                  Click <strong className="mx-1">Refresh</strong> in the AI Insights panel above to add the 12-month cost projection.
                </div>
              )}
              {/* Mock data notice */}
              {costData.some(d => d.is_mock) && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                  Historical months with no tasks yet are shown as estimated values based on average cost and Malaysian seasonal patterns.
                </div>
              )}
              <div className={isMobile ? 'w-full overflow-x-auto' : ''}>
                <ResponsiveContainer width="100%" height={isMobile ? 320 : 420} minWidth={isMobile ? 340 : undefined}>
                  <LineChart data={costData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: isMobile ? 10 : 11 }} />
                    <YAxis
                      tick={{ fontSize: isMobile ? 10 : 11 }}
                      width={isMobile ? 52 : 64}
                      tickFormatter={v => `RM${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        value != null ? `RM ${Number(value).toLocaleString()}` : '—',
                        name
                      ]}
                      contentStyle={tooltipStyles.contentStyle}
                      labelStyle={tooltipStyles.labelStyle}
                      itemStyle={tooltipStyles.itemStyle}
                    />
                    {/* Actual historical line — solid blue */}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (payload.actual == null) return null;
                        return (
                          <circle
                            key={`dot-${payload.month}`}
                            cx={cx} cy={cy} r={3}
                            fill={payload.is_mock ? '#93C5FD' : '#3B82F6'}
                            stroke={payload.is_mock ? '#BFDBFE' : '#2563EB'}
                            strokeWidth={payload.is_mock ? 1.5 : 1}
                            strokeDasharray={payload.is_mock ? '3 2' : 'none'}
                          />
                        );
                      }}
                      connectNulls={false}
                      name="Actual cost"
                    />
                    {/* Projected reactive line — dashed orange */}
                    <Line
                      type="monotone"
                      dataKey="projected"
                      stroke="#F97316"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls={false}
                      name="Projected (reactive)"
                    />
                    {/* Preventive line — solid green */}
                    <Line
                      type="monotone"
                      dataKey="preventive"
                      stroke="#10B981"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={false}
                      connectNulls={false}
                      name="With preventive maintenance"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {potentialSavings > 0 && (
                <div className={`mt-4 rounded-lg bg-green-50 ${isMobile ? 'p-3' : 'p-4'}`}>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-900`}>
                    <strong>12-Month Projected Savings:</strong> Adopting preventive maintenance could save up to{' '}
                    <strong>RM {potentialSavings.toLocaleString()}</strong>.
                    {insights?.stats?.saving_rate_pct && (
                      <span className="text-green-700 ml-1">
                        ({insights.stats.saving_rate_pct}% saving rate — {insights.stats.saving_rate_source})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Severity pie + Fault bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Pillar Count by Severity Level</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%"
                  label={({ name, value }) => (value > 0 ? `${name}: ${value}` : null)}
                  labelLine={false} outerRadius={100} dataKey="value">
                  {severityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
                <XAxis dataKey="name" angle={isMobile ? -20 : -45} textAnchor="end"
                  height={isMobile ? 60 : 100} tick={{ fontSize: isMobile ? 10 : 12 }}
                  tickFormatter={v => isMobile && typeof v === 'string' && v.length > 14 ? `${v.slice(0, 14)}…` : v} />
                <YAxis tick={{ fontSize: isMobile ? 11 : 12 }} width={isMobile ? 42 : undefined} />
                <Tooltip contentStyle={isMobile ? { fontSize: 12, padding: '8px 10px', borderRadius: 10 } : undefined} />
                <Bar dataKey="value" fill="#3B82F6" name="Occurrences" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hotspot map */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>Pillar Hotspot Areas</CardTitle></CardHeader>
        <CardContent>
          <div ref={mapContainerRef} className="w-full h-[500px] relative z-0 rounded-lg mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hotspotAreas.map((area, i) => (
              <div key={i} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}