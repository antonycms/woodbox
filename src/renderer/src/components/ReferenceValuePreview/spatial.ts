import type { IColumn } from '@renderer/components/Table/dtos';

type ByteOrder = 'little' | 'big';
type ParsedWkbGeometry = GeoJSON.Geometry | null;

interface IWkbReader {
  data: DataView;
  offset: number;
}

export interface ISpatialPreviewData {
  geoJson: GeoJSON.GeoJsonObject;
  key: string;
}

const SPATIAL_TYPE_NAMES = new Set([
  'geometry',
  'geography',
  'point',
  'linestring',
  'polygon',
  'multipoint',
  'multilinestring',
  'multipolygon',
  'geometrycollection',
]);

const SPATIAL_COLUMN_PATTERN = /(^|[_\s-])(geom|geometry|geography|shape|location|coordinates?|polygon)([_\s-]|$)/;

export const serializePreviewValue = (value: unknown) => {
  if (value === undefined || value === null) return '';

  if (typeof value === 'bigint') return String(value);

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
};

const isLikelySpatialColumn = (column?: IColumn) => {
  const type = String(column?.info || '').toLowerCase();
  const attribute = String(column?.attribute || '').toLowerCase();

  return SPATIAL_TYPE_NAMES.has(type) || SPATIAL_COLUMN_PATTERN.test(attribute);
};

const isGeoJsonGeometry = (value: unknown): value is GeoJSON.Geometry => {
  if (!value || typeof value !== 'object') return false;

  const geometry = value as { type?: unknown; coordinates?: unknown; geometries?: unknown };

  if (geometry.type === 'GeometryCollection') return Array.isArray(geometry.geometries);

  return typeof geometry.type === 'string' && 'coordinates' in geometry;
};

const isGeoJsonObject = (value: unknown): value is GeoJSON.GeoJsonObject => {
  if (!value || typeof value !== 'object') return false;

  const item = value as { type?: unknown; geometry?: unknown; features?: unknown };

  if (isGeoJsonGeometry(item)) return true;
  if (item.type === 'Feature') return isGeoJsonGeometry(item.geometry);
  if (item.type === 'FeatureCollection') return Array.isArray(item.features);

  return false;
};

const splitTopLevel = (value: string) => {
  const items: string[] = [];
  let start = 0;
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;

    if (char === ',' && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  items.push(value.slice(start).trim());

  return items.filter(Boolean);
};

const stripOuterParens = (value: string) => {
  const text = value.trim();

  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1).trim() : text;
};

const parseWktPosition = (value: string): GeoJSON.Position | null => {
  const numbers = value
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((item) => !Number.isNaN(item));

  return numbers.length >= 2 ? [numbers[0], numbers[1]] : null;
};

const parseWktPositionList = (value: string) => {
  const positions = splitTopLevel(value).map(parseWktPosition);

  return positions.every(Boolean) ? (positions as GeoJSON.Position[]) : null;
};

const parseWktPolygon = (value: string) => {
  const rings = splitTopLevel(stripOuterParens(value)).map((ring) =>
    parseWktPositionList(stripOuterParens(ring)),
  );

  return rings.every(Boolean) ? (rings as GeoJSON.Position[][]) : null;
};

const parseWktGeometry = (value: string): GeoJSON.Geometry | null => {
  const normalized = value.trim().replace(/^SRID=\d+;\s*/i, '');
  const match = normalized.match(/^([a-z]+)(?:\s+(?:z|m|zm))?\s*(empty|\(.*\))$/i);

  if (!match || match[2].toUpperCase() === 'EMPTY') return null;

  const type = match[1].toUpperCase();
  const body = stripOuterParens(match[2]);

  if (type === 'POINT') {
    const coordinates = parseWktPosition(body);
    return coordinates ? { type: 'Point', coordinates } : null;
  }

  if (type === 'LINESTRING') {
    const coordinates = parseWktPositionList(body);
    return coordinates ? { type: 'LineString', coordinates } : null;
  }

  if (type === 'POLYGON') {
    const coordinates = parseWktPolygon(match[2]);
    return coordinates ? { type: 'Polygon', coordinates } : null;
  }

  if (type === 'MULTIPOINT') {
    const items = splitTopLevel(body).map((item) => parseWktPosition(stripOuterParens(item)));
    return items.every(Boolean)
      ? { type: 'MultiPoint', coordinates: items as GeoJSON.Position[] }
      : null;
  }

  if (type === 'MULTILINESTRING') {
    const items = splitTopLevel(body).map((item) => parseWktPositionList(stripOuterParens(item)));
    return items.every(Boolean)
      ? { type: 'MultiLineString', coordinates: items as GeoJSON.Position[][] }
      : null;
  }

  if (type === 'MULTIPOLYGON') {
    const items = splitTopLevel(body).map(parseWktPolygon);
    return items.every(Boolean)
      ? { type: 'MultiPolygon', coordinates: items as GeoJSON.Position[][][] }
      : null;
  }

  if (type === 'GEOMETRYCOLLECTION') {
    const geometries = splitTopLevel(body)
      .map(parseWktGeometry)
      .filter(Boolean) as GeoJSON.Geometry[];

    return geometries.length ? { type: 'GeometryCollection', geometries } : null;
  }

  return null;
};

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
};

const readUint32 = (reader: IWkbReader, byteOrder: ByteOrder) => {
  const value = reader.data.getUint32(reader.offset, byteOrder === 'little');
  reader.offset += 4;
  return value;
};

