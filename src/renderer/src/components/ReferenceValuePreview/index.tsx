import React from 'react';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import type { IColumn } from '@renderer/components/Table/dtos';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { Dialect } from '@renderer/database/dialects';
import SpatialMap from './components/SpatialMap';
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

  return (
    <div className={styles.container}>
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
          <SpatialMap geoJson={spatialPreview.geoJson} />
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
