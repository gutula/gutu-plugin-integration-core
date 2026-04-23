# Integration Core TODO

**Maturity Tier:** `Hardened`

## Shipped Now

- Exports 3 governed actions: `integrations.connectors.register`, `integrations.connections.authorize`, `integrations.webhooks.rotate-secret`.
- Owns 3 resource contracts: `integrations.connectors`, `integrations.connections`, `integrations.webhooks`.
- Adds richer admin workspace contributions on top of the base UI surface.
- Defines a durable data schema contract even though no explicit SQL helper module is exported.

## Current Gaps

- No standalone plugin-owned event, job, or workflow catalog is exported yet; compose it through actions, resources, and the surrounding Gutu runtime.
- The repo does not yet export a domain parity catalog with owned entities, reports, settings surfaces, and exception queues.

## Recommended Next

- Broaden connector depth only where the current webhook, secret, and governance contracts have already stabilized.
- Add stronger operator diagnostics for connector health, credential drift, and replay scenarios as usage expands.
- Add deeper provider, persistence, or evaluation integrations only where the shipped control-plane contracts already prove stable.
- Expand operator diagnostics and release gating where the current lifecycle already exposes strong evidence paths.
- Promote important downstream reactions into explicit commands, jobs, or workflow steps instead of relying on implicit coupling.

## Later / Optional

- More connector breadth, richer evaluation libraries, and domain-specific copilots after the baseline contracts settle.
