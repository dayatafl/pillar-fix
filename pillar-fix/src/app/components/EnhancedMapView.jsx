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
import { Search, MapPin, Filter } from "lucide-react";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPillar, setSelectedPillar] = useState(null);
  const [hasMaintenanceRecord, setHasMaintenanceRecord] = useState(false); // NEW STATE

  // Convert audit tasks to pillar map data with correct status logic
  const getPillarStatus = (task) => {
    // Check if maintenance is completed for this task
    const maintenanceItem = maintenanceItems.find(
      (item) => item.pillarId === task.pillarId,
    );
    if (
      maintenanceItem &&
      (maintenanceItem.status === "Completed" ||
        maintenanceItem.status === "Verified")
    ) {
      return "repaired";
    }

    // Check if waiting for validation or maintenance
    const submission = submissions.find((s) => s.pillarId === task.pillarId);
    if (submission && submission.detectionStatus === "Completed") {
      return "in-progress"; // Waiting for supervisor validation
    }

    if (
      maintenanceItem &&
      (maintenanceItem.status === "In Progress" ||
        maintenanceItem.status === "Scheduled" ||
        maintenanceItem.status === "Pending")
    ) {
      return "in-progress"; // Waiting to be maintained
    }

    if (task.status === "In Progress" || task.status === "Completed") {
      return "in-progress"; // Task started but not yet validated
    }

    // Task not started yet
    return "not-examined";
  };

  const pillars = auditTasks.map((task) => ({
    id: task.id,
    pillarId: task.pillarId,
    location: task.location,
    coordinates: task.coordinates,
    status: getPillarStatus(task),
    lastInspection:
      task.status !== "Pending" ? new Date().toISOString() : undefined,
    severity: maintenanceItems.find((item) => item.pillarId === task.pillarId)
      ?.severity,
  }));

  // Filter pillars based on search and status
  const filteredPillars = pillars.filter((pillar) => {
    const matchesSearch =
      pillar.pillarId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pillar.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || pillar.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // NEW useEffect to check for maintenance record
  useEffect(() => {
    if (selectedPillar) {
      const itemExists = maintenanceItems.some(
        (m) => m.pillarId === selectedPillar.pillarId,
      );
      setHasMaintenanceRecord(itemExists);
    } else {
      setHasMaintenanceRecord(false);
    }
  }, [selectedPillar, maintenanceItems]); // Re-run when selectedPillar or maintenanceItems change

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map (Kuala Lumpur center)
    const map = L.map(mapContainerRef.current).setView([3.139, 101.6869], 12);

    // Add tile layer
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

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for filtered pillars
    filteredPillars.forEach((pillar) => {
      const color =
        pillar.status === "repaired"
          ? "#22c55e" // green
          : pillar.status === "in-progress"
            ? "#eab308" // yellow
            : "#ef4444"; // red

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker(
        [pillar.coordinates.lat, pillar.coordinates.lng],
        { icon },
      )
        .addTo(mapRef.current)
        .on("click", () => {
          setSelectedPillar(pillar);
          // if (onPillarSelect) {
          //   onPillarSelect(pillar.pillarId);
          // }
        });

      // Add popup
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

    // Fit bounds to show all markers
    if (filteredPillars.length > 0) {
      const bounds = L.latLngBounds(
        filteredPillars.map((p) => [p.coordinates.lat, p.coordinates.lng]),
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [filteredPillars, onPillarSelect]); //nanti nak cuba remove

  const getStatusColor = (status) => {
    switch (status) {
      case "repaired":
        return "bg-green-100 text-green-800 border-green-300";
      case "in-progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "not-examined":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "repaired":
        return "Repaired";
      case "in-progress":
        return "In Progress";
      case "not-examined":
        return "Not Examined";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Asset Map</h2>
        <p className="text-muted-foreground">
          Track and manage all feeder pillars on an interactive map
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 text-gray-600">Total Pillars</CardTitle>
            <MapPin className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pillars.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Repaired</CardTitle>
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pillars.filter((p) => p.status === "repaired").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
            <div className="h-4 w-4 rounded-full bg-yellow-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pillars.filter((p) => p.status === "in-progress").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Not Examined</CardTitle>
            <div className="h-4 w-4 rounded-full bg-red-500"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pillars.filter((p) => p.status === "not-examined").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <CardTitle>Interactive Map</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Click on markers to view pillar details
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
              >
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
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div
                ref={mapContainerRef}
                className="w-full h-[500px] rounded-lg border bg-muted"
              />
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Legend</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-green-500"></div>
                    <span className="text-sm">Repaired</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-yellow-500"></div>
                    <span className="text-sm">In Progress / Repairing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-red-500"></div>
                    <span className="text-sm">Not Examined</span>
                  </div>
                </div>
              </div>

              {selectedPillar && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pillar Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Pillar ID</p>
                      <p className="font-medium">{selectedPillar.pillarId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{selectedPillar.location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge
                        className={getStatusColor(selectedPillar.status)}
                        variant="outline"
                      >
                        {getStatusLabel(selectedPillar.status)}
                      </Badge>
                    </div>
                    {selectedPillar.severity && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Severity
                        </p>
                        <Badge variant="outline">
                          {selectedPillar.severity}
                        </Badge>
                      </div>
                    )}
                    {selectedPillar.lastInspection && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Last Inspection
                        </p>
                        <p className="font-medium text-sm">
                          {new Date(
                            selectedPillar.lastInspection,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Button to navigate to maintenance details */}
                    {onPillarSelect && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => onPillarSelect(selectedPillar.pillarId)}
                        disabled={!hasMaintenanceRecord} // new state
                        title={
                          !hasMaintenanceRecord
                            ? "No maintenance record found for this pillar."
                            : "View full maintenance details"
                        } // tooltip better UX
                      >
                        {hasMaintenanceRecord
                          ? "View Maintenance Details"
                          : "No Maintenance Details"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
