import React from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  MarkerType,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;
const V_SPACING = 150;
const X_LEFT = 50;
const X_CENTER = 420;
const X_RIGHT = 800;

type TableNodeData = {
  label: string;
  isCurrent: boolean;
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  secondaryAccentColor: string;
  color: string;
};

const TableNode = ({ data }: NodeProps<Node<TableNodeData>>) => {
  const { label, isCurrent, accentColor, secondaryAccentColor, color } = data;
  const nodeAccent = isCurrent ? accentColor : secondaryAccentColor;
  return (
    <div
      style={{
        background: `${nodeAccent}1f`,
        border: `2px solid ${nodeAccent}`,
        borderRadius: 6,
        padding: '8px 14px',
        minWidth: NODE_WIDTH,
        color,
        boxSizing: 'border-box',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: nodeAccent, border: 'none' }}
      />
      <div style={{ fontWeight: isCurrent ? 700 : 500, fontSize: 13, wordBreak: 'break-all' }}>
        {label}
      </div>
      {isCurrent && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>tabela atual</div>}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: nodeAccent, border: 'none' }}
      />
    </div>
  );
};

const nodeTypes = { tableNode: TableNode };

const FlowController = ({ nodeCount }: { nodeCount: number }) => {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    if (nodeCount > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.15 }), 50);
      return () => clearTimeout(timer);
    }
  }, [nodeCount]);
  return null;
};

const Diagram = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { tab: tableInfoTab, properties: theme },
    },
  } = useThemeContext();

  const {
    references,
    usedAsReference,
    loadTableReferences,
    loadTableUsedAsReference,
    lastFetchDate,
    loading,
  } = useTableInfoContext();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const isLoading = loading.references || loading.usedAsReference;

  const lastFetch = new Date(
    Math.max(lastFetchDate.references.getTime(), lastFetchDate.usedAsReference.getTime()),
  );
  const lastFetchDateSerialized = toDateTime(lastFetch);

  const loadData = React.useCallback(() => {
    loadTableReferences(id_connection, { schema, table });
    loadTableUsedAsReference(id_connection, { schema, table });
  }, [id_connection, schema, table]);

  React.useEffect(() => {
    loadData();
  }, []);

  React.useEffect(() => {
    const currentLabel = schema ? `${schema}.${table}` : table;

    const themeColors: Pick<
      TableNodeData,
      'backgroundColor' | 'borderColor' | 'accentColor' | 'secondaryAccentColor' | 'color'
    > = {
      backgroundColor: theme.tab.backgroundColor,
      borderColor: theme.tab.borderColor,
      accentColor: theme.tab.ascentColor,
      secondaryAccentColor: tableInfoTab.ascentColor,
      color: theme.tab.color,
    };

    // Group outgoing FKs (current → other) by constraint name
    const outgoingMap = references.reduce((acc, ref) => {
      const key = ref.constraint_name;
      const target = ref.reference_table_schema
        ? `${ref.reference_table_schema}.${ref.reference_table_name}`
        : ref.reference_table_name;
      if (!acc[key]) acc[key] = { constraint_name: key, target, columns: [] };
      acc[key].columns.push(`${ref.column_name} → ${ref.reference_column_name}`);
      return acc;
    }, {} as Record<string, { constraint_name: string; target: string; columns: string[] }>);

    // Group incoming FKs (other → current) by constraint name
    const incomingMap = usedAsReference.reduce((acc, ref) => {
      const key = ref.constraint_name;
      const source = ref.table_schema ? `${ref.table_schema}.${ref.table_name}` : ref.table_name;
      if (!acc[key]) acc[key] = { constraint_name: key, source, columns: [] };
      acc[key].columns.push(`${ref.column_name} → ${ref.reference_column_name}`);
      return acc;
    }, {} as Record<string, { constraint_name: string; source: string; columns: string[] }>);

    const outgoing = Object.values(outgoingMap);
    const incoming = Object.values(incomingMap);

    const uniqueTargets = [...new Set(outgoing.map((f) => f.target))];
    const uniqueSources = [...new Set(incoming.map((f) => f.source))];

    const numRight = uniqueTargets.length;
    const numLeft = uniqueSources.length;
    const numMax = Math.max(numLeft, numRight, 1);

    // Vertically center each column around the same centerY
    const centerY = ((numMax - 1) * V_SPACING) / 2;
    const leftStart = centerY - ((numLeft - 1) * V_SPACING) / 2;
    const rightStart = centerY - ((numRight - 1) * V_SPACING) / 2;

    const newNodes: Node<TableNodeData>[] = [
      {
        id: 'current',
        type: 'tableNode',
        position: { x: X_CENTER, y: centerY - NODE_HEIGHT / 2 },
        data: { label: currentLabel, isCurrent: true, ...themeColors },
      },
      ...uniqueTargets.map((target, i) => ({
        id: `out_${target}`,
        type: 'tableNode' as const,
        position: { x: X_RIGHT, y: rightStart + i * V_SPACING - NODE_HEIGHT / 2 },
        data: { label: target, isCurrent: false, ...themeColors },
      })),
      ...uniqueSources.map((source, i) => ({
        id: `in_${source}`,
        type: 'tableNode' as const,
        position: { x: X_LEFT, y: leftStart + i * V_SPACING - NODE_HEIGHT / 2 },
        data: { label: source, isCurrent: false, ...themeColors },
      })),
    ];

    const edgeBase = {
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: theme.tab.ascentColor },
      style: { stroke: theme.tab.ascentColor },
      labelStyle: { fill: theme.tab.color, fontSize: 11 },
      labelBgStyle: { fill: theme.tab.backgroundColor, fillOpacity: 0.85 },
      labelBgPadding: [4, 4] as [number, number],
    };

    const newEdges: Edge[] = [
      ...outgoing.map((fk) => ({
        ...edgeBase,
        id: `edge_out_${fk.constraint_name}`,
        source: 'current',
        target: `out_${fk.target}`,
        label: fk.columns.join('\n'),
      })),
      ...incoming.map((fk) => ({
        ...edgeBase,
        id: `edge_in_${fk.constraint_name}`,
        source: `in_${fk.source}`,
        target: 'current',
        label: fk.columns.join('\n'),
      })),
    ];

    setNodes(newNodes);
    setEdges(newEdges);
  }, [references, usedAsReference]);

  const hasNoRelations = !isLoading && references.length === 0 && usedAsReference.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={
          {
            flex: 1,
            minHeight: 400,
            position: 'relative',
            '--xy-controls-button-background-color': theme.tab.backgroundColor,
            '--xy-controls-button-background-color-hover': theme.tab.borderColor,
            '--xy-controls-button-color': theme.tab.color,
            '--xy-controls-button-border-color': theme.tab.borderColor,
          } as React.CSSProperties
        }
      >
        {(isLoading || hasNoRelations) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              color: theme.tab.color,
              fontSize: 13,
              opacity: isLoading ? 1 : 0.5,
              background: theme.tab.backgroundColor,
              pointerEvents: 'none',
            }}
          >
            {isLoading ? 'Carregando...' : 'Nenhuma ligação encontrada'}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          style={{ background: theme.tab.backgroundColor }}
        >
          <FlowController nodeCount={nodes.length} />
          <Background
            color={theme.tab.borderColor}
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
          />
          <Controls />
        </ReactFlow>
      </div>

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button title="Atualizar dados" text smallIcon color={theme.bar.color} onClick={loadData}>
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>
    </div>
  );
};

export default Diagram;
