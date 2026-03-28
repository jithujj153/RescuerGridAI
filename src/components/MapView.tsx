"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  IncidentAnalysis,
  GeoCoordinate,
  NearbyResource,
  EvacuationRoute,
} from "@/lib/types/incident";
import { HAZARD_META } from "@/lib/types/incident";

interface MapViewProps {
  incident: IncidentAnalysis | null;
  userLocation: GeoCoordinate | null;
}

const RESOURCE_COLORS = {
  hospital: "#3b82f6",
  shelter: "#f97316",
  fire_station: "#ef4444",
  route: "#22c55e",
} as const;

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

function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function createResourcePin(
  resource: NearbyResource,
  color: string
): HTMLElement {
  const el = document.createElement("div");
  const icon =
    resource.type === "hospital" ? "🏥" :
    resource.type === "fire_station" ? "🚒" : "🏠";
  const statusDot = resource.is_open
    ? '<span style="color:#22c55e;font-size:8px;">●</span>'
    : resource.is_open === false
      ? '<span style="color:#ef4444;font-size:8px;">●</span>'
      : "";
  el.innerHTML = `<div style="
    display:flex;align-items:center;justify-content:center;
    width:32px;height:32px;border-radius:50%;
    background:${color};color:white;font-size:16px;
    box-shadow:0 2px 8px ${color}80;
    border:2px solid rgba(255,255,255,0.8);
    position:relative;cursor:pointer;
  ">${icon}${statusDot ? `<span style="position:absolute;top:-2px;right:-2px;">${statusDot}</span>` : ""}</div>`;
  return el;
}

export function MapView({ incident, userLocation }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    if (infoWindowRef.current) infoWindowRef.current.close();
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

  const addResourceMarkers = useCallback(
    (resources: NearbyResource[], map: google.maps.Map) => {
      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }
      const iw = infoWindowRef.current;

      for (const resource of resources) {
        const color = RESOURCE_COLORS[resource.type];
        const pin = createResourcePin(resource, color);
        const position = {
          lat: resource.location.latitude,
          lng: resource.location.longitude,
        };

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position,
          title: resource.name,
          content: pin,
        });

        marker.addListener("click", () => {
          const lines = [
            `<strong style="font-size:13px;">${resource.name}</strong>`,
            resource.address
              ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${resource.address}</div>`
              : "",
            resource.phone
              ? `<div style="font-size:11px;margin-top:2px;">📞 ${resource.phone}</div>`
              : "",
            resource.rating
              ? `<div style="font-size:11px;margin-top:2px;">⭐ ${resource.rating}</div>`
              : "",
            resource.is_open !== null && resource.is_open !== undefined
              ? `<div style="font-size:11px;margin-top:2px;color:${resource.is_open ? "#22c55e" : "#ef4444"};">${resource.is_open ? "Open Now" : "Closed"}</div>`
              : "",
          ].filter(Boolean);
          iw.setContent(
            `<div style="padding:4px;max-width:200px;">${lines.join("")}</div>`
          );
          iw.open(map, marker);
        });

        markersRef.current.push(marker);
      }
    },
    []
  );

  const addRoutePolylines = useCallback(
    (routes: EvacuationRoute[], map: google.maps.Map) => {
      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        if (!route.polyline) continue;

        try {
          const path = decodePolyline(route.polyline);
          const polyline = new google.maps.Polyline({
            map,
            path,
            strokeColor: RESOURCE_COLORS.route,
            strokeOpacity: i === 0 ? 0.9 : 0.5,
            strokeWeight: i === 0 ? 5 : 3,
            geodesic: true,
          });
          polylinesRef.current.push(polyline);
        } catch {
          // Skip invalid polylines
        }
      }
    },
    []
  );

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasApiKey = !!apiKey;

  useEffect(() => {
    if (!hasApiKey || !mapRef.current) return;

    loadGoogleMapsScript(apiKey!)
      .then(() => {
        if (!mapRef.current) return;

        const center = userLocation || { lat: 20.5937, lng: 78.9629 };

        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: userLocation ? 12 : 5,
          mapId: "rescuegrid_dark_map",
          colorScheme: google.maps.ColorScheme?.DARK,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        if (userLocation) {
          addUserMarker(userLocation);
        }

        setMapReady(true);
      })
      .catch(() => {
        setMapError("Failed to load Google Maps");
      });

    return () => {
      clearOverlays();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLocation) return;
    mapInstanceRef.current.panTo(userLocation);
    mapInstanceRef.current.setZoom(12);
  }, [userLocation, mapReady]);

  useEffect(() => {
    if (!incident || !mapInstanceRef.current || !mapReady) return;

    const map = mapInstanceRef.current;
    const { affected_zone, hazard_type } = incident;
    const meta = HAZARD_META[hazard_type];

    clearOverlays();

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

    // Hospital markers
    if (incident.nearby_hospitals?.length) {
      addResourceMarkers(incident.nearby_hospitals, map);
    }

    // Shelter markers
    if (incident.nearby_shelters?.length) {
      addResourceMarkers(incident.nearby_shelters, map);
    }

    // Fire station markers
    if (incident.nearby_fire_stations?.length) {
      addResourceMarkers(incident.nearby_fire_stations, map);
    }

    // Evacuation route polylines
    if (incident.evacuation_routes?.length) {
      addRoutePolylines(incident.evacuation_routes, map);
    }

    if (userLocation) {
      addUserMarker(userLocation);
    }

    // Fit map bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(affected_zone.center);
    if (userLocation) bounds.extend(userLocation);
    incident.nearby_hospitals?.forEach((h) =>
      bounds.extend({ lat: h.location.latitude, lng: h.location.longitude })
    );
    incident.nearby_shelters?.forEach((s) =>
      bounds.extend({ lat: s.location.latitude, lng: s.location.longitude })
    );
    incident.nearby_fire_stations?.forEach((f) =>
      bounds.extend({ lat: f.location.latitude, lng: f.location.longitude })
    );
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setCenter(affected_zone.center);
      map.setZoom(13);
    } else {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [
    incident,
    userLocation,
    mapReady,
    clearOverlays,
    addUserMarker,
    addResourceMarkers,
    addRoutePolylines,
  ]);

  if (mapError || !hasApiKey) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <div className="empty-state__icon">🗺️</div>
        <div className="empty-state__title">Map Unavailable</div>
        <div className="empty-state__subtitle">
          {mapError || "Google Maps API key not configured"}
        </div>
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
            {(incident.nearby_hospitals?.length ?? 0) > 0 && (
              <div className="map-container__legend-item">
                <div className="map-container__legend-dot" style={{ background: RESOURCE_COLORS.hospital }} />
                <span>Hospitals ({incident.nearby_hospitals!.length})</span>
              </div>
            )}
            {(incident.nearby_shelters?.length ?? 0) > 0 && (
              <div className="map-container__legend-item">
                <div className="map-container__legend-dot" style={{ background: RESOURCE_COLORS.shelter }} />
                <span>Shelters ({incident.nearby_shelters!.length})</span>
              </div>
            )}
            {(incident.nearby_fire_stations?.length ?? 0) > 0 && (
              <div className="map-container__legend-item">
                <div className="map-container__legend-dot" style={{ background: RESOURCE_COLORS.fire_station }} />
                <span>Fire Stations ({incident.nearby_fire_stations!.length})</span>
              </div>
            )}
            {(incident.evacuation_routes?.length ?? 0) > 0 && (
              <div className="map-container__legend-item">
                <div className="map-container__legend-dot" style={{ background: RESOURCE_COLORS.route }} />
                <span>Safe Routes ({incident.evacuation_routes!.length})</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
