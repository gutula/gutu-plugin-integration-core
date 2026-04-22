import { definePolicy } from "@platform/permissions";

export const integrationPolicy = definePolicy({
  id: "integration-core.default",
  rules: [
    {
      permission: "integrations.connectors.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    },
    {
      permission: "integrations.connectors.register",
      allowIf: ["role:admin", "role:operator"],
      requireReason: true,
      audit: true
    },
    {
      permission: "integrations.connections.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    },
    {
      permission: "integrations.connections.authorize",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    },
    {
      permission: "integrations.webhooks.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    },
    {
      permission: "integrations.webhooks.rotate-secret",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    },
    {
      permission: "integrations.builders.use",
      allowIf: ["role:admin", "role:operator"]
    }
  ]
});
