import addListener from '../utils/addListener';
import { toReactNativeBridgeConnectionStatus } from '../database/utils/reactNativeBridge';
import {
  getReactNativeBridgeStatus,
  releaseReactNativeBridgeGateway,
  retainReactNativeBridgeGateway,
  stopReactNativeBridgeGateway,
} from './gateway';
import { getReactNativeBridgeSessions } from './sessions';

addListener('@get:react_native_bridge_status', () =>
  toReactNativeBridgeConnectionStatus(getReactNativeBridgeStatus()),
);
addListener('@get:react_native_bridge_sessions', getReactNativeBridgeSessions);
addListener('@post:react_native_bridge_start_gateway', async (source, options) =>
  toReactNativeBridgeConnectionStatus(await retainReactNativeBridgeGateway(source, options)),
);
addListener('@post:react_native_bridge_stop_gateway', releaseReactNativeBridgeGateway);

export { stopReactNativeBridgeGateway };
