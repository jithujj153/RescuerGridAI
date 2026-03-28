"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { IncidentAnalysis, GeoCoordinate } from "@/lib/types/incident";
import { HAZARD_META } from "@/lib/types/incident";

interface MapViewProps {
  incident: IncidentAnalysis | null;
  userLocation: GeoCoordinate | null;
}

/** Load Google Maps JS API via script tag (idempotent) */
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,geometry&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

export function MapView({ incident, userLocation }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) {
      setMapError("Google Maps API key not configured");
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!mapRef.current) return;

        const center = userLocation || { lat: 20.5937, lng: 78.9629 };

        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: userLocation ? 12 : 5,
          mapId: "rescuegrid_dark_map",
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0c1021" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0c1021" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#1e293b" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#94a3b8" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#131832" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#3b82f6" }],
            },
            {
              featureType: "poi",
              elementType: "geometry",
              stylers: [{ color: "#131832" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#0f2a1a" }],
            },
          ],
        });

        // User location marker
        if (userLocation) {
          addUserMarker(userLocation);
        }

        setMapReady(true);
      })
      .catch((err: unknown) => {
        console.error("Maps load error:", err);
        setMapError("Failed to load Google Maps");
      });

    return () => {
      clearOverlays();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];
  }, []);

  const addUserMarker = useCallback((location: GeoCoordinate) => {
    if (!mapInstanceRef.current) return;
    const userPin = document.createElement("div");
    userPin.innerHTML = "📍";
    userPin.style.fontSize = "24px";
    userPin.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";

    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: mapInstanceRef.current,
      position: location,
      title: "Your Location",
      content: userPin,
    });
    markersRef.current.push(marker);
  }, []);

  // Update user location
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.panTo(userLocation);
    mapInstanceRef.current.setZoom(12);
  }, [userLocation, mapReady]);

  // Update map when incident changes
  useEffect(() => {
    if (!incident || !mapInstanceRef.current || !mapReady) return;

    const map = mapInstanceRef.current;
    const { affected_zone, hazard_type } = incident;
    const meta = HAZARD_META[hazard_type];

    // Clear previous overlays
    clearOverlays();

    // Center on incident
    map.panTo(affected_zone.center);
    map.setZoom(13);

    // Incident zone circle
    const circle = new google.maps.Circle({
      map,
      center: affected_zone.center,
      radius: affected_zone.radius_km * 1000,
      fillColor: meta.mapColor,
      fillOpacity: 0.15,
      strokeColor: meta.mapColor,
      strokeOpacity: 0.6,
      strokeWeight: 2,
    });
    circlesRef.current.push(circle);

    // Incident center marker
    const incidentPin = document.createElement("div");
    incidentPin.innerHTML = `<div style="
      display:flex;align-items:center;justify-content:center;
      width:40px;height:40px;border-radius:50%;
      background:${meta.mapColor};color:white;font-size:20px;
      box-shadow:0 0 20px ${meta.mapColor}80;
      animation: pulse-dot 2s ease-in-out infinite;
    ">${meta.icon}</div>`;

    const centerMarker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: affected_zone.center,
      title: `${meta.label} — ${incident.severity.toUpperCase()}`,
      content: incidentPin,
    });
    markersRef.current.push(centerMarker);

    // Re-add user location marker
    if (userLocation) {
      addUserMarker(userLocation);
    }
  }, [incident, userLocation, mapReady, clearOverlays, addUserMarker]);

  if (mapError) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <div className="empty-state__icon">🗺️</div>
        <div className="empty-state__title">Map Unavailable</div>
        <div className="empty-state__subtitle">{mapError}</div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={mapRef}
        className="map-container__map"
        role="application"
        aria-label="Crisis map showing incident zone, evacuation routes, and nearby resources"
      />
      {incident && (
        <div className="map-container__overlay">
          <div className="map-container__legend">
            <div className="map-container__legend-item">
              <div
                className="map-container__legend-dot"
                style={{ background: HAZARD_META[incident.hazard_type].mapColor }}
              />
              <span>Incident Zone</span>
            </div>
            <div className="map-container__legend-item">
              <div className="map-container__legend-dot" style={{ background: "#3b82f6" }} />
              <span>Hospitals</span>
            </div>
            <div className="map-container__legend-item">
              <div className="map-container__legend-dot" style={{ background: "#f97316" }} />
              <span>Shelters</span>
            </div>
            <div className="map-container__legend-item">
              <div className="map-container__legend-dot" style={{ background: "#22c55e" }} />
              <span>Safe Routes</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
