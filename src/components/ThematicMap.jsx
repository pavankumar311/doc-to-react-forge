import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

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
}) {
  const riskMap = useMemo(() => {
    const map = new Map();
    riskData.forEach((item) => {
      map.set(item.district_id, item);
    });
    return map;
  }, [riskData]);

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

      {districts.filter((district) => district.boundary).map((district) => {
        const risk = riskMap.get(district.district_id);
        const value = risk ? Number(risk.crimes_per_1000) : null;
        const fillColor = getColorForValue(value, bins, colors);
        const isSelected = district.district_id === selectedDistrictId;
        const baseStyle = {
          color: fillColor,
          weight: 0.2,
          opacity: 0.9,
          fillColor,
          fillOpacity: 0.92,
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
            {block.risk_tier && <div className="text-[10px]">Risk tier: {block.risk_tier}</div>}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
