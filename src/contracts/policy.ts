/**
 * Policy Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines the permissions, policies, and access control system.
 * Separates concerns into: CAPABILITY, PERMISSION, SKILL, APPROVAL.
 *
 * The PolicyEngine evaluates whether an action is permitted by checking
 * permissions, policies, and approval requirements before any execution.
 */

import { randomUUID } from "crypto";

// ─── Permission Types ────────────────────────────────────────────────────────

/** Core permission types for the agent */
export type PermissionType =
  | "read"            // Read data
  | "write"           // Write data
  | "delete"          // Delete data
  | "external_exec"   // Execute external API calls
  | "publish"         // Publish data externally
  | "credential_access" // Access credentials/secrets
  | "api_access"      // Access external APIs
  | "sensitive_ops"   // Perform sensitive operations
  | "db_read"         // Read from database
  | "db_write"        // Write to database
  | "storage_read"    // Read from file storage
  | "storage_write"   // Write to file storage
  | "self_modify"     // Modify own configuration
  | "delegate"        // Delegate to another agent
  | "audit"           // Access audit logs
  | "admin";          // Administrative operations

/** All permission types as a readonly array */
export const ALL_PERMISSIONS: readonly PermissionType[] = [
  "read", "write", "delete", "external_exec", "publish",
  "credential_access", "api_access", "sensitive_ops",
  "db_read", "db_write", "storage_read", "storage_write",
  "self_modify", "delegate", "audit", "admin",
] as const;

// ─── Permission Set ──────────────────────────────────────────────────────────

/** A named set of permissions (like a role) */
export interface PermissionSet {
  /** Unique ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Permissions in this set */
  permissions: PermissionType[];
  /** Category for grouping */
  category: "CAPABILITY" | "PERMISSION" | "SKILL" | "APPROVAL";
}

// ─── Policy Rule ─────────────────────────────────────────────────────────────

/** Effect of a policy rule */
export type PolicyEffect = "ALLOW" | "DENY";

/** Condition for a policy rule */
export interface PolicyCondition {
  /** Field to check */
  field: string;
  /** Comparison operator */
  operator: "eq" | "neq" | "in" | "not_in" | "gt" | "lt" | "gte" | "lte" | "contains" | "matches";
  /** Value to compare against */
  value: unknown;
}

/** A single policy rule */
export interface PolicyRule {
  /** Unique rule ID */
  ruleId: string;
  /** Rule name */
  name: string;
  /** Description */
  description: string;
  /** Effect when rule matches */
  effect: PolicyEffect;
  /** Actions this rule applies to */
  actions: string[];
  /** Resources this rule applies to */
  resources: string[];
  /** Conditions that must be met */
  conditions: PolicyCondition[];
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Whether this rule is active */
  active: boolean;
  /** Category */
  category: "CAPABILITY" | "PERMISSION" | "SKILL" | "APPROVAL";
}

// ─── Approval Requirement ────────────────────────────────────────────────────

/** Approval requirement definition */
export interface ApprovalRequirement {
  /** Unique ID */
  id: string;
  /** What requires approval */
  action: string;
  /** Approval level needed */
  level: "auto" | "user" | "admin" | "system";
  /** Description of why approval is needed */
  reason: string;
  /** Whether this can be auto-approved under certain conditions */
  autoApproveConditions?: PolicyCondition[];
  /** Timeout for approval request (ms) */
  timeoutMs: number;
  /** Category */
  category: "CAPABILITY" | "PERMISSION" | "SKILL" | "APPROVAL";
}

// ─── Policy Evaluation Context ───────────────────────────────────────────────

/** Context for policy evaluation */
export interface PolicyContext {
  /** Who is requesting the action */
  subject: string;
  /** What action is being requested */
  action: string;
  /** What resource is being accessed */
  resource: string;
  /** Additional context data */
  environment: Record<string, unknown>;
}

// ─── Policy Decision ─────────────────────────────────────────────────────────

