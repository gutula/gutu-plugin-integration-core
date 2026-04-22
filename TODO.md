# Integration Core TODO

**Maturity Tier:** `Hardened`

## Shipped Now

- Added durable connector, connection, and webhook resources.
- Added connector registration, authorization, and webhook-secret rotation actions.
- Added the `integrations` workspace and `integration-builder`.
- Added integration and migration tests for connector lifecycle and health visibility.

## Current Gaps

- Secret storage is still local-governed state rather than a real vault adapter.
- Connector quarantine and disable flows are not first-class yet.
- Webhook delivery tracing can go deeper.

## Recommended Next

- Add vault-backed secret providers and envelope encryption contracts.
- Add connector quarantine, disable, and recovery workflows.
- Add webhook replay inspection and signature-verification diagnostics.
- Extend the MCP bridge with richer per-tool approval and host policy.

## Later / Optional

- Marketplace-style connector templates once signed package delivery stabilizes.
- Remote connector agents when out-of-process runtime delegation lands.
