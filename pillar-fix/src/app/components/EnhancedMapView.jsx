import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Button } from "./ui/button";
import { Search, MapPin, Filter, X } from "lucide-react";
import "leaflet/dist/leaflet.css";

export function EnhancedMapView({
  maintenanceItems,
  auditTasks,
  submissions,
  onPillarSelect,
}) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markersRef = useRef([]);
  const selectedMarkerRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPillar, setSelectedPillar] = useState(null);
  const [hasMaintenanceRecord, setHasMaintenanceRecord] = useState(false);

  const getPillarStatus = (task) => {
    const maintenanceItem = maintenanceItems.find((item) => item.pillarId === task.pillarId);
    if (maintenanceItem && (maintenanceItem.status === "Completed" || maintenanceItem.status === "Verified")) return "repaired";
    const submission = submissions.find((s) => s.pillarId === task.pillarId);
    if (submission && submission.detectionStatus === "Completed") return "in-progress";
    if (maintenanceItem && ["In Progress", "Scheduled", "Pending"].includes(maintenanceItem.status)) return "in-progress";
    if (task.status === "In Progress" || task.status === "Completed") return "in-progress";
    return "not-examined";
  };

  const pillars = auditTasks.map((task) => ({
    ...task,
    status: getPillarStatus(task),
    lastInspection: task.status !== "Pending" ? new Date().toISOString() : undefined,
    severity: maintenanceItems.find((item) => item.pillarId === task.pillarId)?.severity,
  }));

  const filteredPillars = pillars.filter((pillar) => {
    const matchesSearch =
      pillar.pillarId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pillar.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || pillar.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (selectedPillar) {
      const itemExists = maintenanceItems.some((m) => m.pillarId === selectedPillar.pillarId);
      setHasMaintenanceRecord(itemExists);
    } else {
      setHasMaintenanceRecord(false);
    }
  }, [selectedPillar, maintenanceItems]);

  const createMarkerIcon = (color, isSelected = false) => {
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          background-color: ${color};
          width: ${isSelected ? "36px" : "24px"};
          height: ${isSelected ? "36px" : "24px"};
          border-radius: 50%;
          border: ${isSelected ? "5px" : "3px"} solid white;
          box-shadow: ${
            isSelected
              ? `0 4px 16px rgba(0,0,0,0.4), 0 0 0 10px ${color}60, 0 0 50px ${color}`
              : `0 2px 8px rgba(0,0,0,0.3)`
          };
          cursor: pointer;
        "></div>
      `,
      iconSize: [isSelected ? 36 : 24, isSelected ? 36 : 24],
      iconAnchor: [isSelected ? 18 : 12, isSelected ? 18 : 12],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([3.139, 101.6869], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
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

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    selectedMarkerRef.current = null;

    filteredPillars.forEach((pillar) => {
      const color =
        pillar.status === "repaired"
          ? "#22c55e"
          : pillar.status === "in-progress"
          ? "#eab308"
          : "#ef4444";

      const icon = createMarkerIcon(color, false);

      const marker = L.marker(
        [pillar.coordinates.lat, pillar.coordinates.lng],
        { icon }
      )
        .addTo(mapRef.current)
        .on("click", () => {
          if (selectedMarkerRef.current) {
            const prevColor =
              selectedMarkerRef.current.pillar.status === "repaired"
                ? "#22c55e"
                : selectedMarkerRef.current.pillar.status === "in-progress"
                ? "#eab308"
                : "#ef4444";
            selectedMarkerRef.current.marker.setIcon(createMarkerIcon(prevColor, false));
          }

          marker.setIcon(createMarkerIcon(color, true));
          selectedMarkerRef.current = { marker, pillar };
          setSelectedPillar(pillar);
        });

      marker.bindPopup(`
        <div style="padding: 8px;">
          <strong>${pillar.pillarId}</strong><br/>
          <span style="font-size: 12px;">${pillar.location}</span><br/>
          <span style="
            display: inline-block;
            margin-top: 4px;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            background-color: ${color};
            color: white;
          ">
            ${pillar.status === "repaired" ? "Repaired" : pillar.status === "in-progress" ? "In Progress" : "Not Examined"}
          </span>
        </div>
      `);

      markersRef.current.push(marker);
    });

    if (filteredPillars.length > 0) {
      const bounds = L.latLngBounds(
        filteredPillars.map((p) => [p.coordinates.lat, p.coordinates.lng])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [filteredPillars]);

  const getStatusColor = (status) => {
    switch (status) {
      case "repaired": return "bg-green-100 text-green-800 border-green-300";
      case "in-progress": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "not-examined": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "repaired": return "Repaired";
      case "in-progress": return "In Progress";
      case "not-examined": return "Not Examined";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Asset Map</h2>
        <p className="text-gray-500 mt-1">Track and manage all feeder pillars on an interactive map</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Pillars</CardTitle>
            <MapPin className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pillars.length}</div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Repaired</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pillars.filter((p) => p.status === "repaired").length}</div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pillars.filter((p) => p.status === "in-progress").length}</div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Not Examined</CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pillars.filter((p) => p.status === "not-examined").length}</div>
            <p className="text-xs text-gray-500 mt-1">&nbsp;</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="px-4 pb-2 pt-4 bg-white">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <CardTitle>Interactive Map</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Click on markers to view pillar details</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not-examined">Not Examined</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="repaired">Repaired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="!p-0 border-t">
          <div className="relative w-full h-[550px] overflow-hidden">
            {/* Map Container */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0" />

            {/* Floating Legend Overlay */}
            <div className="absolute top-4 right-4 z-[50] bg-white/90 backdrop-blur shadow-lg rounded-lg p-3 border w-48">
              <h3 className="text-xs font-bold mb-2 uppercase tracking-wider text-gray-500">
                Map Legend
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  Repaired
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  In Progress / Repairing
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  Not Examined
                </div>
              </div>
            </div>

            {/* Floating Detail Panel */}
            {selectedPillar && (
              <Card className="absolute bottom-4 left-4 z-[1000] w-80 shadow-2xl border-blue-100 animate-in fade-in slide-in-from-bottom-2">
                <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-bold text-blue-900">Pillar Details</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPillar(null)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Pillar ID</p>
                      <p className="text-sm font-semibold">{selectedPillar.pillarId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Status</p>
                      <Badge className={`${getStatusColor(selectedPillar.status)} text-[10px] px-2 py-0 h-5`}>
                        {getStatusLabel(selectedPillar.status)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Location</p>
                    <p className="text-sm leading-tight text-gray-700">{selectedPillar.location}</p>
                  </div>
                  {selectedPillar.severity && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Severity</p>
                      <Badge variant="outline">{selectedPillar.severity}</Badge>
                    </div>
                  )}
                  {selectedPillar.lastInspection && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Last Inspection</p>
                      <p className="text-sm">{new Date(selectedPillar.lastInspection).toLocaleDateString()}</p>
                    </div>
                  )}
                  {onPillarSelect && (
                    <Button
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700 h-9 text-xs"
                      onClick={() => onPillarSelect(selectedPillar.pillarId)}
                      disabled={!hasMaintenanceRecord}
                      title={
                        !hasMaintenanceRecord
                          ? "No maintenance record found for this pillar."
                          : "View full maintenance details"
                      }
                    >
                      {hasMaintenanceRecord ? "View Maintenance Log" : "No Maintenance Records"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}