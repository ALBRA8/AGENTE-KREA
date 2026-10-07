# Task: ADN GENERAL DEL AGENTE V1.0 — Doctor V2, Security, MCP Implementation

## Agent: Main Agent
## Date: 2025-03-05

## Summary

Implemented the expanded ADN GENERAL DEL AGENTE V1.0 for AGENTE-KREA with 5 new TypeScript modules and 1 Prisma schema update. All files compile cleanly (0 TS errors, 0 lint errors in new files).

## Files Created

### 1. `/src/lib/doctor-v2.ts` — KreaDoctorV2
- **15 real health checks**: runtime, database, apis, providers, mcp, memory, skills, permissions, authentication, integrations, configuration, dependencies, persistence, critical_workflows, health (computed)
- **Pipeline**: AUDIT → DIAGNOSE → VERIFY → REPORT → SAFE_FIX
- **Safe fixes**: Only when explicitly authorized via `options.authorizeFixes`
- **Each check** has: name, category, status, latencyMs, details, evidence (with truthLevel + source), metrics
- **DoctorReportV2**: overallStatus, checks[], healthScore (0-100), summary, recommendations[], safeFixes[]
- **SafeFix** records: diagnosis, action, before, after, timestamp, executionId, result
- Methods: `runFullCheck()`, `quickCheck()`, `compareToV1()`

### 2. `/src/lib/security.ts` — SecurityManager
- **Authentication**: token-based sessions with PBKDF2 password hashing (Node.js crypto — no external deps), `hashPassword()`, `verifyPassword()` (constant-time comparison), `generateToken()`, `validateToken()`, `revokeToken()`, `cleanupExpiredSessions()`
- **Authorization**: `validatePermission()`, `validateToolAccess()`, 9 permission rules, 7 tool access rules
- **User Isolation**: `isIsolated()`, `enforceIsolation()` — never access another user's data
- **Input Validation**: `validateInput(input, schema)` with type checking, min/max, patterns
- **Input Sanitization**: `sanitizeInput()` — XSS, SQL injection, null byte, path traversal, unicode normalization
- **Prompt Injection**: `checkPromptInjection()` — 13 detection patterns with severity scoring
- **SSRF Protection**: `checkSSRF()` — blocked hosts, private IP ranges, metadata endpoints, suspicious TLDs
- **Rate Limiting**: `rateLimit(key, limit, windowMs)` — in-memory with TTL, `cleanupRateLimits()`
- **Audit Trail**: `auditLog()` — persisted to AuditEvent table
- **Combined**: `canGenerate()` — permission + credits + rate limit check

### 3. `/src/lib/mcp-server.ts` — KreaMCPServer
- **7 MCP tools** exposed: krea_generate_image, krea_generate_text, krea_generate_voice, krea_generate_ebook, krea_get_metrics, krea_doctor, krea_get_capabilities
- Each tool has: name, description, category, inputSchema, outputSchema, version, creditCost, requiredPlan
- `handleToolCall(toolName, params)` → MCPToolResult with evidence
- `listTools()`, `listToolsByCategory()`, `getTool()`, `getStatus()`, `healthCheck()`
- Handlers dispatch to actual Next.js API routes

### 4. `/src/lib/mcp-client.ts` — KreaMCPClient
- **6 ecosystem agents**: CHISMOSO, NEX-SCOPE, YOUTUBE-AUTOMATION, CRM-ALBRA, AGENTE-LEADS, RADAR-SECOP2
- **Agent capabilities registry** with 17 total tools across agents
- `discoverAgent(agentId)` — live capability discovery
- `requestTool(agentId, toolName, params)` — execute tool on another agent
- `listAvailableAgents()`, `findAgentsByCapability()`, `getToolCost()`, `discoverAll()`, `getEcosystemSummary()`
- All interactions persisted to AgentInteraction table
- Decoupled: uses contracts/API/events, no direct coupling

### 5. `/src/lib/agent-comm.ts` — AgentCommManager
- `sendRequest(target, objective, input, options)` — creates interaction record and dispatches via MCP client
- `handleResponse(interactionId, response)` — validates and updates interaction
- `canDelegate(task)` — checks delegation rules (7 rules for out-of-scope tasks)
- `getDelegationTarget(task)` — determines which agent should handle a task
- `autoDelegate(task, input, options)` — automatic delegation when warranted
- `getHistory()`, `getTimedOutInteractions()`, `cleanupTimedOut()`, `getStats()`
- KREA's own scope protected (never delegates image/text/voice/ebook generation)
- All interactions: traceable, authenticated, validable, auditable, decoupled

## Schema Changes
- Added `Session` model (id, userId, token, expiresAt, createdAt) with User relation
- Pre-existing models used: AgentInteraction, AuditEvent, Memory, Skill, Execution, Feedback

## Verification
- ✅ TypeScript: 0 errors in all new files
- ✅ ESLint: 0 errors in all new files
- ✅ Prisma: Session model accessible via `db.session`
- ✅ All imports resolve to existing modules only (`@/lib/db`, `@/lib/auth`, `@/lib/doctor`, `@/lib/utils`, `z-ai-web-dev-sdk`)
