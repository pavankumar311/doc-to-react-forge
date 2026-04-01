/** GSCIP Thematic Map v1.5 */
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, TileLayer, Tooltip, useMap } from "react-leaflet";

const CITY_CENTER = [41.84, -87.63];
const DETAIL_ZOOM_THRESHOLD = 13;

const RISK_TIER_COLORS = {
  HIGH: "#ef4444",
  MED: "#f97316",
  LOW: "#2563eb",
};

const getColorForValue = (value, bins, colors) => {
  if (!Number.isFinite(value)) return "rgba(30,41,59,0.55)";
  for (let i = 0; i < bins.length; i += 1) {
    if (value <= bins[i].max) {
      return colors[i] || colors[colors.length - 1];
    }
  }
  return colors[colors.length - 1];
};

function MapController({ selectedDistrict, onZoomChange, districts = [] }) {
  const map = useMap();

  useEffect(() => {
    if (!onZoomChange) return undefined;
    const handleZoom = () => onZoomChange(map.getZoom());
    handleZoom();
    map.on("zoomend", handleZoom);
    return () => map.off("zoomend", handleZoom);
  }, [map, onZoomChange]);

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    districts.forEach((district) => {
      if (!district.boundary) return;
      const shapeBounds = L.geoJSON(district.boundary).getBounds();
      if (shapeBounds.isValid()) {
        bounds.extend(shapeBounds);
      }
    });
    if (bounds.isValid()) {
      map.setMaxBounds(bounds.pad(0.1));
      if (!selectedDistrict) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12, animate: true, duration: 1.2 });
      }
    }
  }, [map, districts, selectedDistrict]);

  useEffect(() => {
    if (!selectedDistrict) {
      map.setView(CITY_CENTER, 11);
      return;
    }

    if (selectedDistrict.boundary) {
      const bounds = L.geoJSON(selectedDistrict.boundary).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13, animate: true, duration: 1.2 });
        return;
      }
    }

    if (selectedDistrict.centroid_lat && selectedDistrict.centroid_lon) {
      map.flyTo([selectedDistrict.centroid_lat, selectedDistrict.centroid_lon], 13, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [map, selectedDistrict]);

  return null;
}

