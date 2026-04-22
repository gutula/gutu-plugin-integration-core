import {
  createMcpRuntimeOrchestrator,
  createSchemaCacheEntry,
  evaluateConnectorHealth,
  planMcpConnection,
  type McpClientConnector
} from "@platform/ai-mcp";
import { normalizeActionInput } from "@platform/schema";
import { loadJsonState, updateJsonState } from "@platform/ai-runtime";

export type IntegrationConnectorRecord = {
  id: string;
  tenantId: string;
  label: string;
  transport: "stdio" | "sse" | "streamable-http";
  endpoint: string;
  connectionMode: "on-demand" | "persistent";
  hostAllowlist: string[];
  toolFilterMode: "allowlist" | "denylist" | "all";
  allowedToolIds: string[];
  deniedToolIds: string[];
  schemaCacheTtlMinutes: number;
  approvalPolicy: "none" | "required" | "conditional";
  healthStatus: "ready" | "degraded" | "blocked";
  serverIds: string[];
  updatedAt: string;
};

export type IntegrationConnectionRecord = {
  id: string;
  tenantId: string;
  connectorId: string;
  label: string;
  authType: "api-key" | "oauth" | "service-account";
  secretRef: string;
  status: "authorized" | "pending" | "revoked";
  scopes: string[];
  approvedBy: string | null;
  environmentScope: "dev" | "staging" | "prod";
  signedPackageOnly: boolean;
  updatedAt: string;
};

export type IntegrationWebhookRecord = {
  id: string;
  tenantId: string;
  connectorId: string;
  route: string;
  signingSecretRef: string;
  status: "active" | "rotated" | "disabled";
  listeners: string[];
  lastRotatedAt: string | null;
};

type IntegrationState = {
  connectors: IntegrationConnectorRecord[];
  connections: IntegrationConnectionRecord[];
  webhooks: IntegrationWebhookRecord[];
};

export type RegisterConnectorInput = {
  tenantId: string;
  actorId: string;
  connectorId: string;
  label: string;
  transport: IntegrationConnectorRecord["transport"];
  endpoint: string;
  connectionMode: IntegrationConnectorRecord["connectionMode"];
  hostAllowlist: string[];
  toolFilterMode: IntegrationConnectorRecord["toolFilterMode"];
  allowedToolIds?: string[] | undefined;
  deniedToolIds?: string[] | undefined;
  schemaCacheTtlMinutes: number;
  approvalPolicy: IntegrationConnectorRecord["approvalPolicy"];
  serverIds?: string[] | undefined;
};

export type AuthorizeConnectionInput = {
  tenantId: string;
  actorId: string;
  connectionId: string;
  connectorId: string;
  label: string;
  authType: IntegrationConnectionRecord["authType"];
  secretRef: string;
  scopes: string[];
  environmentScope: IntegrationConnectionRecord["environmentScope"];
  signedPackageOnly: boolean;
};

export type RotateWebhookSecretInput = {
  tenantId: string;
  actorId: string;
  webhookId: string;
  connectorId: string;
  route: string;
  listeners: string[];
};

const integrationStateFile = "integration-core.json";

function seedIntegrationState(): IntegrationState {
  return normalizeIntegrationState({
    connectors: [
      {
        id: "connector:crm",
        tenantId: "tenant-platform",
        label: "CRM Connector",
        transport: "streamable-http",
        endpoint: "https://crm.example.com/mcp",
        connectionMode: "on-demand",
        hostAllowlist: ["crm.example.com"],
        toolFilterMode: "allowlist",
        allowedToolIds: ["crm.contacts.lookup", "crm.accounts.read"],
        deniedToolIds: ["crm.accounts.delete"],
        schemaCacheTtlMinutes: 30,
        approvalPolicy: "required",
        healthStatus: "ready",
        serverIds: ["crm-server"],
        updatedAt: "2026-04-22T12:20:00.000Z"
      }
    ],
    connections: [
      {
        id: "connection:crm-prod",
        tenantId: "tenant-platform",
        connectorId: "connector:crm",
        label: "CRM Production",
        authType: "oauth",
        secretRef: "secret://crm/oauth",
        status: "authorized",
        scopes: ["contacts.read", "accounts.read"],
        approvedBy: "actor-admin",
        environmentScope: "prod",
        signedPackageOnly: true,
        updatedAt: "2026-04-22T12:21:00.000Z"
      }
    ],
    webhooks: [
      {
        id: "webhook:crm-events",
        tenantId: "tenant-platform",
        connectorId: "connector:crm",
        route: "/api/integrations/crm/events",
        signingSecretRef: "secret://crm/webhook",
        status: "active",
        listeners: ["listener:crm-sync"],
        lastRotatedAt: "2026-04-22T12:22:00.000Z"
      }
    ]
  });
}