/** Result of policy evaluation */
export interface PolicyDecision {
  /** Whether the action is allowed */
  allowed: boolean;
  /** The effect determined */
  effect: PolicyEffect;
  /** Which rules were evaluated */
  evaluatedRules: string[];
  /** Which rule made the final decision */
  decidingRule: string;
  /** Reason for the decision */
  reason: string;
  /** Whether approval is required */
  approvalRequired: boolean;
  /** Approval details if required */
  approvalRequirement?: ApprovalRequirement;
  /** Timestamp */
  timestamp: string;
}

// ─── Policy Engine ───────────────────────────────────────────────────────────

/**
 * PolicyEngine — Evaluates permissions and policies before execution.
 * Implements a deny-by-default approach: if no rule explicitly allows
 * an action, it is denied.
 */
export class PolicyEngine {
  private permissionSets: Map<string, PermissionSet> = new Map();
  private rules: PolicyRule[] = [];
  private approvalRequirements: Map<string, ApprovalRequirement> = new Map();
  private subjectPermissions: Map<string, Set<PermissionType>> = new Map();

  // ── Permission Set Management ─────────────────────────────────────────

  /** Register a permission set */
  registerPermissionSet(set: PermissionSet): void {
    this.permissionSets.set(set.id, set);
  }

  /** Get a permission set by ID */
  getPermissionSet(id: string): PermissionSet | undefined {
    return this.permissionSets.get(id);
  }

  /** Get all permission sets */
  getAllPermissionSets(): PermissionSet[] {
    return Array.from(this.permissionSets.values());
  }

  // ── Subject Permission Management ─────────────────────────────────────

  /** Assign permissions to a subject (user/agent) */
  assignPermissions(subject: string, permissions: PermissionType[]): void {
    this.subjectPermissions.set(subject, new Set(permissions));
  }

  /** Assign a permission set to a subject */
  assignPermissionSet(subject: string, setId: string): void {
    const set = this.permissionSets.get(setId);
    if (set) {
      const existing = this.subjectPermissions.get(subject) || new Set();
      for (const perm of set.permissions) {
        existing.add(perm);
      }
      this.subjectPermissions.set(subject, existing);
    }
  }

  /** Get permissions for a subject */
  getSubjectPermissions(subject: string): PermissionType[] {
    const perms = this.subjectPermissions.get(subject);
    return perms ? Array.from(perms) : [];
  }

  /** Check if a subject has a specific permission */
  hasPermission(subject: string, permission: PermissionType): boolean {
    const perms = this.subjectPermissions.get(subject);
    return perms ? perms.has(permission) : false;
  }

  // ── Policy Rule Management ────────────────────────────────────────────

