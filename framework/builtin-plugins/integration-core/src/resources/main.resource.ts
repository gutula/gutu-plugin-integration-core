import { defineResource } from "@platform/schema";
import { z } from "zod";

import { integrationConnections, integrationConnectors, integrationWebhooks } from "../../db/schema";

export const ConnectorResource = defineResource({
  id: "integrations.connectors",
  description: "Governed connector definitions for MCP, apps, and external services.",
  businessPurpose: "Track transport, host allowlists, tool filters, approval posture, and health for integrations.",
  table: integrationConnectors,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2),
    label: z.string().min(2),
    transport: z.enum(["stdio", "sse", "streamable-http"]),
    endpoint: z.string().min(2),
    toolFilterMode: z.enum(["allowlist", "denylist", "all"]),
    schemaCacheTtlMinutes: z.number().int().positive(),
    approvalPolicy: z.enum(["none", "required", "conditional"]),
    healthStatus: z.enum(["ready", "degraded", "blocked"]),
    updatedAt: z.string()
  }),
  fields: {
    label: { searchable: true, sortable: true, label: "Connector" },
    transport: { filter: "select", label: "Transport" },
    toolFilterMode: { filter: "select", label: "Tool Filter" },
    approvalPolicy: { filter: "select", label: "Approval" },
    healthStatus: { filter: "select", label: "Health" },
    updatedAt: { sortable: true, label: "Updated" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["label", "transport", "toolFilterMode", "approvalPolicy", "healthStatus", "updatedAt"]
  },
  portal: { enabled: false },
  ai: {
    curatedReadModel: true,
    purpose: "Connector registry for governed MCP, app, and webhook orchestration.",
    citationLabelField: "label",
    allowedFields: ["label", "transport", "endpoint", "toolFilterMode", "approvalPolicy", "healthStatus", "updatedAt"]
  }
});

export const ConnectionResource = defineResource({
  id: "integrations.connections",
  description: "Authorized integration connections and secrets posture.",
  businessPurpose: "Track authorization state, environment scope, and signed-package policy for live connections.",
  table: integrationConnections,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2),
    connectorId: z.string().min(2),
    label: z.string().min(2),
    authType: z.enum(["api-key", "oauth", "service-account"]),
    secretRef: z.string().min(2),
    status: z.enum(["authorized", "pending", "revoked"]),
    environmentScope: z.enum(["dev", "staging", "prod"]),
    signedPackageOnly: z.string(),
    updatedAt: z.string()
  }),
  fields: {
    connectorId: { searchable: true, sortable: true, label: "Connector" },
    label: { searchable: true, sortable: true, label: "Connection" },
    authType: { filter: "select", label: "Auth Type" },
    status: { filter: "select", label: "Status" },
    environmentScope: { filter: "select", label: "Scope" },
    updatedAt: { sortable: true, label: "Updated" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["connectorId", "label", "authType", "status", "environmentScope", "updatedAt"]
  },
  portal: { enabled: false }
});

export const WebhookResource = defineResource({
  id: "integrations.webhooks",
  description: "Webhook ingress routes and rotated signing secrets.",
  businessPurpose: "Expose webhook listener posture, signing secret rotation, and listener fan-out.",
  table: integrationWebhooks,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2),
    connectorId: z.string().min(2),
    route: z.string().min(2),
    signingSecretRef: z.string().min(2),
    status: z.enum(["active", "rotated", "disabled"]),
    listenerCount: z.number().int().nonnegative(),
    lastRotatedAt: z.string().nullable()
  }),
  fields: {
    connectorId: { searchable: true, sortable: true, label: "Connector" },
    route: { searchable: true, sortable: true, label: "Route" },
    status: { filter: "select", label: "Status" },
    listenerCount: { sortable: true, filter: "number", label: "Listeners" },
    lastRotatedAt: { sortable: true, label: "Last Rotated" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["connectorId", "route", "status", "listenerCount", "lastRotatedAt"]
  },
  portal: { enabled: false }
});

export const integrationResources = [ConnectorResource, ConnectionResource, WebhookResource] as const;