function loadIntegrationState(): IntegrationState {
  return normalizeIntegrationState(loadJsonState(integrationStateFile, seedIntegrationState));
}

function persistIntegrationState(updater: (state: IntegrationState) => IntegrationState): IntegrationState {
  return normalizeIntegrationState(updateJsonState(integrationStateFile, seedIntegrationState, updater));
}

export function listConnectors(): IntegrationConnectorRecord[] {
  return loadIntegrationState().connectors.sort((left, right) => left.label.localeCompare(right.label));
}

export function listConnections(): IntegrationConnectionRecord[] {
  return loadIntegrationState().connections.sort((left, right) => left.label.localeCompare(right.label));
}

export function listWebhooks(): IntegrationWebhookRecord[] {
  return loadIntegrationState().webhooks.sort((left, right) => left.route.localeCompare(right.route));
}

export function getIntegrationOverview() {
  const state = loadIntegrationState();
  const orchestrator = createMcpRuntimeOrchestrator({
    connectors: state.connectors.map(toMcpConnector),
    servers: [
      {
        id: "crm-server",
        label: "CRM Server",
        tools: [
          {
            id: "crm.contacts.lookup",
            title: "Lookup contact",
            description: "Lookup CRM contact",
            permission: "crm.contacts.lookup",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            riskLevel: "low",
            approvalMode: "none"
          }
        ],
        resources: [],
        prompts: []
      }
    ]
  });

  return {
    totals: {
      connectors: state.connectors.length,
      connections: state.connections.length,
      webhooks: state.webhooks.length
    },
    visibleTools: orchestrator.listVisibleTools("crm.example.com", true).map((tool) => tool.id)
  };
}

export function registerConnector(input: RegisterConnectorInput) {
  normalizeActionInput(input);
  const plan = planMcpConnection(
    {
      id: input.connectorId,
      label: input.label,
      endpoint: input.endpoint,
      transport: input.transport,
      connectionMode: input.connectionMode,
      hostAllowlist: input.hostAllowlist,
      trustTier: "first-party",
      requiresApproval: input.approvalPolicy !== "none",
      allowedToolIds: input.allowedToolIds,
      deniedToolIds: input.deniedToolIds,
      schemaCacheTtlMinutes: input.schemaCacheTtlMinutes,
      serverIds: input.serverIds
    },
    input.hostAllowlist[0] ?? "*",
    input.approvalPolicy === "none"
  );
  const schemaCache = createSchemaCacheEntry({
    connectorId: input.connectorId,
    serverId: input.serverIds?.[0] ?? "connector-runtime",
    tools: [],
    ttlMinutes: input.schemaCacheTtlMinutes
  });
  const health = evaluateConnectorHealth({
    connector: {
      id: input.connectorId,
      label: input.label,
      endpoint: input.endpoint,
      transport: input.transport,
      connectionMode: input.connectionMode,
      hostAllowlist: input.hostAllowlist,
      trustTier: "first-party",
      requiresApproval: input.approvalPolicy !== "none",
      allowedToolIds: input.allowedToolIds,
      deniedToolIds: input.deniedToolIds
    },
    targetHost: input.hostAllowlist[0] ?? "*",
    approvalGranted: plan.approved,
    schemaCache
  });

  persistIntegrationState((state) => ({
    ...state,
    connectors: upsertById(state.connectors, {
      id: input.connectorId,
      tenantId: input.tenantId,
      label: input.label,
      transport: input.transport,
      endpoint: input.endpoint,
      connectionMode: input.connectionMode,
      hostAllowlist: [...new Set(input.hostAllowlist)].sort((left, right) => left.localeCompare(right)),
      toolFilterMode: input.toolFilterMode,
      allowedToolIds: [...new Set(input.allowedToolIds ?? [])].sort((left, right) => left.localeCompare(right)),
      deniedToolIds: [...new Set(input.deniedToolIds ?? [])].sort((left, right) => left.localeCompare(right)),
      schemaCacheTtlMinutes: input.schemaCacheTtlMinutes,
      approvalPolicy: input.approvalPolicy,
      healthStatus: health.status,
      serverIds: [...new Set(input.serverIds ?? [])].sort((left, right) => left.localeCompare(right)),
      updatedAt: new Date().toISOString()
    })
  }));

  return {
    ok: true as const,
    connectorId: input.connectorId,
    healthStatus: health.status
  };
}