  /** Add a policy rule */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    // Sort by priority (highest first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /** Remove a policy rule */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.ruleId !== ruleId);
  }

  /** Get all rules */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  // ── Approval Requirement Management ───────────────────────────────────

  /** Register an approval requirement */
  registerApprovalRequirement(requirement: ApprovalRequirement): void {
    this.approvalRequirements.set(requirement.id, requirement);
  }

  /** Get approval requirement for an action */
  getApprovalRequirement(action: string): ApprovalRequirement | undefined {
    for (const req of Array.from(this.approvalRequirements.values())) {
      if (req.action === action || action.startsWith(req.action)) {
        return req;
      }
    }
    return undefined;
  }

  // ── Policy Evaluation ─────────────────────────────────────────────────

  /**
   * Evaluate whether an action is allowed for a subject.
   * Deny-by-default: if no rule explicitly allows, the action is denied.
   */
  evaluate(context: PolicyContext): PolicyDecision {
    const timestamp = new Date().toISOString();
    const evaluatedRules: string[] = [];
    let decidingRule = "default_deny";
    let effect: PolicyEffect = "DENY";
    let reason = "No matching allow rule found (deny by default)";

    // Evaluate rules in priority order
    for (const rule of this.rules) {
      if (!rule.active) continue;

      evaluatedRules.push(rule.ruleId);

      // Check if rule applies to this action
      const actionMatches = rule.actions.some((action) =>
        action === "*" || action === context.action || context.action.startsWith(action)
      );
      if (!actionMatches) continue;

      // Check if rule applies to this resource
      const resourceMatches = rule.resources.some((resource) =>
        resource === "*" || resource === context.resource || context.resource.startsWith(resource)
      );
      if (!resourceMatches) continue;

      // Evaluate conditions
      const conditionsMet = this.evaluateConditions(rule.conditions, context.environment);
      if (!conditionsMet) continue;

      // Rule matches — apply its effect
      decidingRule = rule.ruleId;
      effect = rule.effect;
      reason = `Rule "${rule.name}" (${rule.ruleId}): ${rule.effect}`;
      break; // First matching rule wins
    }

    // Check approval requirements
    const approvalReq = this.getApprovalRequirement(context.action);
    const approvalRequired = approvalReq !== undefined;

    return {
      allowed: effect === "ALLOW",
      effect,
      evaluatedRules,
      decidingRule,
      reason,
      approvalRequired,
      approvalRequirement: approvalRequired ? approvalReq : undefined,
      timestamp,
    };
  }

  /**
   * Quick check: does the subject have permission for this action?
   */
  isAllowed(subject: string, action: string, resource: string = "*"): boolean {
    // First check direct permissions
    const permissionMap: Record<string, PermissionType> = {
      "read": "read",
      "write": "write",
      "delete": "delete",
      "external_exec": "external_exec",
      "publish": "publish",
      "credential_access": "credential_access",
      "api_access": "api_access",
      "sensitive_ops": "sensitive_ops",
      "db_read": "db_read",
      "db_write": "db_write",
      "storage_read": "storage_read",
      "storage_write": "storage_write",
      "self_modify": "self_modify",
      "delegate": "delegate",
    };

    const requiredPerm = permissionMap[action];
    if (requiredPerm && this.hasPermission(subject, requiredPerm)) {
      return true;
    }

    // Fall back to full policy evaluation
    const decision = this.evaluate({
      subject,
      action,
      resource,
      environment: {},
    });

    return decision.allowed;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private evaluateConditions(
    conditions: PolicyCondition[],
    environment: Record<string, unknown>,
  ): boolean {
    if (conditions.length === 0) return true;

    return conditions.every((condition) => {
      const fieldValue = environment[condition.field];

      switch (condition.operator) {
        case "eq":
          return fieldValue === condition.value;
        case "neq":
          return fieldValue !== condition.value;
        case "in":
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case "not_in":
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        case "gt":
          return typeof fieldValue === "number" && fieldValue > (condition.value as number);
        case "lt":
          return typeof fieldValue === "number" && fieldValue < (condition.value as number);
        case "gte":
          return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
        case "lte":
          return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
        case "contains":
          return typeof fieldValue === "string" && fieldValue.includes(condition.value as string);
        case "matches":
          return typeof fieldValue === "string" && new RegExp(condition.value as string).test(fieldValue);
        default:
          return false;
      }
    });
  }
}

// ─── KREA Permission Sets ───────────────────────────────────────────────────

/** Default permission sets for AGENTE-KREA */
export const KREA_PERMISSION_SETS: PermissionSet[] = [
  {
    id: "krea_generation",
    name: "KREA Generation Permissions",
    description: "Permissions for creative generation operations",
    category: "CAPABILITY",
    permissions: ["read", "write", "api_access", "storage_write", "db_read", "db_write"],
  },
  {
    id: "krea_metrics",
    name: "KREA Metrics Permissions",
    description: "Permissions for campaign metrics operations",
    category: "CAPABILITY",
    permissions: ["read", "write", "db_read", "db_write"],
  },
  {
    id: "krea_system",
    name: "KREA System Permissions",
    description: "Permissions for system operations (health checks, audit)",
    category: "PERMISSION",
    permissions: ["read", "db_read", "audit"],
  },
  {
    id: "krea_sensitive",
    name: "KREA Sensitive Permissions",
    description: "Permissions for sensitive operations (credits, credentials)",
    category: "APPROVAL",
    permissions: ["sensitive_ops", "credential_access", "db_write"],
  },
  {
    id: "krea_delegation",
    name: "KREA Delegation Permissions",
    description: "Permissions for delegating tasks to other agents",
    category: "SKILL",
    permissions: ["delegate", "api_access", "read"],
  },
];

// ─── KREA Policy Rules ──────────────────────────────────────────────────────

