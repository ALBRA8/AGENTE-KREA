/**
 * KREA Security Manager — ADN GENERAL DEL AGENTE V1.0
 *
 * Provides:
 *   - Authentication (token-based, hashed passwords)
 *   - Authorization (permission checks)
 *   - User isolation (never access another user's data)
 *   - Credential management (hash/verify passwords)
 *   - Input validation & sanitization
 *   - Prompt injection protection
 *   - SSRF protection
 *   - Rate limiting (in-memory)
 *   - Audit trail
 */

import { db } from "@/lib/db";
import crypto from "crypto";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ValidationSchema {
  fields: Record<string, FieldRule>;
}

export interface FieldRule {
  type: "string" | "number" | "email" | "url" | "boolean";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitized: Record<string, unknown>;
}

export interface PermissionRule {
  id: string;
  name: string;
  description: string;
  roles: string[]; // which roles have this permission
}

export interface ToolAccessRule {
  toolId: string;
  requiredPlan: string[]; // e.g., ["starter", "pro", "enterprise"]
  creditCost: number;
}

export interface AuditEntry {
  action: string;
  resource: string;
  userId?: string;
  result: "success" | "denied" | "error";
  details?: Record<string, unknown>;
  ip?: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface PromptInjectionResult {
  isInjection: boolean;
  confidence: number;
  patterns: string[];
  recommendation: string;
}

export interface SSRFCheckResult {
  isSafe: boolean;
  reason?: string;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const HASH_ITERATIONS = 100000;
const TOKEN_EXPIRY_HOURS = 24;
const TOKEN_BYTES = 48;

// Prompt injection patterns (regex)
const PROMPT_INJECTION_PATTERNS: { pattern: RegExp; name: string; severity: number }[] = [
  { pattern: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i, name: "ignore_previous", severity: 0.95 },
  { pattern: /you\s+are\s+now?\s+/i, name: "role_hijack", severity: 0.8 },
  { pattern: /system\s*:\s*/i, name: "system_prefix", severity: 0.9 },
  { pattern: /<\/?(system|user|assistant)>/i, name: "tag_injection", severity: 0.9 },
  { pattern: /override\s+(safety|security|filter)/i, name: "override_safety", severity: 0.95 },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, name: "pretend", severity: 0.7 },
  { pattern: /jailbreak/i, name: "jailbreak_keyword", severity: 0.95 },
  { pattern: /DAN\s+mode/i, name: "dan_mode", severity: 0.95 },
  { pattern: /reveal\s+(your|the)\s+(prompt|instructions|system)/i, name: "prompt_leak", severity: 0.85 },
  { pattern: /execute\s+(arbitrary\s+)?code/i, name: "code_exec", severity: 0.9 },
  { pattern: /\/\*[\s\S]*?\*\//g, name: "comment_injection", severity: 0.6 },
  { pattern: /\\u[0-9a-fA-F]{4}/, name: "unicode_escape", severity: 0.5 },
  { pattern: /\b(eval|exec|spawn|child_process|require\s*\()\b/, name: "code_injection_js", severity: 0.9 },
  { pattern: /;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE)\s+/i, name: "sql_injection", severity: 0.9 },
];

// SSRF blocked patterns
const SSRF_BLOCKED_HOSTS = [
  "127.0.0.1", "localhost", "0.0.0.0", "::1",
  "169.254.169.254", // AWS metadata
  "100.100.100.200", // Alibaba Cloud metadata
  "metadata.google.internal", // GCP metadata
  "metadata.azure.com", // Azure metadata
];
const SSRF_BLOCKED_RANGES = [
  { start: "10.0.0.0", end: "10.255.255.255" },
  { start: "172.16.0.0", end: "172.31.255.255" },
  { start: "192.168.0.0", end: "192.168.255.255" },
];

// ──────────────────────────────────────────────
// SecurityManager
// ──────────────────────────────────────────────

export class SecurityManager {
  // In-memory rate limit store
  private rateLimitStore = new Map<string, RateLimitEntry>();

