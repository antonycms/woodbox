import React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

interface ISpatialMapProps {
  geoJson: GeoJSON.GeoJsonObject;
}

const SpatialMap = ({ geoJson }: ISpatialMapProps) => {
  const {
    activeTheme: {
      tableInfo: { data: theme },
    },
  } = useThemeContext();
  const mapElementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!mapElementRef.current) return;

    const map = L.map(mapElementRef.current, {
      attributionControl: true,
      maxZoom: 30,
      preferCanvas: true,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 30,
    }).addTo(map);

    const layer = L.geoJSON(geoJson, {
      pointToLayer: (_, latLng) =>
        L.marker(latLng, {
          icon: L.divIcon({
            className: styles.pointMarker,
            html: '<span></span>',
            iconAnchor: [12, 12],
            iconSize: [24, 24],
          }),
        }),
      style: {
        color: theme.bar.color,
        fillColor: theme.bar.color,
        fillOpacity: 0.24,
        weight: 2,
      },
    }).addTo(map);

    window.setTimeout(() => {
      map.invalidateSize();
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        map.fitBounds(bounds, { maxZoom: 16, padding: [18, 18] });
      } else {
        map.setView([0, 0], 2);
      }
    }, 0);

    return () => {
      map.remove();
    };
  }, [geoJson, theme.bar.color]);

  return (
    <div
      ref={mapElementRef}
      className={styles.map}
      style={
        {
          '--reference-map-background': theme.bar.backgroundColor,
          '--reference-map-border-color': theme.bar.borderColor,
          '--reference-map-color': theme.bar.color,
        } as React.CSSProperties
      }
    />
  );
};

export default SpatialMap;
