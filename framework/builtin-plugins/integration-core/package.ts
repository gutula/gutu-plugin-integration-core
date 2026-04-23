import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "integration-core",
  kind: "plugin",
  version: "0.1.0",
  displayName: "Integration Core",
  defaultCategory: {
    id: "integrations",
    label: "Integrations",
    subcategoryId: "connectors_webhooks",
    subcategoryLabel: "Connectors & Webhooks"
  },
  description: "Governed connector definitions, connection authorization, webhook ingress, and MCP-aware integration health.",
  extends: [],
  dependsOn: [
    "auth-core",
    "org-tenant-core",
    "role-policy-core",
    "audit-core"
  ],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["integrations.connectors", "integrations.connections", "integrations.webhooks"],
  requestedCapabilities: [
    "ui.register.admin",
    "api.rest.mount",
    "data.write.integrations"
  ],
  ownsData: ["integrations.connectors", "integrations.connections", "integrations.webhooks"],
  extendsData: [],
  slotClaims: [],
  trustTier: "first-party",
  reviewTier: "R1",
  isolationProfile: "same-process-trusted",
  compatibility: {
    framework: "^0.1.0",
    runtime: "bun>=1.3.12",
    db: ["postgres", "sqlite"]
  }
});
