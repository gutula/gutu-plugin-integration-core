# Integration Core

<p align="center">
  <img src="./docs/assets/gutu-mascot.png" alt="Gutu mascot" width="220" />
</p>

Governed connector definitions, connection authorization, webhook ingress, and MCP-aware integration health for the Gutu control plane.

![Maturity: Hardened](https://img.shields.io/badge/Maturity-Hardened-0f766e) ![Verification: Docs+Build+Typecheck+Lint+Test+Contracts+Integration+Migrations](https://img.shields.io/badge/Verification-Docs%2BBuild%2BTypecheck%2BLint%2BTest%2BContracts%2BIntegration%2BMigrations-6b7280) ![DB: postgres+sqlite](https://img.shields.io/badge/DB-postgres%2Bsqlite-2563eb) ![Integration Model: Actions+Resources+Builders+UI](https://img.shields.io/badge/Integration%20Model-Actions%2BResources%2BBuilders%2BUI-6b7280)

**Maturity Tier:** `Hardened`

## Part Of The Gutu Stack

| Aspect | Value |
| --- | --- |
| Repo kind | First-party plugin |
| Domain group | AI Systems |
| Primary focus | connectors, authorizations, webhook ingress, integration health |
| Best when | You want MCP/app style integration flexibility with explicit policy, secrets, and audit boundaries. |
| Composes through | Actions+Resources+Builders+UI |

- `integration-core` is the governed connector plane that lets the AI stack talk to external systems without turning connectors into hidden runtime side effects.
- It complements `@platform/ai-mcp` by owning connector records and operator-facing lifecycle state.

## What It Does Now

- Exports 3 governed actions: `integrations.connectors.register`, `integrations.connections.authorize`, `integrations.webhooks.rotate-secret`.
- Owns 3 public resources: `integrations.connectors`, `integrations.connections`, `integrations.webhooks`.
- Adds an `integrations` workspace and an `integration-builder` in the admin `tools` workspace.
- Persists connector transport, auth posture, health, and webhook-secret lifecycle state.
- Provides the connector control surface consumed by Company Builder, RAG pipelines, and future app/runtime flows.

## Maturity

`integration-core` is `Hardened` because the connector surface is now typed, policy-aware, migration-covered, and visible in operator UI rather than remaining an implicit runtime descriptor layer.

## Verified Capability Summary

- Group: **AI Systems**
- Verification surface: **Docs+Build+Typecheck+Lint+Test+Contracts+Integration+Migrations**
- Tests discovered: **6** files across unit, contract, integration, and migration lanes
- Integration model: **Actions+Resources+Builders+UI**
- Database support: **postgres + sqlite**

## Dependency And Compatibility Summary

| Field | Value |
| --- | --- |
| Package | `@plugins/integration-core` |
| Manifest ID | `integration-core` |
| Repo | `gutu-plugin-integration-core` |
| Depends On | `auth-core`, `org-tenant-core`, `role-policy-core`, `audit-core` |
| Requested Capabilities | `ui.register.admin`, `api.rest.mount`, `data.write.integrations` |
| Provided Capabilities | `integrations.connectors`, `integrations.connections`, `integrations.webhooks` |
| Runtime | bun>=1.3.12 |
| Database | postgres, sqlite |
| Integration Model | Actions+Resources+Builders+UI |

## Capability Matrix

| Surface | Count | Details |
| --- | --- | --- |
| Actions | 3 | `integrations.connectors.register`, `integrations.connections.authorize`, `integrations.webhooks.rotate-secret` |
| Resources | 3 | `integrations.connectors`, `integrations.connections`, `integrations.webhooks` |
| Builders | 1 | `integration-builder` |
| Workspaces | 1 | `integrations` |
| UI | Present | connector overview, builder, admin commands |

## Quick Start For Integrators

Use this repo inside a compatible Gutu workspace so its `workspace:*` dependencies resolve truthfully.

```bash
bun install
bun run build
bun run test
bun run docs:check
```

```ts
import {
  manifest,
  registerConnectorAction,
  authorizeConnectionAction,
  ConnectorResource,
  WebhookResource
} from "@plugins/integration-core";

console.log(manifest.id);
console.log(registerConnectorAction.id);
console.log(authorizeConnectionAction.id);
console.log(ConnectorResource.id, WebhookResource.id);
```

## Current Test Coverage

- Root verification scripts: `bun run build`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:contracts`, `bun run test:integration`, `bun run test:migrations`, `bun run test:unit`, `bun run docs:check`
- Unit files: 2
- Contracts files: 2
- Integration files: 1
- Migrations files: 1

## Known Boundaries And Non-Goals

- This plugin owns connector and connection control state, not the full network transport client implementation.
- Secret storage is still modeled inside the local governed state surface, not an external vault adapter.
- Browser/code execution environments remain in `execution-workspaces-core`.

## Recommended Next Milestones

- Add dedicated secret-vault adapters and envelope encryption contracts.
- Expand connector rollout, disable, and quarantine flows.
- Add webhook delivery logs and signature replay debugging.
- Extend the MCP runtime bridge with richer per-tool approval policy.

## More Docs

See [DEVELOPER.md](./DEVELOPER.md), [TODO.md](./TODO.md), [SECURITY.md](./SECURITY.md), and [CONTRIBUTING.md](./CONTRIBUTING.md).
