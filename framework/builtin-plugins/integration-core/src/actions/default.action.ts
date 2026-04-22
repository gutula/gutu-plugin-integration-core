import { defineAction } from "@platform/schema";
import { z } from "zod";

import { authorizeConnection, registerConnector, rotateWebhookSecret } from "../services/main.service";

export const registerConnectorAction = defineAction({
  id: "integrations.connectors.register",
  input: z.object({
    tenantId: z.string().min(2),
    actorId: z.string().min(2),
    connectorId: z.string().min(2),
    label: z.string().min(2),
    transport: z.enum(["stdio", "sse", "streamable-http"]),
    endpoint: z.string().min(2),
    connectionMode: z.enum(["on-demand", "persistent"]),
    hostAllowlist: z.array(z.string().min(1)).min(1),
    toolFilterMode: z.enum(["allowlist", "denylist", "all"]),
    allowedToolIds: z.array(z.string().min(2)).optional(),
    deniedToolIds: z.array(z.string().min(2)).optional(),
    schemaCacheTtlMinutes: z.number().int().positive(),
    approvalPolicy: z.enum(["none", "required", "conditional"]),
    serverIds: z.array(z.string().min(2)).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    connectorId: z.string(),
    healthStatus: z.enum(["ready", "degraded", "blocked"])
  }),
  permission: "integrations.connectors.register",
  idempotent: true,
  audit: true,
  handler: ({ input }) => registerConnector(input)
});

export const authorizeConnectionAction = defineAction({
  id: "integrations.connections.authorize",
  input: z.object({
    tenantId: z.string().min(2),
    actorId: z.string().min(2),
    connectionId: z.string().min(2),
    connectorId: z.string().min(2),
    label: z.string().min(2),
    authType: z.enum(["api-key", "oauth", "service-account"]),
    secretRef: z.string().min(2),
    scopes: z.array(z.string().min(2)).min(1),
    environmentScope: z.enum(["dev", "staging", "prod"]),
    signedPackageOnly: z.boolean()
  }),
  output: z.object({
    ok: z.literal(true),
    connectionId: z.string(),
    status: z.literal("authorized")
  }),
  permission: "integrations.connections.authorize",
  idempotent: true,
  audit: true,
  handler: ({ input }) => authorizeConnection(input)
});

export const rotateWebhookSecretAction = defineAction({
  id: "integrations.webhooks.rotate-secret",
  input: z.object({
    tenantId: z.string().min(2),
    actorId: z.string().min(2),
    webhookId: z.string().min(2),
    connectorId: z.string().min(2),
    route: z.string().min(2),
    listeners: z.array(z.string().min(2)).min(1)
  }),
  output: z.object({
    ok: z.literal(true),
    webhookId: z.string(),
    signingSecretRef: z.string()
  }),
  permission: "integrations.webhooks.rotate-secret",
  idempotent: false,
  audit: true,
  handler: ({ input }) => rotateWebhookSecret(input)
});

export const integrationActions = [registerConnectorAction, authorizeConnectionAction, rotateWebhookSecretAction] as const;
