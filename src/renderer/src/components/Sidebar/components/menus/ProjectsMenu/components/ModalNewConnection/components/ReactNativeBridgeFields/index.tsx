import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Input } from '@renderer/components/Input';
import { useI18n } from '@renderer/contexts/I18n';
import {
  type IReactNativeBridgeSession,
  type IReactNativeBridgeStatus,
  useStoreContext,
} from '@renderer/contexts/Store';
import type { IDataNewConnection, SetConnectionFormState } from '../../types';

interface IReactNativeBridgeFieldsProps {
  state: IDataNewConnection;
  setState: SetConnectionFormState;
  color?: string;
  backgroundColor?: string;
}

const DEFAULT_BRIDGE_PORT = 8123;
const REFRESH_INTERVAL_MS = 3000;
const BRIDGE_SOURCE = 'modal:new-react-native-sqlite-connection';

export const ReactNativeBridgeFields = React.memo(
  ({ state, setState, color, backgroundColor }: IReactNativeBridgeFieldsProps) => {
    const { t } = useI18n();
    const {
      getReactNativeBridgeStatus,
      startReactNativeBridgeGateway,
      stopReactNativeBridgeGateway,
    } = useStoreContext();

    const value = state.reactNativeBridge;
    const bridgePort = Number(value?.port || DEFAULT_BRIDGE_PORT);
    const appIdRef = React.useRef(value?.appId);
    appIdRef.current = value?.appId;

    const [sessions, setSessions] = React.useState<IReactNativeBridgeSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const selectedSession = React.useMemo(() => {
      return sessions.find((session) => session.id === selectedSessionId);
    }, [selectedSessionId, sessions]);

    const adapters = React.useMemo(() => {
      return (selectedSession?.adapters || []).filter(
        (adapter) => adapter.model === 'relational' && adapter.dialect === 'sqlite',
      );
    }, [selectedSession]);

    const selectAdapter = React.useCallback(
      (session: IReactNativeBridgeSession, adapter: IReactNativeBridgeSession['adapters'][number]) => {
        setState((prevState) => {
          const reactNativeBridge = {
            appId: session.appId,
            appName: session.appName,
            adapterId: adapter.id,
            adapterLabel: adapter.label,
            port: Number(prevState.reactNativeBridge?.port || DEFAULT_BRIDGE_PORT),
            platform: session.platform,
            deviceName: session.deviceName,
          };

          return {
            ...prevState,
            reactNativeBridge,
            description: prevState.description || reactNativeBridge.adapterLabel || '',
            database: reactNativeBridge.adapterLabel || reactNativeBridge.adapterId,
          };
        });
      },
      [setState],
    );

    const applyStatus = React.useCallback((status: IReactNativeBridgeStatus) => {
      const nextSessions = status.sessions || [];

      setSessions(nextSessions);
      setSelectedSessionId((current) => {
        if (current && nextSessions.some((session) => session.id === current)) return current;

        const savedSession = nextSessions.find((session) => session.appId === appIdRef.current);
        return savedSession?.id || nextSessions[0]?.id || '';
      });
    }, []);

    const refreshSessions = React.useCallback(async () => {
      applyStatus(await getReactNativeBridgeStatus());
    }, [applyStatus, getReactNativeBridgeStatus]);

    const handleBridgePortChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const port = Number(event.target.value) || DEFAULT_BRIDGE_PORT;

        setState((prevState) => ({
          ...prevState,
          reactNativeBridge: {
            ...prevState.reactNativeBridge,
            adapterId: prevState.reactNativeBridge?.adapterId || '',
            port,
          },
        }));
      },
      [setState],
    );

    const handleSessionChange = React.useCallback(
      ({ value: sessionId }: { value: string | number }) => {
        const selectedId = String(sessionId);
        const session = sessions.find((item) => item.id === selectedId);
        const adapter = session?.adapters.find(
          (item) => item.model === 'relational' && item.dialect === 'sqlite',
        );

        setSelectedSessionId(selectedId);

        if (!session || !adapter) return;

        selectAdapter(session, adapter);
      },
      [selectAdapter, sessions],
    );

    const handleAdapterChange = React.useCallback(
      ({ value: adapterId }: { value: string | number }) => {
        const selectedId = String(adapterId);
        const adapter = adapters.find((item) => item.id === selectedId);

        if (!selectedSession || !adapter) return;

        selectAdapter(selectedSession, adapter);
      },
      [adapters, selectAdapter, selectedSession],
    );

    React.useEffect(() => {
      let mounted = true;

      const startAndRefresh = async () => {
        setLoading(true);

        try {
          const status = await startReactNativeBridgeGateway(BRIDGE_SOURCE, { port: bridgePort });
          if (mounted) applyStatus(status);
        } finally {
          if (mounted) setLoading(false);
        }
      };

      const refresh = async () => {
        if (!mounted) return;

        try {
          await refreshSessions();
        } catch (error) {
          console.error(error);
        }
      };

      startAndRefresh();
      const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);

      return () => {
        mounted = false;
        window.clearInterval(interval);
        stopReactNativeBridgeGateway(BRIDGE_SOURCE).catch(console.error);
      };
    }, [
      applyStatus,
      bridgePort,
      refreshSessions,
      startReactNativeBridgeGateway,
      stopReactNativeBridgeGateway,
    ]);

    return (
      <>
        <Input
          required
          label={t('reactNativeBridge.port')}
          sm={8}
          md={6}
          type="number"
          color={color}
          backgroundColor={backgroundColor}
          value={bridgePort}
          onChange={handleBridgePortChange}
        />

        <Autocomplete
          required
          clearable={false}
          loading={loading}
          data={sessions}
          label={t('reactNativeBridge.app')}
          emptyMessage={t('reactNativeBridge.sessions.empty')}
          extractLabel={(item) =>
            [item.appName || item.appId || item.id, item.platform, item.deviceName]
              .filter(Boolean)
              .join(' · ')
          }
          extractValue={(item) => item.id}
          color={color}
          backgroundColor={backgroundColor}
          md={12}
          value={selectedSessionId}
          onChange={handleSessionChange}
        />

        <Autocomplete
          required
          clearable={false}
          data={adapters}
          label={t('reactNativeBridge.adapter')}
          emptyMessage={t('reactNativeBridge.adapters.empty')}
          extractLabel={(item) => item.label || item.id}
          extractValue={(item) => item.id}
          color={color}
          backgroundColor={backgroundColor}
          md={12}
          value={value?.adapterId || ''}
          onChange={handleAdapterChange}
        />
      </>
    );
  },
);

ReactNativeBridgeFields.displayName = 'ReactNativeBridgeFields';