export default function ThematicMap({
  districts = [],
  riskData = [],
  bins = [],
  colors = [],
  selectedDistrictId,
  onSelectDistrict,
  onZoomChange,
  mapZoom = 11,
  blocks = [],
  showBlocks = true,
  incidents = [],
  showIncidents = true,
  onSelectIncident,
  activeIncidentId,
  showChoropleth = true,
  stations = [],
  showStations = true,
  beats = [],
  showBeats = true,
  beatRiskData = [],
  beatBins = [],
  onSelectBeat,
  selectedBeatId,
  precincts = [],
  showPrecincts = false,
}) {
  const riskMap = useMemo(() => {
    const map = new Map();
    riskData.forEach((item) => {
      map.set(item.district_id, item);
    });
    return map;
  }, [riskData]);

  const beatRiskMap = useMemo(() => {
    const m = new Map();
    beatRiskData.forEach((item) => m.set(item.beat_num, item));
    return m;
  }, [beatRiskData]);

  const CATEGORY_COLORS = {
    violent: "#ef4444",
    property: "#f97316",
    quality: "#eab308",
    other: "#6b7280",
  };

  const blockMarkers = useMemo(() => (
    blocks
      .filter((block) => Number.isFinite(Number(block.latitude)) && Number.isFinite(Number(block.longitude)))
      .map((block) => {
        const riskScore = Number(block.risk_score);
        const intensity = Number.isFinite(riskScore)
          ? Math.min(Math.max(riskScore, 0), 1)
          : Math.min(block.crime_count / 60, 1);
        const radius = 6 + intensity * 14;
        const tierColor = block.risk_tier && RISK_TIER_COLORS[block.risk_tier]
          ? RISK_TIER_COLORS[block.risk_tier]
          : null;
        const color = tierColor || (intensity > 0.7 ? "#ef4444" : intensity > 0.4 ? "#f97316" : "#2563eb");
        return {
          ...block,
          radius,
          color,
          intensity,
        };
      })
  ), [blocks]);

  return (
    <MapContainer center={CITY_CENTER} zoom={11} scrollWheelZoom className="h-full w-full" style={{ background: "#0a0e17" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="(c) OpenStreetMap contributors"
      />

      <MapController
        selectedDistrict={districts.find((d) => d.district_id === selectedDistrictId) || null}
        onZoomChange={onZoomChange}
        districts={districts}
      />

      <Pane name="districts-pane" style={{ zIndex: 400 }}>
        {districts.filter((district) => district.boundary).map((district) => {
          const risk = riskMap.get(district.district_id);
          const value = risk ? Number(risk.crimes_per_1000) : null;
          const fillColor = getColorForValue(value, bins, colors);
          const isSelected = district.district_id === selectedDistrictId;
          const baseStyle = {
            color: showChoropleth ? fillColor : "rgba(255,255,255,0.05)",
            weight: showChoropleth ? 0.2 : 0.5,
            opacity: showChoropleth ? 0.9 : 0.3,
            fillColor: showChoropleth ? fillColor : "transparent",
            fillOpacity: showChoropleth ? 0.92 : 0,
            lineJoin: "round",
          };
          const hoverStyle = {
            ...baseStyle,
            color: "#f8fafc",
            weight: 1,
            fillOpacity: 0.98,
          };
          const selectedStyle = isSelected
            ? { ...baseStyle, color: "#f8fafc", weight: 1.5, fillOpacity: 0.98 }
            : baseStyle;
          return (
            <GeoJSON
              key={district.district_id}
              data={district.boundary}
              style={selectedStyle}
              eventHandlers={{
                mouseover: (event) => event.target.setStyle(hoverStyle),
                mouseout: (event) => event.target.setStyle(selectedStyle),
                click: () => onSelectDistrict?.(district),
              }}
            >
              <Tooltip direction="top" opacity={1} sticky>
                <div className="text-xs font-semibold">{district.district_name}</div>
                {risk && (
                  <>
                    <div className="text-[10px]">Total incidents: {risk.crime_count}</div>
                    <div className="text-[10px]">Crimes per 1k: {Number(risk.crimes_per_1000).toFixed(2)}</div>
                    <div className="text-[10px]">Safety index: {Number(risk.safety_index).toFixed(2)}</div>
                    <div className="text-[10px]">Relative to avg: {Number(risk.relative_to_average).toFixed(2)}x</div>
                  </>
                )}
              </Tooltip>
            </GeoJSON>
          );
        })}
      </Pane>

      <Pane name="precincts-pane" style={{ zIndex: 450 }}>
        {showPrecincts && precincts.map((p) => {
          if (!p.boundary) return null;
          return (
            <GeoJSON
              key={p.ward_precinct}
              data={p.boundary}
              style={{
                color: "#60a5fa",
                weight: 1.5,
                dashArray: "4, 6",
                fillColor: "rgba(96, 165, 250, 0.05)",
                fillOpacity: 0.15
              }}
            >
              <Tooltip direction="top" opacity={0.97} sticky>
                <div style={{ background: "#0f172a", border: "1px solid #1e40af", padding: "8px 12px", borderRadius: "10px", minWidth: "150px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 900, textTransform: "uppercase", color: "#60a5fa", letterSpacing: "0.12em", marginBottom: "4px" }}>Political Boundary</div>
                  <div style={{ fontSize: "13px", fontWeight: 900, color: "#f8fafc" }}>Ward {p.ward}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>Precinct {p.precinct}</div>
                  {p.shape_area && <div style={{ fontSize: "9px", color: "#475569", marginTop: "4px" }}>Area: {Number(p.shape_area / 1e6).toFixed(2)} km²</div>}
                </div>
              </Tooltip>
            </GeoJSON>
          );
        })}
      </Pane>

      <Pane name="beats-pane" style={{ zIndex: 500 }}>
        {beats.map((b) => {
          if (!b.boundary) return null;
          const districtKey = String(b.district || "").padStart(3, "0");
          const isHighlight = selectedDistrictId && b.district === selectedDistrictId.replace(/^0+/, "");
          const districtRisk = riskMap.get(districtKey);
          const localRisk = beatRiskMap.get(b.beat_num);
          return (
            <GeoJSON
              key={b.beat_num}
              data={b.boundary}
              style={{
                color: isHighlight ? "#3b82f6" : "rgba(30, 64, 175, 0.5)",
                weight: isHighlight ? 2.5 : 1,
                fillColor: isHighlight ? "rgba(59,130,246,0.05)" : "transparent",
                fillOpacity: isHighlight ? 1 : 0,
              }}
            >
              <Tooltip direction="top" opacity={0.97} sticky>
                <div style={{ background: "#0f172a", border: "1px solid #1e3a8a", padding: "10px 12px", borderRadius: "10px", minWidth: "170px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 900, textTransform: "uppercase", color: "#3b82f6", letterSpacing: "0.12em", marginBottom: "6px" }}>CPD Operational Beat</div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#f8fafc", marginBottom: "2px" }}>Beat {b.beat_num}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "8px" }}>Sector {b.sector} · District {b.district}</div>
                  
                  {localRisk ? (
                    <div style={{ borderTop: "1px solid #1e293b", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: "#64748b" }}>Local Crimes</span>
                        <span style={{ color: "#fbbf24", fontWeight: 800 }}>{localRisk.crime_count}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: "#64748b" }}>Local Arrest Rate</span>
                        <span style={{ color: "#34d399", fontWeight: 800 }}>{localRisk.arrest_rate}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: "#64748b" }}>Domestic Rate</span>
                        <span style={{ color: "#60a5fa", fontWeight: 800 }}>{localRisk.domestic_rate}%</span>
                      </div>
                    </div>
                  ) : districtRisk ? (
                    <div style={{ borderTop: "1px solid #1e293b", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: "#64748b" }}>District Avg/1k</span>
                        <span style={{ color: "#94a3b8" }}>{Number(districtRisk.crimes_per_1000 || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "9px", color: "#475569", fontStyle: "italic" }}>Awaiting sync...</div>
                  )}
                </div>
              </Tooltip>
            </GeoJSON>
          );
        })}
      </Pane>

      <Pane name="stations-pane" style={{ zIndex: 650 }}>
        {showStations && stations?.map((s) => {
          const lat = parseFloat(s.latitude);
          const lon = parseFloat(s.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          return (
            <Marker
              key={s.district_id || `${lat}-${lon}-${Math.random()}`}
              position={[lat, lon]}
              pane="stations-pane"
              icon={L.divIcon({
                html: `
                  <div style="
                    background: #1e40af;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 2.5px solid #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                  " 
                  onmouseover="this.style.transform='scale(1.25)'; this.style.backgroundColor='#3b82f6'; this.style.borderColor='#ffffff';"
                  onmouseout="this.style.transform='scale(1)'; this.style.backgroundColor='#1e40af'; this.style.borderColor='#f8fafc';"
                  >🏛️</div>
                `,
                className: "police-station-marker",
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
              eventHandlers={{
                click: () => onSelectDistrict({ district_id: s.district_id }),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <div style={{ backgroundColor: "#0f172a", border: "1px solid #1e40af", padding: "12px", borderRadius: "12px", minWidth: "190px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)" }}>
                  <div style={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", color: "#3b82f6", marginBottom: "6px", letterSpacing: "0.15em" }}>
                    Public Safety Hub
                  </div>
                  <div style={{ fontSize: "15px", fontStyle: "italic", fontWeight: "800", color: "#f8fafc", marginBottom: "4px" }}>
                    {s.district_name || "Headquarters"} Station
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "10px", lineHeight: "1.4" }}>
                    {s.address}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid #1e293b", paddingTop: "10px" }}>
                    {s.phone && (
                      <a 
                        href={`tel:${s.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: "12px", color: "#60a5fa", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
                      >
                        <span style={{ filter: "grayscale(1) brightness(1.5)" }}>📞</span> {s.phone}
                      </a>
                    )}
                    <div style={{ fontSize: "10px", color: "#475569", fontWeight: "600", textTransform: "uppercase" }}>
                      District ID: <span style={{ color: "#94a3b8" }}>{s.district_id}</span>
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </Pane>

      <Pane name="blocks-pane" style={{ zIndex: 600 }}>
        {showBlocks && mapZoom >= DETAIL_ZOOM_THRESHOLD && blockMarkers.map((block) => (
          <CircleMarker
            key={block.block_id}
            center={[Number(block.latitude), Number(block.longitude)]}
            radius={block.radius}
            pathOptions={{
              color: block.color,
              fillColor: block.color,
              fillOpacity: 0.55,
              weight: 1,
            }}
          >
            <Tooltip direction="top" opacity={1}>
              <div className="text-xs font-semibold">{block.block_address}</div>
              <div className="text-[10px]">Crimes: {block.crime_count}</div>
              {Number.isFinite(Number(block.risk_score)) && (
                <div className="text-[10px]">Risk score: {Number(block.risk_score).toFixed(2)}</div>
              )}
            </Tooltip>
          </CircleMarker>
        ))}
      </Pane>

      <Pane name="incidents-pane" style={{ zIndex: 600 }}>
        {showIncidents && mapZoom >= DETAIL_ZOOM_THRESHOLD && incidents.map((inc) => {
          const isSelected = inc.incident_id === activeIncidentId;
          const color = CATEGORY_COLORS[inc.category?.toLowerCase()] || CATEGORY_COLORS.other;
          return (
            <CircleMarker
              key={inc.incident_id}
              center={[inc.latitude, inc.longitude]}
              radius={isSelected ? 12 : 7}
              pathOptions={{
                color: isSelected ? "#fff" : color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: isSelected ? 3 : 1,
              }}
              eventHandlers={{
                click: () => onSelectIncident?.(inc),
              }}
            >
              <Tooltip direction="top" opacity={1} sticky>
                <div className="text-xs font-bold">{inc.primary_type}</div>
                <div className="text-[10px] text-muted-foreground">{inc.date}</div>
                <div className="text-[10px] leading-tight mt-1">{inc.description}</div>
                <div className="text-[10px] font-mono mt-1 opacity-60">{inc.block_address}</div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </Pane>
    </MapContainer>
  );
}
