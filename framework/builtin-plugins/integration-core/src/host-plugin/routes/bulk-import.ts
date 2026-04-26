/** Bulk Import REST API.
 *
 *  Routes:
 *    POST /:resource/parse         text body (CSV / JSON / JSONL) → { headers, rows, format }
 *    POST /:resource/dry-run       full args incl. mapping → row-by-row outcome, no writes
 *    POST /:resource/commit        full args → transactional all-or-nothing import
 *    GET  /jobs                    audit log (?resource=)
 *
 *  The /parse endpoint accepts either form-data (file upload) or raw
 *  text bodies. We don't store uploaded blobs — large CSVs would balloon
 *  storage. The client posts the parsed rows back on dry-run/commit.
 *
 *  Authorization: routes require auth; tenant scoping is automatic. The
 *  caller must have write access to the target resource (the underlying
 *  insert/update calls into the same path that the regular records
 *  routes use). */

import { Hono } from "@gutu-host";
import { requireAuth, currentUser } from "@gutu-host";
import { getTenantContext } from "@gutu-host";
import {
  importBulk,
  listImportJobs,
  parseCsv,
  parseJsonOrJsonl,
  type ColumnMapping,
  type ParseResult,
} from "@gutu-plugin/integration-core";

export const bulkImportRoutes = new Hono();
bulkImportRoutes.use("*", requireAuth);

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

bulkImportRoutes.post("/:resource/parse", async (c) => {
  const ct = c.req.header("content-type") ?? "";
  let text = "";
  let format: "csv" | "json" | "jsonl" | "auto" = "auto";
  if (ct.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
    text = await file.text();
    if (file.name.endsWith(".csv")) format = "csv";
    else if (file.name.endsWith(".jsonl")) format = "jsonl";
    else if (file.name.endsWith(".json")) format = "json";
  } else if (ct.includes("application/json")) {
    const body = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      format?: "csv" | "json" | "jsonl";
    };
    text = body.text ?? "";
    format = body.format ?? "auto";
  } else {
    text = await c.req.text();
  }
  if (!text.trim()) return c.json({ error: "Empty input" }, 400);

  let result: ParseResult;
  if (format === "csv") result = parseCsv(text);
  else if (format === "json" || format === "jsonl") result = parseJsonOrJsonl(text);
  else {
    // Auto-detect: leading [ or { → JSON; '\n{' → JSONL; otherwise CSV.
    const trimmed = text.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      result = parseJsonOrJsonl(text);
    } else {
      result = parseCsv(text);
    }
  }
  return c.json(result);
});

bulkImportRoutes.post("/:resource/dry-run", async (c) => {
  return runImport(c, true);
});

bulkImportRoutes.post("/:resource/commit", async (c) => {
  return runImport(c, false);
});

bulkImportRoutes.get("/jobs", (c) => {
  const resource = c.req.query("resource") ?? undefined;
  return c.json({ rows: listImportJobs(tenantId(), resource) });
});

async function runImport(
  c: Parameters<Parameters<typeof bulkImportRoutes.post>[1]>[0],
  dryRun: boolean,
): Promise<Response> {
  const resource = c.req.param("resource");
  const body = (await c.req.json().catch(() => ({}))) as {
    parsed?: ParseResult;
    mapping?: ColumnMapping;
    strategy?: "insert" | "update" | "upsert";
    idField?: string;
    defaults?: Record<string, unknown>;
  };
  if (!body.parsed || !Array.isArray(body.parsed.rows)) {
    return c.json({ error: "parsed.rows is required" }, 400);
  }
  if (!body.mapping || typeof body.mapping !== "object") {
    return c.json({ error: "mapping is required" }, 400);
  }
  const strategy = body.strategy ?? "insert";
  if (!["insert", "update", "upsert"].includes(strategy)) {
    return c.json({ error: "strategy must be insert|update|upsert" }, 400);
  }
  const user = currentUser(c);
  const result = importBulk({
    tenantId: tenantId(),
    resource,
    parsed: body.parsed,
    mapping: body.mapping,
    strategy,
    idField: body.idField,
    defaults: body.defaults,
    dryRun,
    createdBy: user.email,
  });
  return c.json(result);
}
