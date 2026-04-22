import { describe, expect, it } from "bun:test";
import { getTableColumns } from "drizzle-orm";

import { integrationConnections, integrationConnectors, integrationWebhooks } from "../../db/schema";

describe("integration schema coverage", () => {
  it("captures connectors, connections, and webhooks", () => {
    expect(Object.keys(getTableColumns(integrationConnectors))).toEqual([
      "id",
      "tenantId",
      "label",
      "transport",
      "endpoint",
      "toolFilterMode",
      "schemaCacheTtlMinutes",
      "approvalPolicy",
      "healthStatus",
      "updatedAt"
    ]);
    expect(Object.keys(getTableColumns(integrationConnections))).toEqual([
      "id",
      "tenantId",
      "connectorId",
      "label",
      "authType",
      "secretRef",
      "status",
      "environmentScope",
      "signedPackageOnly",
      "updatedAt"
    ]);
    expect(Object.keys(getTableColumns(integrationWebhooks))).toEqual([
      "id",
      "tenantId",
      "connectorId",
      "route",
      "signingSecretRef",
      "status",
      "listenerCount",
      "lastRotatedAt"
    ]);
  });
});