/** Default policy rules for AGENTE-KREA */
export const KREA_POLICY_RULES: PolicyRule[] = [
  {
    ruleId: "allow_generation_internal",
    name: "Allow Internal Generation",
    description: "Allow all internal generation operations",
    effect: "ALLOW",
    actions: ["read", "write", "api_access", "db_read", "db_write", "storage_write"],
    resources: ["generation/*", "campaign/*", "user/*"],
    conditions: [],
    priority: 10,
    active: true,
    category: "CAPABILITY",
  },
  {
    ruleId: "deny_unauth_external",
    name: "Deny Unauthenticated External",
    description: "Deny external execution without authentication",
    effect: "DENY",
    actions: ["external_exec", "publish"],
    resources: ["external/*"],
    conditions: [
      { field: "authenticated", operator: "eq", value: false },
    ],
    priority: 50,
    active: true,
    category: "PERMISSION",
  },
  {
    ruleId: "require_approval_sensitive",
    name: "Require Approval for Sensitive",
    description: "Sensitive operations require explicit approval",
    effect: "ALLOW",
    actions: ["sensitive_ops", "credential_access", "delete"],
    resources: ["*"],
    conditions: [
      { field: "hasApproval", operator: "eq", value: true },
    ],
    priority: 30,
    active: true,
    category: "APPROVAL",
  },
  {
    ruleId: "deny_self_modify",
    name: "Deny Self Modification",
    description: "Agent cannot modify its own configuration without admin",
    effect: "DENY",
    actions: ["self_modify", "admin"],
    resources: ["config/*", "policy/*"],
    conditions: [
      { field: "isAdmin", operator: "eq", value: false },
    ],
    priority: 40,
    active: true,
    category: "APPROVAL",
  },
  {
    ruleId: "allow_metrics_read",
    name: "Allow Metrics Read",
    description: "Allow reading campaign metrics without restrictions",
    effect: "ALLOW",
    actions: ["read", "db_read"],
    resources: ["campaign/*", "metrics/*"],
    conditions: [],
    priority: 20,
    active: true,
    category: "CAPABILITY",
  },
];

// ─── KREA Approval Requirements ──────────────────────────────────────────────

/** Default approval requirements for AGENTE-KREA */
export const KREA_APPROVAL_REQUIREMENTS: ApprovalRequirement[] = [
  {
    id: "approval_credit_deduct",
    action: "credit_deduct",
    level: "system",
    reason: "Credit deduction affects user balance and must be validated",
    autoApproveConditions: [
      { field: "sufficientBalance", operator: "eq", value: true },
      { field: "amount", operator: "lte", value: 50 },
    ],
    timeoutMs: 5000,
    category: "APPROVAL",
  },
  {
    id: "approval_credit_refund",
    action: "credit_refund",
    level: "system",
    reason: "Credit refund must be validated to prevent abuse",
    timeoutMs: 5000,
    category: "APPROVAL",
  },
  {
    id: "approval_external_publish",
    action: "publish",
    level: "user",
    reason: "Publishing data externally requires user consent",
    timeoutMs: 30000,
    category: "APPROVAL",
  },
  {
    id: "approval_sensitive_ops",
    action: "sensitive_ops",
    level: "admin",
    reason: "Sensitive operations require admin approval",
    timeoutMs: 60000,
    category: "APPROVAL",
  },
  {
    id: "approval_delete_data",
    action: "delete",
    level: "admin",
    reason: "Data deletion is irreversible and requires admin approval",
    timeoutMs: 60000,
    category: "APPROVAL",
  },
];

/**
 * Create the PolicyEngine for AGENTE-KREA with all default rules and permission sets.
 */
export function createKreaPolicyEngine(): PolicyEngine {
  const engine = new PolicyEngine();

  // Register permission sets
  for (const set of KREA_PERMISSION_SETS) {
    engine.registerPermissionSet(set);
  }

  // Add policy rules
  for (const rule of KREA_POLICY_RULES) {
    engine.addRule(rule);
  }

  // Register approval requirements
  for (const req of KREA_APPROVAL_REQUIREMENTS) {
    engine.registerApprovalRequirement(req);
  }

  // Assign default permissions to the krea agent
  engine.assignPermissionSet("krea", "krea_generation");
  engine.assignPermissionSet("krea", "krea_metrics");
  engine.assignPermissionSet("krea", "krea_system");

  return engine;
}
