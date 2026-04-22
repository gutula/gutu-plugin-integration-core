import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getIntegrationOverview, registerConnector } from "../../src/services/main.service";

describe("integration orchestration", () => {
  let stateDir = "";
  const previousStateDir = process.env.GUTU_STATE_DIR;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), "gutu-integration-integration-"));
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

  it("keeps MCP-aware connector inventory visible after registration", () => {
    registerConnector({
      tenantId: "tenant-platform",
      actorId: "actor-admin",
      connectorId: "connector:messaging",
      label: "Messaging Connector",
      transport: "streamable-http",
      endpoint: "https://messaging.example.com/mcp",
      connectionMode: "on-demand",
      hostAllowlist: ["messaging.example.com"],
      toolFilterMode: "allowlist",
      allowedToolIds: ["messages.send"],
      schemaCacheTtlMinutes: 20,
      approvalPolicy: "none",
      serverIds: ["messaging-server"]
    });

    expect(getIntegrationOverview().totals.connectors).toBeGreaterThanOrEqual(2);
  });
});