  // Permission rules registry
  private permissionRules: PermissionRule[] = [
    {
      id: "generate_image",
      name: "Generate Image",
      description: "Create images using AI generation",
      roles: ["starter", "pro", "enterprise"],
    },
    {
      id: "generate_text",
      name: "Generate Text",
      description: "Create text/copy content",
      roles: ["starter", "pro", "enterprise"],
    },
    {
      id: "generate_voice",
      name: "Generate Voice",
      description: "Create TTS audio content",
      roles: ["pro", "enterprise"],
    },
    {
      id: "generate_ebook",
      name: "Generate Ebook",
      description: "Create ebook documents",
      roles: ["pro", "enterprise"],
    },
    {
      id: "view_metrics",
      name: "View Metrics",
      description: "Access campaign metrics dashboard",
      roles: ["starter", "pro", "enterprise"],
    },
    {
      id: "admin_access",
      name: "Admin Access",
      description: "Access admin functions and settings",
      roles: ["enterprise"],
    },
    {
      id: "doctor_access",
      name: "Doctor Access",
      description: "Run health diagnostics",
      roles: ["pro", "enterprise"],
    },
    {
      id: "mcp_use",
      name: "MCP Use",
      description: "Use MCP server/client tools",
      roles: ["pro", "enterprise"],
    },
    {
      id: "agent_comm",
      name: "Agent Communication",
      description: "Communicate with other agents",
      roles: ["pro", "enterprise"],
    },
  ];

  // Tool access rules
  private toolAccessRules: ToolAccessRule[] = [
    { toolId: "krea_generate_image", requiredPlan: ["starter", "pro", "enterprise"], creditCost: 5 },
    { toolId: "krea_generate_text", requiredPlan: ["starter", "pro", "enterprise"], creditCost: 2 },
    { toolId: "krea_generate_voice", requiredPlan: ["pro", "enterprise"], creditCost: 8 },
    { toolId: "krea_generate_ebook", requiredPlan: ["pro", "enterprise"], creditCost: 15 },
    { toolId: "krea_get_metrics", requiredPlan: ["starter", "pro", "enterprise"], creditCost: 0 },
    { toolId: "krea_doctor", requiredPlan: ["pro", "enterprise"], creditCost: 0 },
    { toolId: "krea_get_capabilities", requiredPlan: ["starter", "pro", "enterprise"], creditCost: 0 },
  ];

  // ──────────────────────────────────────────────
  // Input Validation
  // ──────────────────────────────────────────────