const readDouble = (reader: IWkbReader, byteOrder: ByteOrder) => {
  const value = reader.data.getFloat64(reader.offset, byteOrder === 'little');
  reader.offset += 8;
  return value;
};

const readWkbPosition = (reader: IWkbReader, byteOrder: ByteOrder, dimensions: number) => {
  const position: GeoJSON.Position = [readDouble(reader, byteOrder), readDouble(reader, byteOrder)];

  for (let index = 2; index < dimensions; index += 1) readDouble(reader, byteOrder);

  return position;
};

const getWkbDimensions = (rawType: number) => {
  const hasEwkbFlags = !!(rawType & 0xe0000000);
  const isoDimensionFlag = hasEwkbFlags ? 0 : Math.floor(rawType / 1000);
  const hasZ = !!(rawType & 0x80000000) || isoDimensionFlag === 1 || isoDimensionFlag === 3;
  const hasM = !!(rawType & 0x40000000) || isoDimensionFlag === 2 || isoDimensionFlag === 3;

  return 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0);
};

const getWkbBaseType = (rawType: number) => {
  const withoutEwkbFlags = rawType & 0x000000ff;

  if (withoutEwkbFlags >= 1 && withoutEwkbFlags <= 7) return withoutEwkbFlags;

  return rawType % 1000;
};

const parseWkbGeometry = (reader: IWkbReader): ParsedWkbGeometry => {
  if (reader.offset + 5 > reader.data.byteLength) return null;

  const byteOrder: ByteOrder = reader.data.getUint8(reader.offset) === 1 ? 'little' : 'big';
  reader.offset += 1;

  const rawType = readUint32(reader, byteOrder);
  const baseType = getWkbBaseType(rawType);
  const dimensions = getWkbDimensions(rawType);

  if (rawType & 0x20000000) readUint32(reader, byteOrder);

  if (baseType === 1) {
    return { type: 'Point', coordinates: readWkbPosition(reader, byteOrder, dimensions) };
  }

  if (baseType === 2) {
    const count = readUint32(reader, byteOrder);
    const coordinates = Array.from({ length: count }, () =>
      readWkbPosition(reader, byteOrder, dimensions),
    );

    return { type: 'LineString', coordinates };
  }

  if (baseType === 3) {
    const count = readUint32(reader, byteOrder);
    const coordinates = Array.from({ length: count }, () => {
      const ringCount = readUint32(reader, byteOrder);
      return Array.from({ length: ringCount }, () => readWkbPosition(reader, byteOrder, dimensions));
    });

    return { type: 'Polygon', coordinates };
  }

  if (baseType === 4 || baseType === 5 || baseType === 6 || baseType === 7) {
    const count = readUint32(reader, byteOrder);
    const geometries = Array.from({ length: count }, () => parseWkbGeometry(reader)).filter(
      Boolean,
    ) as GeoJSON.Geometry[];

    if (baseType === 7) return { type: 'GeometryCollection', geometries };

    if (baseType === 4) {
      return {
        type: 'MultiPoint',
        coordinates: geometries.flatMap((geometry) =>
          geometry.type === 'Point' ? [geometry.coordinates] : [],
        ),
      };
    }

    if (baseType === 5) {
      return {
        type: 'MultiLineString',
        coordinates: geometries.flatMap((geometry) =>
          geometry.type === 'LineString' ? [geometry.coordinates] : [],
        ),
      };
    }

    return {
      type: 'MultiPolygon',
      coordinates: geometries.flatMap((geometry) =>
        geometry.type === 'Polygon' ? [geometry.coordinates] : [],
      ),
    };
  }

  return null;
};

const parseHexWkb = (value: string) => {
  const hex = value.trim().replace(/^\\x/i, '');

  if (!/^(00|01)[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;

  try {
    return parseWkbGeometry({ data: new DataView(hexToBytes(hex).buffer), offset: 0 });
  } catch {
    return null;
  }
};

const parseSpatialString = (value: string, forceParse: boolean) => {
  const trimmed = value.trim();

  if (!trimmed) return null;

  try {
    const parsedJson = JSON.parse(trimmed) as unknown;
    if (isGeoJsonObject(parsedJson)) return parsedJson;
  } catch {
    // continua tentando WKT/WKB abaixo.
  }

  if (/^(SRID=\d+;\s*)?(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\b/i.test(trimmed)) {
    return parseWktGeometry(trimmed);
  }

  if (forceParse || /^(\\x)?(00|01)[0-9a-f]+$/i.test(trimmed)) return parseHexWkb(trimmed);

  return null;
};

export const getSpatialPreviewData = (
  value: unknown,
  column?: IColumn,
): ISpatialPreviewData | undefined => {
  const forceParse = isLikelySpatialColumn(column);
  let geoJson: GeoJSON.GeoJsonObject | null = null;

  if (isGeoJsonObject(value)) {
    geoJson = value;
  } else if (typeof value === 'string') {
    geoJson = parseSpatialString(value, forceParse);
  } else if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;

    if (Array.isArray(data) && data.every((item) => typeof item === 'number')) {
      geoJson = parseHexWkb(
        data.map((item) => item.toString(16).padStart(2, '0')).join(''),
      );
    }
  }

  if (!geoJson) return undefined;

  return { geoJson, key: JSON.stringify(geoJson) };
};
