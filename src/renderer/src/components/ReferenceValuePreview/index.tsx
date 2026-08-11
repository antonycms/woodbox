import React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import type { IColumn } from '@renderer/components/Table/dtos';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { Dialect } from '@renderer/database/dialects';
import { getSpatialPreviewData, serializePreviewValue } from './spatial';
import styles from './styles.module.css';

import IconMdiCodeJson from '~icons/mdi/code-json';
import IconMdiMap from '~icons/mdi/map';

interface IReferenceValuePreviewProps {
  column?: IColumn;
  dialect: Dialect;
  readonly?: boolean;
  value: unknown;
  onChange?(value: string): void;
}

const ReferenceValuePreview = ({
  column,
  dialect,
  readonly,
  value,
  onChange,
}: IReferenceValuePreviewProps) => {
  const {
    activeTheme: {
      tableInfo: { data: theme },
    },
  } = useThemeContext();
  const { t } = useI18n();
  const mapElementRef = React.useRef<HTMLDivElement>(null);
  const initializedViewMode = React.useRef(false);
  const [viewMode, setViewMode] = React.useState<'editor' | 'map'>('editor');

  const previewValue = React.useMemo(() => serializePreviewValue(value), [value]);
  const spatialPreview = React.useMemo(() => getSpatialPreviewData(value, column), [column, value]);

  React.useEffect(() => {
    if (!initializedViewMode.current) {
      setViewMode(spatialPreview ? 'map' : 'editor');
      initializedViewMode.current = true;
      return;
    }

    if (!spatialPreview) setViewMode('editor');
  }, [spatialPreview]);

  React.useEffect(() => {
    if (viewMode !== 'map' || !spatialPreview || !mapElementRef.current) return;

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

    const layer = L.geoJSON(spatialPreview.geoJson, {
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
  }, [spatialPreview, theme.bar.color, viewMode]);

  return (
    <div
      className={styles.container}
      style={
        {
          '--reference-map-background': theme.bar.backgroundColor,
          '--reference-map-border-color': theme.bar.borderColor,
          '--reference-map-color': theme.bar.color,
        } as React.CSSProperties
      }
    >
      {!!spatialPreview && (
        <div
          className={styles.toolbar}
          style={
            {
              backgroundColor: theme.bar.backgroundColor,
              '--reference-border-color': theme.bar.borderColor,
            } as React.CSSProperties
          }
        >
          <div className={styles.title} style={{ color: theme.bar.color }}>
            {column?.label || t('tabs.value')}
          </div>

          <Button
            text
            smallIcon
            title={viewMode === 'map' ? t('tooltip.viewJson') : t('tooltip.viewMap')}
            color={theme.bar.color}
            onClick={() => setViewMode((prevState) => (prevState === 'map' ? 'editor' : 'map'))}
          >
            {viewMode === 'map' ? <IconMdiCodeJson width={16} /> : <IconMdiMap width={16} />}
          </Button>
        </div>
      )}

      <div className={styles.content}>
        {viewMode === 'map' && spatialPreview ? (
          <div ref={mapElementRef} className={styles.map} />
        ) : (
          <Editor
            dialect={dialect}
            language="json"
            readonly={readonly}
            hidePreview
            value={previewValue}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
};

export default ReferenceValuePreview;