  validateInput(input: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, unknown> = {};

    for (const [fieldName, rule] of Object.entries(schema.fields)) {
      const value = input[fieldName];

      // Required check
      if (rule.required && (value === undefined || value === null || value === "")) {
        errors[fieldName] = `${fieldName} is required`;
        continue;
      }

      // Skip further validation if not required and empty
      if (value === undefined || value === null) {
        continue;
      }

      // Type-specific validation
      switch (rule.type) {
        case "string": {
          if (typeof value !== "string") {
            errors[fieldName] = `${fieldName} must be a string`;
            break;
          }
          if (rule.minLength && value.length < rule.minLength) {
            errors[fieldName] = `${fieldName} must be at least ${rule.minLength} characters`;
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors[fieldName] = `${fieldName} must be at most ${rule.maxLength} characters`;
          }
          if (rule.pattern && !rule.pattern.test(value)) {
            errors[fieldName] = `${fieldName} does not match required pattern`;
          }
          sanitized[fieldName] = this.sanitizeInput(value);
          break;
        }

        case "number": {
          const num = Number(value);
          if (isNaN(num)) {
            errors[fieldName] = `${fieldName} must be a number`;
            break;
          }
          if (rule.min !== undefined && num < rule.min) {
            errors[fieldName] = `${fieldName} must be at least ${rule.min}`;
          }
          if (rule.max !== undefined && num > rule.max) {
            errors[fieldName] = `${fieldName} must be at most ${rule.max}`;
          }
          sanitized[fieldName] = num;
          break;
        }

        case "email": {
          if (typeof value !== "string") {
            errors[fieldName] = `${fieldName} must be a string`;
            break;
          }
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(value)) {
            errors[fieldName] = `${fieldName} must be a valid email`;
          }
          sanitized[fieldName] = this.sanitizeInput(value.toLowerCase());
          break;
        }

        case "url": {
          if (typeof value !== "string") {
            errors[fieldName] = `${fieldName} must be a string`;
            break;
          }
          try {
            new URL(value);
            sanitized[fieldName] = value;
          } catch {
            errors[fieldName] = `${fieldName} must be a valid URL`;
          }
          break;
        }

        case "boolean": {
          if (typeof value !== "boolean") {
            // Accept string booleans
            if (value === "true" || value === "false") {
              sanitized[fieldName] = value === "true";
            } else {
              errors[fieldName] = `${fieldName} must be a boolean`;
            }
          } else {
            sanitized[fieldName] = value;
          }
          break;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      sanitized,
    };
  }

  // ──────────────────────────────────────────────
  // Input Sanitization
  // ──────────────────────────────────────────────

  sanitizeInput(input: string): string {
    if (typeof input !== "string") return String(input);

    let sanitized = input;

    // XSS prevention — strip HTML/script tags
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, ""); // event handlers
    sanitized = sanitized.replace(/javascript\s*:/gi, "");
    sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, "");

    // SQL injection prevention — escape dangerous SQL patterns
    sanitized = sanitized.replace(/'\s*(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/gi, "");
    sanitized = sanitized.replace(/;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE)\s+/gi, "");
    sanitized = sanitized.replace(/--\s*$/gm, ""); // SQL comments
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, ""); // SQL block comments

    // Null byte injection
    sanitized = sanitized.replace(/\0/g, "");

    // Path traversal
    sanitized = sanitized.replace(/\.\.\//g, "");
    sanitized = sanitized.replace(/\\\.\.\\/g, "");

    // Unicode homoglyph normalization
    sanitized = sanitized.normalize("NFKC");

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  // ──────────────────────────────────────────────
  // Prompt Injection Detection
  // ──────────────────────────────────────────────

  checkPromptInjection(prompt: string): PromptInjectionResult {
    const detected: { name: string; severity: number }[] = [];

    for (const { pattern, name, severity } of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(prompt)) {
        detected.push({ name, severity });
      }
    }

    const maxSeverity = detected.length > 0
      ? Math.max(...detected.map((d) => d.severity))
      : 0;

    // Weighted confidence based on number and severity of matches
    const confidence = detected.length > 0
      ? Math.min(1, maxSeverity * (1 + (detected.length - 1) * 0.1))
      : 0;

    const isInjection = confidence >= 0.7;

    return {
      isInjection,
      confidence: Math.round(confidence * 100) / 100,
      patterns: detected.map((d) => d.name),
      recommendation: isInjection
        ? `Potential prompt injection detected (confidence: ${Math.round(confidence * 100)}%). Reject or sanitize the input.`
        : confidence >= 0.4
          ? `Suspicious patterns detected (confidence: ${Math.round(confidence * 100)}%). Review carefully.`
          : "Input appears safe.",
    };
  }

  // ──────────────────────────────────────────────
  // SSRF Protection
  // ──────────────────────────────────────────────

