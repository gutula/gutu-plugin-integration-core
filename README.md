# Integration Core

<p align="center">
  <img src="./docs/assets/gutu-mascot.png" alt="Gutu mascot" width="220" />
</p>

Governed connector definitions, connection authorization, webhook ingress, and MCP-aware integration health.

![Maturity: Hardened](https://img.shields.io/badge/Maturity-Hardened-2563eb) ![Verification: Build+Typecheck+Lint+Test+Contracts+Migrations+Integration](https://img.shields.io/badge/Verification-Build%2BTypecheck%2BLint%2BTest%2BContracts%2BMigrations%2BIntegration-2563eb) ![DB: postgres+sqlite](https://img.shields.io/badge/DB-postgres%2Bsqlite-2563eb) ![Integration Model: Actions+Resources+UI](https://img.shields.io/badge/Integration%20Model-Actions%2BResources%2BUI-6b7280)

## Part Of The Gutu Stack

| Aspect | Value |
| --- | --- |
| Repo kind | First-party plugin |
| Domain group | AI Systems |
| Default category | Integrations / Connectors & Webhooks |
| Primary focus | connectors, webhooks, external-system governance |
| Best when | You need a governed domain boundary with explicit contracts and independent release cadence. |
| Composes through | Actions+Resources+UI |

- Gutu keeps plugins as independent repos with manifest-governed boundaries, compatibility channels, and verification lanes instead of hiding everything behind one giant mutable codebase.
- This plugin is meant to compose through explicit actions, resources, jobs, workflows, and runtime envelopes, not through undocumented hook chains.

## What It Does Now

Provides the governed connector and webhook foundation used by higher-level runtimes to interact with external systems safely.

- Exports 3 governed actions: `integrations.connectors.register`, `integrations.connections.authorize`, `integrations.webhooks.rotate-secret`.
- Owns 3 resource contracts: `integrations.connectors`, `integrations.connections`, `integrations.webhooks`.
- Adds richer admin workspace contributions on top of the base UI surface.
- Defines a durable data schema contract even though no explicit SQL helper module is exported.

## Maturity

**Maturity Tier:** `Hardened`

This tier is justified because unit coverage exists, contract coverage exists, integration coverage exists, and migration coverage exists.

## Verified Capability Summary

- Domain group: **AI Systems**
- Default category: **Integrations / Connectors & Webhooks**
- Verification surface: **Build+Typecheck+Lint+Test+Contracts+Migrations+Integration**
- Tests discovered: **6** total files across unit, contract, integration, migration lanes
- Integration model: **Actions+Resources+UI**
- Database support: **postgres + sqlite**

## Dependency And Compatibility Summary

| Field | Value |
| --- | --- |
| Package | `@plugins/integration-core` |
| Manifest ID | `integration-core` |
| Repo | [gutu-plugin-integration-core](https://github.com/gutula/gutu-plugin-integration-core) |
| Depends On | `auth-core`, `org-tenant-core`, `role-policy-core`, `audit-core` |
| Requested Capabilities | `ui.register.admin`, `api.rest.mount`, `data.write.integrations` |
| Provided Capabilities | `integrations.connectors`, `integrations.connections`, `integrations.webhooks` |
| Runtime | bun>=1.3.12 |
| Database | postgres, sqlite |
| Integration Model | Actions+Resources+UI |

## Capability Matrix

| Surface | Count | Details |
| --- | --- | --- |
| Actions | 3 | `integrations.connectors.register`, `integrations.connections.authorize`, `integrations.webhooks.rotate-secret` |
| Resources | 3 | `integrations.connectors`, `integrations.connections`, `integrations.webhooks` |
| Jobs | 0 | No job catalog exported |
| Workflows | 0 | No workflow catalog exported |
| UI | Present | base UI surface, admin contributions |
| Owned Entities | 0 | No explicit domain catalog yet |
| Reports | 0 | No explicit report catalog yet |
| Exception Queues | 0 | No explicit exception queues yet |
| Operational Scenarios | 0 | No explicit operational scenario matrix yet |
| Settings Surfaces | 0 | No explicit settings surface catalog yet |
| ERPNext Refs | 0 | No direct ERPNext reference mapping declared |

## Quick Start For Integrators

Use this repo inside a **compatible Gutu workspace** or the **ecosystem certification workspace** so its `workspace:*` dependencies resolve honestly.

```bash
# from a compatible workspace that already includes this plugin's dependency graph
bun install
bun run build
bun run test
bun run docs:check
```

```ts
import { manifest, registerConnectorAction, ConnectorResource, adminContributions, uiSurface } from "@plugins/integration-core";

console.log(manifest.id);
console.log(registerConnectorAction.id);
console.log(ConnectorResource.id);
```

Use the root repo scripts for day-to-day work **after the workspace is bootstrapped**, or run the nested package directly from `framework/builtin-plugins/integration-core` if you need lower-level control.

## Current Test Coverage

- Root verification scripts: `bun run build`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:contracts`, `bun run test:integration`, `bun run test:migrations`, `bun run test:unit`, `bun run docs:check`
- Unit files: 2
- Contracts files: 2
- Integration files: 1
- Migrations files: 1

## Known Boundaries And Non-Goals

- Not an everything-and-the-kitchen-sink provider abstraction layer.
- Not a substitute for explicit approval, budgeting, and audit governance in the surrounding platform.
- Cross-plugin composition should use Gutu command, event, job, and workflow primitives. This repo should not be documented as exposing a generic WordPress-style hook system unless one is explicitly exported.

## Recommended Next Milestones

- Broaden connector depth only where the current webhook, secret, and governance contracts have already stabilized.
- Add stronger operator diagnostics for connector health, credential drift, and replay scenarios as usage expands.
- Add deeper provider, persistence, or evaluation integrations only where the shipped control-plane contracts already prove stable.
- Expand operator diagnostics and release gating where the current lifecycle already exposes strong evidence paths.
- Promote important downstream reactions into explicit commands, jobs, or workflow steps instead of relying on implicit coupling.

## More Docs

See [DEVELOPER.md](./DEVELOPER.md), [TODO.md](./TODO.md), [SECURITY.md](./SECURITY.md), [CONTRIBUTING.md](./CONTRIBUTING.md). The internal domain sources used to build those docs live under:

- `plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/docs/AGENT_CONTEXT.md`
- `plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/docs/BUSINESS_RULES.md`
- `plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/docs/EDGE_CASES.md`
- `plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/docs/FLOWS.md`
- `plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/docs/GLOSSARY.md`
- `plugins/gutu-plugin-integration-core/framework/builtin-plugins/integration-core/docs/MANDATORY_STEPS.md`