export function authorizeConnection(input: AuthorizeConnectionInput) {
  normalizeActionInput(input);
  const state = loadIntegrationState();
  if (!state.connectors.some((connector) => connector.id === input.connectorId && connector.tenantId === input.tenantId)) {
    throw new Error(`Unknown connector '${input.connectorId}'.`);
  }

  persistIntegrationState((currentState) => ({
    ...currentState,
    connections: upsertById(currentState.connections, {
      id: input.connectionId,
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      label: input.label,
      authType: input.authType,
      secretRef: input.secretRef,
      status: "authorized",
      scopes: [...new Set(input.scopes)].sort((left, right) => left.localeCompare(right)),
      approvedBy: input.actorId,
      environmentScope: input.environmentScope,
      signedPackageOnly: input.signedPackageOnly,
      updatedAt: new Date().toISOString()
    })
  }));

  return {
    ok: true as const,
    connectionId: input.connectionId,
    status: "authorized" as const
  };
}

export function rotateWebhookSecret(input: RotateWebhookSecretInput) {
  normalizeActionInput(input);
  const secretRef = `secret://${input.connectorId}/webhook/${input.webhookId}/${Date.now()}`;
  persistIntegrationState((state) => ({
    ...state,
    webhooks: upsertById(state.webhooks, {
      id: input.webhookId,
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      route: input.route,
      signingSecretRef: secretRef,
      status: "rotated",
      listeners: [...new Set(input.listeners)].sort((left, right) => left.localeCompare(right)),
      lastRotatedAt: new Date().toISOString()
    })
  }));

  return {
    ok: true as const,
    webhookId: input.webhookId,
    signingSecretRef: secretRef
  };
}

function normalizeIntegrationState(state: IntegrationState): IntegrationState {
  return {
    connectors: state.connectors.map((connector) => ({
      ...connector,
      hostAllowlist: [...new Set(connector.hostAllowlist)].sort((left, right) => left.localeCompare(right)),
      allowedToolIds: [...new Set(connector.allowedToolIds)].sort((left, right) => left.localeCompare(right)),
      deniedToolIds: [...new Set(connector.deniedToolIds)].sort((left, right) => left.localeCompare(right)),
      serverIds: [...new Set(connector.serverIds)].sort((left, right) => left.localeCompare(right))
    })),
    connections: state.connections.map((connection) => ({
      ...connection,
      scopes: [...new Set(connection.scopes)].sort((left, right) => left.localeCompare(right))
    })),
    webhooks: state.webhooks.map((webhook) => ({
      ...webhook,
      listeners: [...new Set(webhook.listeners)].sort((left, right) => left.localeCompare(right))
    }))
  };
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const remaining = items.filter((entry) => entry.id !== item.id);
  return [...remaining, item];
}

function toMcpConnector(connector: IntegrationConnectorRecord): McpClientConnector {
  return {
    id: connector.id,
    label: connector.label,
    endpoint: connector.endpoint,
    transport: connector.transport,
    connectionMode: connector.connectionMode,
    hostAllowlist: connector.hostAllowlist,
    trustTier: "first-party",
    requiresApproval: connector.approvalPolicy !== "none",
    allowedToolIds: connector.allowedToolIds,
    deniedToolIds: connector.deniedToolIds,
    schemaCacheTtlMinutes: connector.schemaCacheTtlMinutes,
    serverIds: connector.serverIds
  };
}