  checkSSRF(url: string): SSRFCheckResult {
    try {
      const parsed = new URL(url);

      // Check protocol
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { isSafe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check blocked hosts
      if (SSRF_BLOCKED_HOSTS.includes(hostname)) {
        return { isSafe: false, reason: `Blocked host: ${hostname}` };
      }

      // Check for IP addresses in blocked ranges
      const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (ipMatch) {
        const ipNum = (octets: number[]) =>
          octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3];

        const octets = [Number(ipMatch[1]), Number(ipMatch[2]), Number(ipMatch[3]), Number(ipMatch[4])];

        // Validate octets
        if (octets.some((o) => o > 255)) {
          return { isSafe: false, reason: "Invalid IP address" };
        }

        const target = ipNum(octets);

        for (const range of SSRF_BLOCKED_RANGES) {
          const startOctets = range.start.split(".").map(Number);
          const endOctets = range.end.split(".").map(Number);
          if (target >= ipNum(startOctets) && target <= ipNum(endOctets)) {
            return { isSafe: false, reason: `IP in private range: ${range.start}-${range.end}` };
          }
        }
      }

      // Check for suspicious TLDs or patterns
      if (hostname.endsWith(".internal") || hostname.endsWith(".local") || hostname.endsWith(".loopback")) {
        return { isSafe: false, reason: `Internal hostname: ${hostname}` };
      }

      return { isSafe: true };
    } catch {
      return { isSafe: false, reason: "Invalid URL format" };
    }
  }

  // ──────────────────────────────────────────────
  // Tool Access Validation
  // ──────────────────────────────────────────────

  async validateToolAccess(userId: string, toolId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return { allowed: false, reason: "User not found" };

      const rule = this.toolAccessRules.find((r) => r.toolId === toolId);
      if (!rule) return { allowed: false, reason: `Unknown tool: ${toolId}` };

      if (!rule.requiredPlan.includes(user.plan)) {
        return {
          allowed: false,
          reason: `Plan '${user.plan}' does not have access to ${toolId}. Required: ${rule.requiredPlan.join(", ")}`,
        };
      }

      if (rule.creditCost > 0 && user.credits < rule.creditCost) {
        return {
          allowed: false,
          reason: `Insufficient credits. Need ${rule.creditCost}, have ${user.credits}`,
        };
      }

      return { allowed: true };
    } catch (e: any) {
      return { allowed: false, reason: `Error checking access: ${e.message}` };
    }
  }

  // ──────────────────────────────────────────────
  // Permission Validation
  // ──────────────────────────────────────────────

