# Business Rules

- Connectors must declare transport, host allowlists, tool filters, schema cache TTL, and approval posture.
- Connections must record environment scope and whether only signed packages may use them.
- Webhook rotation must emit a new secret reference instead of mutating secrets in place.
