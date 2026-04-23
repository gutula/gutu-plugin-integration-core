# Integration Core Developer Guide

Governed connector definitions, connection authorization, webhook ingress, and MCP-aware integration health.

**Maturity Tier:** `Hardened`

## Purpose And Architecture Role

Provides the governed connector and webhook foundation used by higher-level runtimes to interact with external systems safely.

### This plugin is the right fit when

- You need **connectors**, **webhooks**, **external-system governance** as a governed domain boundary.
- You want to integrate through declared actions, resources, jobs, workflows, and UI surfaces instead of implicit side effects.
- You need the host application to keep plugin boundaries honest through manifest capabilities, permissions, and verification lanes.

### This plugin is intentionally not

- Not an everything-and-the-kitchen-sink provider abstraction layer.
- Not a substitute for explicit approval, budgeting, and audit governance in the surrounding platform.

## Repo Map

| Path | Purpose |
| --- | --- |
| `package.json` | Root extracted-repo manifest, workspace wiring, and repo-level script entrypoints. |
| `framework/builtin-plugins/integration-core` | Nested publishable plugin package. |
| `framework/builtin-plugins/integration-core/src` | Runtime source, actions, resources, services, and UI exports. |
| `framework/builtin-plugins/integration-core/tests` | Unit, contract, integration, and migration coverage where present. |
| `framework/builtin-plugins/integration-core/docs` | Internal domain-doc source set kept in sync with this guide. |
| `framework/builtin-plugins/integration-core/db/schema.ts` | Database schema contract when durable state is owned. |
| `framework/builtin-plugins/integration-core/src/postgres.ts` | SQL migration and rollback helpers when exported. |

## Manifest Contract

| Field | Value |
| --- | --- |
| Package Name | `@plugins/integration-core` |
| Manifest ID | `integration-core` |
| Display Name | Integration Core |
| Domain Group | AI Systems |
| Default Category | Integrations / Connectors & Webhooks |
| Version | `0.1.0` |
| Kind | `plugin` |
| Trust Tier | `first-party` |
| Review Tier | `R1` |
| Isolation Profile | `same-process-trusted` |
| Framework Compatibility | ^0.1.0 |
| Runtime Compatibility | bun>=1.3.12 |
| Database Compatibility | postgres, sqlite |

## Dependency Graph And Capability Requests

| Field | Value |
| --- | --- |
| Depends On | `auth-core`, `org-tenant-core`, `role-policy-core`, `audit-core` |
| Requested Capabilities | `ui.register.admin`, `api.rest.mount`, `data.write.integrations` |
| Provides Capabilities | `integrations.connectors`, `integrations.connections`, `integrations.webhooks` |
| Owns Data | `integrations.connectors`, `integrations.connections`, `integrations.webhooks` |

### Dependency interpretation

- Direct plugin dependencies describe package-level coupling that must already be present in the host graph.
- Requested capabilities tell the host what platform services or sibling plugins this package expects to find.
- Provided capabilities and owned data tell integrators what this package is authoritative for.

## Public Integration Surfaces

| Type | ID / Symbol | Access / Mode | Notes |
| --- | --- | --- | --- |
| Action | `integrations.connectors.register` | Permission: `integrations.connectors.register` | Idempotent<br>Audited |
| Action | `integrations.connections.authorize` | Permission: `integrations.connections.authorize` | Idempotent<br>Audited |
| Action | `integrations.webhooks.rotate-secret` | Permission: `integrations.webhooks.rotate-secret` | Non-idempotent<br>Audited |
| Resource | `integrations.connectors` | Portal disabled | Governed connector definitions for MCP, apps, and external services.<br>Purpose: Track transport, host allowlists, tool filters, approval posture, and health for integrations.<br>Admin auto-CRUD enabled<br>Fields: `label`, `transport`, `toolFilterMode`, `approvalPolicy`, `healthStatus`, `updatedAt` |
| Resource | `integrations.connections` | Portal disabled | Authorized integration connections and secrets posture.<br>Purpose: Track authorization state, environment scope, and signed-package policy for live connections.<br>Admin auto-CRUD enabled<br>Fields: `connectorId`, `label`, `authType`, `status`, `environmentScope`, `updatedAt` |
| Resource | `integrations.webhooks` | Portal disabled | Webhook ingress routes and rotated signing secrets.<br>Purpose: Expose webhook listener posture, signing secret rotation, and listener fan-out.<br>Admin auto-CRUD enabled<br>Fields: `connectorId`, `route`, `status`, `listenerCount`, `lastRotatedAt` |





### UI Surface Summary

| Surface | Present | Notes |
| --- | --- | --- |
| UI Surface | Yes | A bounded UI surface export is present. |
| Admin Contributions | Yes | Additional admin workspace contributions are exported. |
| Zone/Canvas Extension | No | No dedicated zone extension export. |