  async validatePermission(userId: string, permission: string): Promise<{ granted: boolean; reason?: string }> {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return { granted: false, reason: "User not found" };

      const rule = this.permissionRules.find((r) => r.id === permission);
      if (!rule) return { granted: false, reason: `Unknown permission: ${permission}` };

      if (!rule.roles.includes(user.plan)) {
        return {
          granted: false,
          reason: `Plan '${user.plan}' does not have '${permission}' permission. Required roles: ${rule.roles.join(", ")}`,
        };
      }

      return { granted: true };
    } catch (e: any) {
      return { granted: false, reason: `Error checking permission: ${e.message}` };
    }
  }

  // ──────────────────────────────────────────────
  // Audit Logging
  // ──────────────────────────────────────────────

  async auditLog(entry: AuditEntry): Promise<string> {
    try {
      const record = await db.auditEvent.create({
        data: {
          action: entry.action,
          resource: entry.resource,
          userId: entry.userId,
          result: entry.result.toUpperCase(),
          details: entry.details ? JSON.stringify(entry.details) : null,
          ip: entry.ip,
        },
      });
      return record.id;
    } catch (e: any) {
      // Audit logging should never fail silently — but we don't want to crash
      console.error("[SecurityManager] Audit log failed:", e.message);
      return "audit-failed";
    }
  }

  // ──────────────────────────────────────────────
  // Password Hashing (Node.js crypto — no external deps)
  // ──────────────────────────────────────────────

  hashPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH).toString("hex");
    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      HASH_ITERATIONS,
      KEY_LENGTH,
      "sha512"
    );
    return `$pbkdf2$${HASH_ITERATIONS}$${salt}$${derivedKey.toString("hex")}`;
  }

  verifyPassword(password: string, hash: string): boolean {
    if (!hash.startsWith("$pbkdf2$")) {
      // Legacy: compare directly (not ideal but supports migration)
      return crypto.timingSafeEqual(
        Buffer.from(password, "utf8"),
        Buffer.from(hash, "utf8")
      );
    }

    const parts = hash.split("$");
    // $pbkdf2$iterations$salt$derivedKey
    if (parts.length !== 5) return false;

    const iterations = parseInt(parts[2], 10);
    const salt = parts[3];
    const storedKey = parts[4];

    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      KEY_LENGTH,
      "sha512"
    ).toString("hex");

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(derivedKey, "hex"),
      Buffer.from(storedKey, "hex")
    );
  }

  // ──────────────────────────────────────────────
  // Token Management
  // ──────────────────────────────────────────────

  async generateToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.session.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  async validateToken(token: string): Promise<{ valid: boolean; userId?: string; expired?: boolean }> {
    if (!token) return { valid: false };

    try {
      const session = await db.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!session) return { valid: false };

      // Check expiry
      if (new Date() > session.expiresAt) {
        // Clean up expired session
        await db.session.delete({ where: { id: session.id } }).catch(() => {});
        return { valid: false, expired: true };
      }

      return { valid: true, userId: session.userId };
    } catch {
      return { valid: false };
    }
  }

  async revokeToken(token: string): Promise<boolean> {
    try {
      await db.session.delete({ where: { token } });
      return true;
    } catch {
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return result.count;
    } catch {
      return 0;
    }
  }

  // ──────────────────────────────────────────────
  // Rate Limiting
  // ──────────────────────────────────────────────

  rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.rateLimitStore.get(key);

    // No entry or window expired — create new
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      this.rateLimitStore.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    // Within window — increment count
    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }

  /**
   * Clean up expired rate limit entries to prevent memory leaks.
   */
  cleanupRateLimits(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        this.rateLimitStore.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  // ──────────────────────────────────────────────
  // User Isolation
  // ──────────────────────────────────────────────

  isIsolated(userId: string, resourceOwnerId: string): boolean {
    // A user can ONLY access their own data
    // Admin (enterprise) can access all data — but still audited
    return userId === resourceOwnerId;
  }

  /**
   * Enforce user isolation — throws if userId does not match resourceOwnerId.
   * Returns true if access is allowed.
   */
  enforceIsolation(userId: string, resourceOwnerId: string, action: string): boolean {
    if (!this.isIsolated(userId, resourceOwnerId)) {
      // Audit the violation attempt
      this.auditLog({
        action: "isolation_violation",
        resource: action,
        userId,
        result: "denied",
        details: { attemptedOwner: resourceOwnerId, action },
      });
      return false;
    }
    return true;
  }

  // ──────────────────────────────────────────────
  // Get permission rules (used by Doctor V2)
  // ──────────────────────────────────────────────

  getPermissionRules(): PermissionRule[] {
    return [...this.permissionRules];
  }

  getToolAccessRules(): ToolAccessRule[] {
    return [...this.toolAccessRules];
  }

  /**
   * Check if a user can perform a generation action.
   * Combines permission + credits + rate limit check.
   */
  async canGenerate(
    userId: string,
    type: string,
    creditCost: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Check permission
    const perm = await this.validatePermission(userId, `generate_${type}`);
    if (!perm.granted) return { allowed: false, reason: perm.reason };

    // 2. Check credits
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { allowed: false, reason: "User not found" };
    if (user.credits < creditCost) {
      return { allowed: false, reason: `Insufficient credits. Need ${creditCost}, have ${user.credits}` };
    }

    // 3. Rate limit (per user, per type)
    const rlKey = `gen:${userId}:${type}`;
    const rl = this.rateLimit(rlKey, 20, 60 * 1000); // 20 per minute
    if (!rl.allowed) {
      return { allowed: false, reason: "Rate limit exceeded. Try again later." };
    }

    return { allowed: true };
  }
}
