/**
 * KREA ARNÉS — Bridges Index
 *
 * Exporta todos los bridges y el registry.
 * Los bridges son las conexiones formales entre KREA y los runtimes externos.
 */

export * from "./types";
export { ZaiSdkBridge, zaiSdkBridge } from "./zai-sdk-bridge";
export {
  PythonBridge,
  infoproductosPythonBridge,
  agenteGeneralPythonBridge,
} from "./python-bridge";