## Hooks, Events, And Orchestration

This plugin should be integrated through **explicit commands/actions, resources, jobs, workflows, and the surrounding Gutu event runtime**. It must **not** be documented as a generic WordPress-style hook system unless such a hook API is explicitly exported.

- No standalone plugin-owned lifecycle event feed is exported today.
- No plugin-owned job catalog is exported today.
- No plugin-owned workflow catalog is exported today.
- Recommended composition pattern: invoke actions, read resources, then let the surrounding Gutu command/event/job runtime handle downstream automation.

## Storage, Schema, And Migration Notes

- Database compatibility: `postgres`, `sqlite`
- Schema file: `framework/builtin-plugins/integration-core/db/schema.ts`
- SQL helper file: `framework/builtin-plugins/integration-core/src/postgres.ts`
- Migration lane present: Yes

The plugin does not export a dedicated SQL helper module today. Treat the schema and resources as the durable contract instead of inventing undocumented SQL behavior.

## Failure Modes And Recovery

- Action inputs can fail schema validation or permission evaluation before any durable mutation happens.
- If downstream automation is needed, the host must add it explicitly instead of assuming this plugin emits jobs.
- There is no separate lifecycle-event feed to rely on today; do not build one implicitly from internal details.
- Schema regressions are expected to show up in the migration lane and should block shipment.

## Mermaid Flows

### Primary Lifecycle

```mermaid
flowchart LR
  caller["Host or operator"] --> action["integrations.connectors.register"]
  action --> validation["Schema + permission guard"]
  validation --> service["Integration Core service layer"]
  service --> state["integrations.connectors"]
  state --> ui["Admin contributions"]
```



## Integration Recipes

### 1. Host wiring

```ts
import { manifest, registerConnectorAction, ConnectorResource, adminContributions, uiSurface } from "@plugins/integration-core";

export const pluginSurface = {
  manifest,
  registerConnectorAction,
  ConnectorResource,
  
  
  adminContributions,
  uiSurface
};
```

Use this pattern when your host needs to register the plugin’s declared exports without reaching into internal file paths.

### 2. Action-first orchestration

```ts
import { manifest, registerConnectorAction } from "@plugins/integration-core";

console.log("plugin", manifest.id);
console.log("action", registerConnectorAction.id);
```

- Prefer action IDs as the stable integration boundary.
- Respect the declared permission, idempotency, and audit metadata instead of bypassing the service layer.
- Treat resource IDs as the read-model boundary for downstream consumers.

### 3. Cross-plugin composition

- Compose this plugin through action invocations and resource reads.
- If downstream automation becomes necessary, add it in the surrounding Gutu command/event/job runtime instead of assuming this plugin already exports a hook surface.

## Test Matrix

| Lane | Present | Evidence |
| --- | --- | --- |
| Build | Yes | `bun run build` |
| Typecheck | Yes | `bun run typecheck` |
| Lint | Yes | `bun run lint` |
| Test | Yes | `bun run test` |
| Unit | Yes | 2 file(s) |
| Contracts | Yes | 2 file(s) |
| Integration | Yes | 1 file(s) |
| Migrations | Yes | 1 file(s) |

### Verification commands

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run test:contracts`
- `bun run test:integration`
- `bun run test:migrations`
- `bun run test:unit`
- `bun run docs:check`

## Current Truth And Recommended Next

### Current truth

- Exports 3 governed actions: `integrations.connectors.register`, `integrations.connections.authorize`, `integrations.webhooks.rotate-secret`.
- Owns 3 resource contracts: `integrations.connectors`, `integrations.connections`, `integrations.webhooks`.
- Adds richer admin workspace contributions on top of the base UI surface.
- Defines a durable data schema contract even though no explicit SQL helper module is exported.

### Current gaps

- No standalone plugin-owned event, job, or workflow catalog is exported yet; compose it through actions, resources, and the surrounding Gutu runtime.
- The repo does not yet export a domain parity catalog with owned entities, reports, settings surfaces, and exception queues.

### Recommended next

- Broaden connector depth only where the current webhook, secret, and governance contracts have already stabilized.
- Add stronger operator diagnostics for connector health, credential drift, and replay scenarios as usage expands.
- Add deeper provider, persistence, or evaluation integrations only where the shipped control-plane contracts already prove stable.
- Expand operator diagnostics and release gating where the current lifecycle already exposes strong evidence paths.
- Promote important downstream reactions into explicit commands, jobs, or workflow steps instead of relying on implicit coupling.

### Later / optional

- More connector breadth, richer evaluation libraries, and domain-specific copilots after the baseline contracts settle.
