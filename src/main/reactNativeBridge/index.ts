import addListener from '@main/utils/addListener';
import {
  getReactNativeBridgeStatus,
  releaseReactNativeBridgeGateway,
  retainReactNativeBridgeGateway,
  stopReactNativeBridgeGateway,
} from './gateway';
import { getReactNativeBridgeSessions } from './sessions';

addListener('@get:react_native_bridge_status', getReactNativeBridgeStatus);
addListener('@get:react_native_bridge_sessions', getReactNativeBridgeSessions);
addListener('@post:react_native_bridge_start_gateway', retainReactNativeBridgeGateway);
addListener('@post:react_native_bridge_stop_gateway', releaseReactNativeBridgeGateway);

export { stopReactNativeBridgeGateway };
