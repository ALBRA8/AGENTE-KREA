/**
 * KREA ARNÉS — Python Bridge
 *
 * Bridge que conecta KREA con scripts Python via subprocess.
 * Usado para:
 *   - Infoproductos (13 scripts Python)
 *   - AGENTE-GENERAL / albra_seed (si está disponible)
 *   - Cualquier herramienta Python que KREA necesite
 *
 * Flujo:
 *   KREA (arnés) → PythonBridge → python3 subprocess → script.py
 *
 * Principio: KREA no sabe Python. Solo sabe cómo llamarlo.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import type { EvidenceTag } from "../agent-adapter";
import type {
  IBridge,
  BridgeHealth,
  PythonCallParams,
  PythonCallResult,
} from "./types";

const execFileAsync = promisify(execFile);

// ─── PythonBridge ──────────────────────────────────────────────────

export class PythonBridge implements IBridge {
  readonly bridgeId: string;
  readonly bridgeType = "python" as const;
  readonly capabilities: string[];

  private pythonCmd: string;
  private scriptsPath: string;
  private defaultTimeout: number;
  private _isConnected = false;

  constructor(config: {
    id: string;
    scriptsPath: string;
    capabilities?: string[];
    pythonCmd?: string;
    timeout?: number;
  }) {
    this.bridgeId = config.id;
    this.scriptsPath = config.scriptsPath;
    this.capabilities = config.capabilities || ["subprocess", "python-scripts"];
    this.pythonCmd = config.pythonCmd || process.env.PYTHON_CMD || "python3";
    this.defaultTimeout = config.timeout || 120000;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  async initialize(): Promise<void> {
    try {
      // Verify Python is available
      const { stdout } = await execFileAsync(this.pythonCmd, ["--version"], { timeout: 5000 });
      this._isConnected = true;
      console.info(`[PythonBridge:${this.bridgeId}] Connected: ${stdout.trim()}`);
    } catch (error) {
      this._isConnected = false;
      console.warn(`[PythonBridge:${this.bridgeId}] Python unavailable:`, error);
    }
  }

  async shutdown(): Promise<void> {
    this._isConnected = false;
  }

  async healthCheck(): Promise<BridgeHealth> {
    const start = Date.now();
    try {
      await execFileAsync(this.pythonCmd, ["-c", "print('ok')"], { timeout: 5000 });
      this._isConnected = true;
      return { status: "CONNECTED", latencyMs: Date.now() - start };
    } catch {
      this._isConnected = false;
      return { status: "DISCONNECTED", latencyMs: Date.now() - start, details: "Python runtime not found" };
    }
  }

  // ─── Call a Python script ────────────────────────────────────

  async call(params: PythonCallParams): Promise<PythonCallResult> {
    const start = Date.now();

    if (!this._isConnected) {
      return {
        success: false,
        error: "Python bridge not connected — runtime unavailable",
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: this.bridgeId,
      };
    }

    try {
      // Resolve script path
      const scriptPath = path.isAbsolute(params.script)
        ? params.script
        : path.join(this.scriptsPath, params.script);

      const timeout = params.timeout || this.defaultTimeout;
      const cwd = params.cwd || this.scriptsPath;
      const env = { ...process.env, ...(params.env || {}) };

      const { stdout } = await execFileAsync(
        this.pythonCmd,
        [scriptPath, ...params.args],
        { timeout, cwd, env },
      );

      const output = stdout.trim();
      let parsed: unknown = undefined;

      if (params.parseJson) {
        try {
          // Extract JSON from output (may have other text before/after)
          const jsonMatch = output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // JSON parse failed — return raw output
        }
      }

      return {
        success: true,
        data: { stdout: output, parsed, exitCode: 0 },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: this.bridgeId,
      };
    } catch (error: any) {
      const exitCode = error.code === "ETIMEDOUT" ? -1 : (error.status || 1);
      return {
        success: false,
        error: `Python script failed: ${error.message || error}`,
        data: { stdout: error.stdout?.trim() || "", exitCode },
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: this.bridgeId,
      };
    }
  }

  // ─── Convenience: run a script and get stdout ────────────────

  async runScript(scriptName: string, args: string[] = []): Promise<string> {
    const result = await this.call({ script: scriptName, args });
    if (!result.success) {
      throw new Error(result.error || "Python script failed");
    }
    return (result.data as any)?.stdout || "";
  }

  // ─── Convenience: run a script and parse JSON ────────────────

  async runScriptJson<T = unknown>(scriptName: string, args: string[] = []): Promise<T> {
    const result = await this.call({ script: scriptName, args, parseJson: true });
    if (!result.success) {
      throw new Error(result.error || "Python script failed");
    }
    return (result.data as any)?.parsed as T;
  }
}

// ─── Pre-configured instances ──────────────────────────────────────

/** Bridge para los scripts de infoproductos */
export const infoproductosPythonBridge = new PythonBridge({
  id: "python-infoproductos",
  scriptsPath: path.join(process.cwd(), "src", "lib", "infoproductos", "scripts"),
  capabilities: [
    "infoproductos.validate-demand",
    "infoproductos.review",
    "infoproductos.assemble",
    "infoproductos.cover",
    "infoproductos.sales-page",
    "infoproductos.ebook",
    "infoproductos.style",
    "infoproductos.autocomplete",
  ],
});

/** Bridge para albra_seed / AGENTE-GENERAL (si está disponible) */
export const agenteGeneralPythonBridge = new PythonBridge({
  id: "python-agente-general",
  scriptsPath: process.env.AGENTE_GENERAL_PATH || path.join(process.cwd(), "albra_seed"),
  capabilities: [
    "agent.run",
    "agent.health",
    "memory.write",
    "memory.read",
    "audit.log",
    "firewall.check",
    "handoff.send",
  ],
});
