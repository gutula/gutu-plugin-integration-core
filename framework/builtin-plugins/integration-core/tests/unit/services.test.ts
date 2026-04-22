import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { authorizeConnection, listConnections, listConnectors, registerConnector, rotateWebhookSecret } from "../../src/services/main.service";

describe("integration-core services", () => {
  let stateDir = "";
  const previousStateDir = process.env.GUTU_STATE_DIR;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "gutu-integration-state-"));
    process.env.GUTU_STATE_DIR = stateDir;
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
    if (previousStateDir === undefined) {
      delete process.env.GUTU_STATE_DIR;
      return;
    }
    process.env.GUTU_STATE_DIR = previousStateDir;
  });

  it("registers governed connectors and authorizes environment-scoped connections", () => {
    const connector = registerConnector({
      tenantId: "tenant-platform",
      actorId: "actor-admin",
      connectorId: "connector:erp",
      label: "ERP Connector",
      transport: "sse",
      endpoint: "https://erp.example.com/mcp",
      connectionMode: "persistent",
      hostAllowlist: ["erp.example.com"],
      toolFilterMode: "denylist",
      deniedToolIds: ["erp.admin.delete"],
      schemaCacheTtlMinutes: 15,
      approvalPolicy: "conditional",
      serverIds: ["erp-server"]
    });
    const connection = authorizeConnection({
      tenantId: "tenant-platform",
      actorId: "actor-admin",
      connectionId: "connection:erp-prod",
      connectorId: "connector:erp",
      label: "ERP Production",
      authType: "service-account",
      secretRef: "secret://erp/service-account",
      scopes: ["orders.read"],
      environmentScope: "prod",
      signedPackageOnly: true
    });

    expect(connector.healthStatus).toBe("blocked");
    expect(connection.status).toBe("authorized");
    expect(listConnectors().some((entry) => entry.id === "connector:erp")).toBe(true);
    expect(listConnections().some((entry) => entry.id === "connection:erp-prod")).toBe(true);
  });

  it("rotates webhook signing secrets", () => {
    const rotated = rotateWebhookSecret({
      tenantId: "tenant-platform",
      actorId: "actor-admin",
      webhookId: "webhook:erp-events",
      connectorId: "connector:crm",
      route: "/api/integrations/erp/events",
      listeners: ["listener:erp-sync", "listener:audit"]
    });

    expect(rotated.signingSecretRef).toContain("webhook");
  });
});
