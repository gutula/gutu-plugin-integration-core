import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const integrationConnectors = pgTable("integration_connectors", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  label: text("label").notNull(),
  transport: text("transport").notNull(),
  endpoint: text("endpoint").notNull(),
  toolFilterMode: text("tool_filter_mode").notNull(),
  schemaCacheTtlMinutes: integer("schema_cache_ttl_minutes").notNull(),
  approvalPolicy: text("approval_policy").notNull(),
  healthStatus: text("health_status").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const integrationConnections = pgTable("integration_connections", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  connectorId: text("connector_id").notNull(),
  label: text("label").notNull(),
  authType: text("auth_type").notNull(),
  secretRef: text("secret_ref").notNull(),
  status: text("status").notNull(),
  environmentScope: text("environment_scope").notNull(),
  signedPackageOnly: text("signed_package_only").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const integrationWebhooks = pgTable("integration_webhooks", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  connectorId: text("connector_id").notNull(),
  route: text("route").notNull(),
  signingSecretRef: text("signing_secret_ref").notNull(),
  status: text("status").notNull(),
  listenerCount: integer("listener_count").notNull(),
  lastRotatedAt: timestamp("last_rotated_at")
});
