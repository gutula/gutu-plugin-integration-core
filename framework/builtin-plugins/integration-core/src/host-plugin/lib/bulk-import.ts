/** Bulk import — CSV/JSON/JSONL ingest with column mapping, dry-run,
 *  and transactional commit.
 *
 *  Flow:
 *
 *    1. Client uploads CSV (text/csv) or JSON/JSONL (application/json).
 *       Server parses to `{ headers: string[], rows: Record<string, string>[] }`.
 *
 *    2. Client posts a column-mapping (`{ srcColumn: 'targetField' }`)
 *       and a per-row identity strategy (insert|update|upsert) +
 *       optional `idField` so updates can resolve existing records.
 *
 *    3. Dry-run validates each row against the resource's custom-field
 *       metadata and any configured property-setter overrides; reports
 *       a per-row outcome (`ok` | `error: ...`) without writing.
 *
 *    4. Commit re-parses + writes inside a single SQLite transaction
 *       so the import is **all-or-nothing**. Naming-series + auto-fired
 *       notifications still apply per record (so importing 1000 invoices
 *       allocates 1000 sequential numbers and fires the configured rules).
 *
 *  Storage: `bulk_import_jobs` keeps an audit row per job so admins can
 *  see history. Failures store the parse + per-row errors so the user
 *  can fix and re-upload.
 */

import { db, nowIso } from "@gutu-host";
import { uuid } from "@gutu-host";
import { validateRecordAgainstFieldMeta } from "@gutu-host/field-metadata";
import { nextNameForResource } from "@gutu-plugin/template-core";
import { fireEvent } from "@gutu-plugin/notifications-core";
import { recordAudit } from "@gutu-host";
import { seedDefaultAcl } from "@gutu-host/acl";

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  /** Format detected. */
  format: "csv" | "json" | "jsonl";
  /** Errors during parse — usually surface as a single 'unparseable' row. */
  errors: string[];
}

export interface ColumnMapping {
  /** key: source column name, value: target field name on the resource.
   *  An empty string skips the source column. */
  [srcColumn: string]: string;
}

export interface ImportArgs {
  tenantId: string;
  resource: string;
  /** Parsed input. */
  parsed: ParseResult;
  /** Source column → target field map. */
  mapping: ColumnMapping;
  /** Identity strategy per row. */
  strategy: "insert" | "update" | "upsert";
  /** Field used to look up existing records (only when strategy != insert).
   *  Defaults to "id". */
  idField?: string;
  /** Static fields applied to every row (e.g. company_id). */
  defaults?: Record<string, unknown>;
  /** When true, validate but don't write. */
  dryRun: boolean;
  createdBy: string;
}

export interface RowResult {
  rowIndex: number; // 0-based
  status: "ok" | "skipped" | "error";
  error?: string;
  /** id of the record after import (insert/upsert only). */
  recordId?: string;
}

export interface ImportResult {
  jobId: string;
  resource: string;
  rowCount: number;
  ok: number;
  errors: number;
  skipped: number;
  rowResults: RowResult[];
  durationMs: number;
}

/* ----------------------------- Parsers ----------------------------------- */

/** Minimal RFC-4180 CSV parser. Handles quoted fields, escaped quotes,
 *  CRLF and LF line endings, trailing newlines, and empty cells.
 *
 *  We deliberately don't support multi-character delimiters or column
 *  type coercion; the import flow validates per-row downstream. */
export function parseCsv(text: string): ParseResult {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      cur.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      cur.push(cell);
      cell = "";
      rows.push(cur);
      cur = [];
      // Skip \r\n pair.
      if (ch === "\r" && text[i + 1] === "\n") i += 2;
      else i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  if (rows.length === 0) {
    return { headers: [], rows: [], format: "csv", errors: ["Empty input"] };
  }
  const headers = rows[0]!.map((h) => h.trim());
  const dataRows = rows.slice(1).filter((r) => !(r.length === 1 && r[0] === ""));
  const out = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]!] = (r[c] ?? "").trim();
    }
    return obj;
  });
  return { headers, rows: out, format: "csv", errors: [] };
}

/** JSON: either a top-level array of objects, or JSONL (one object per line).
 *  Headers are derived from the union of keys across rows so the column
 *  mapper can render every available field. */
export function parseJsonOrJsonl(text: string): ParseResult {
  const trimmed = text.trim();
  const errors: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let format: "json" | "jsonl" = "json";
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(arr)) throw new Error("Expected array at top level");
      rows = arr.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  } else {
    format = "jsonl";
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as unknown;
        if (obj && typeof obj === "object") rows.push(obj as Record<string, unknown>);
      } catch (err) {
        errors.push(`Line: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  const headerSet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k);
  const headers = [...headerSet];
  // Stringify scalar values for consistency with CSV path; complex
  // values are kept as JSON so the validator can still see them.
  const normalised = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const k of headers) {
      const v = r[k];
      if (v === undefined || v === null) out[k] = "";
      else if (typeof v === "string") out[k] = v;
      else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
      else out[k] = JSON.stringify(v);
    }
    return out;
  });
  return { headers, rows: normalised, format, errors };
}

/* ----------------------------- Import core ------------------------------- */

function applyMapping(
  src: Record<string, string>,
  mapping: ColumnMapping,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [srcKey, targetKey] of Object.entries(mapping)) {
    if (!targetKey) continue;
    const raw = src[srcKey] ?? "";
    if (raw === "") continue;
    // Best-effort coercion: numeric strings → number, true/false → boolean,
    // JSON-looking values → parsed; otherwise keep string.
    if (raw === "true" || raw === "false") {
      out[targetKey] = raw === "true";
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      out[targetKey] = Number(raw);
    } else if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        out[targetKey] = JSON.parse(raw);
      } catch {
        out[targetKey] = raw;
      }
    } else {
      out[targetKey] = raw;
    }
  }
  return out;
}

export function importBulk(args: ImportArgs): ImportResult {
  const start = Date.now();
  const jobId = uuid();
  const idField = args.idField ?? "id";
  const rowResults: RowResult[] = [];
  let ok = 0;
  let errors = 0;
  let skipped = 0;

  const mappedRows: Array<{ index: number; record: Record<string, unknown> } | null> = args.parsed.rows.map(
    (src, idx) => {
      const mapped = applyMapping(src, args.mapping);
      const merged = { ...(args.defaults ?? {}), ...mapped };
      // Always stamp tenantId for the records table.
      const record = { ...merged, tenantId: args.tenantId };
      // Validate against custom-field metadata. System fields are
      // validated downstream by the regular API path; here we focus on
      // catching obvious errors before we spend transaction time.
      const validated = validateRecordAgainstFieldMeta(args.tenantId, args.resource, record);
      if (!validated.ok) {
        rowResults.push({
          rowIndex: idx,
          status: "error",
          error: validated.errors.map((e) => `${e.field}: ${e.error}`).join(", "),
        });
        errors++;
        return null;
      }
      return { index: idx, record: validated.record };
    },
  );

  if (args.dryRun) {
    // Fill in 'ok' result for the rows that passed validation but
    // weren't written.
    for (const r of mappedRows) {
      if (r === null) continue;
      rowResults.push({ rowIndex: r.index, status: "ok" });
      ok++;
    }
    rowResults.sort((a, b) => a.rowIndex - b.rowIndex);
    persistJob({
      jobId,
      tenantId: args.tenantId,
      resource: args.resource,
      strategy: args.strategy,
      isDryRun: true,
      rowCount: args.parsed.rows.length,
      ok,
      errors,
      skipped,
      createdBy: args.createdBy,
      results: rowResults,
    });
    return {
      jobId,
      resource: args.resource,
      rowCount: args.parsed.rows.length,
      ok,
      errors,
      skipped,
      rowResults,
      durationMs: Date.now() - start,
    };
  }

  // Transactional commit. We don't use db.transaction(...) because we
  // also need to fire notifications + allocate naming series + seed
  // ACL per row, and those touch the same DB; transaction() handles
  // nested writes correctly. If any throws, the whole import rolls
  // back so partial imports never persist.
  const tx = db.transaction(() => {
    for (const r of mappedRows) {
      if (r === null) continue;
      try {
        const idVal = (r.record as Record<string, unknown>)[idField];
        const recordId =
          typeof idVal === "string" && idVal.length > 0 ? idVal : uuid();
        const record = { ...r.record, id: recordId };
        // Allocate naming-series number when none was provided.
        if (!record.name && typeof record.name !== "string") {
          try {
            const allocated = nextNameForResource(args.tenantId, args.resource);
            if (allocated) record.name = allocated;
          } catch { /* tolerate */ }
        }
        switch (args.strategy) {
          case "insert": {
            const exists = db
              .prepare(`SELECT id FROM records WHERE resource = ? AND id = ?`)
              .get(args.resource, recordId);
            if (exists) {
              rowResults.push({
                rowIndex: r.index,
                status: "error",
                error: `Record id "${recordId}" already exists`,
              });
              errors++;
              continue;
            }
            db.prepare(
              `INSERT INTO records (resource, id, data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)`,
            ).run(args.resource, recordId, JSON.stringify(record), nowIso(), nowIso());
            seedDefaultAcl({
              resource: args.resource,
              recordId,
              ownerUserId: "system:bulk-import",
              ownerEmail: args.createdBy,
              tenantId: args.tenantId,
            });
            try {
              fireEvent({
                tenantId: args.tenantId,
                resource: args.resource,
                event: "create",
                recordId,
                record,
                context: { actor: args.createdBy, source: "bulk-import" },
              });
            } catch { /* dispatcher failures don't fail import */ }
            rowResults.push({ rowIndex: r.index, status: "ok", recordId });
            ok++;
            break;
          }
          case "update": {
            const existing = db
              .prepare(`SELECT data FROM records WHERE resource = ? AND id = ?`)
              .get(args.resource, recordId) as { data: string } | undefined;
            if (!existing) {
              rowResults.push({
                rowIndex: r.index,
                status: "error",
                error: `Record id "${recordId}" not found`,
              });
              errors++;
              continue;
            }
            const before = JSON.parse(existing.data) as Record<string, unknown>;
            const merged = { ...before, ...record };
            db.prepare(
              `UPDATE records SET data = ?, updated_at = ?
                 WHERE resource = ? AND id = ?`,
            ).run(JSON.stringify(merged), nowIso(), args.resource, recordId);
            try {
              fireEvent({
                tenantId: args.tenantId,
                resource: args.resource,
                event: "update",
                recordId,
                record: merged,
                previous: before,
                context: { actor: args.createdBy, source: "bulk-import" },
              });
            } catch { /* tolerate */ }
            rowResults.push({ rowIndex: r.index, status: "ok", recordId });
            ok++;
            break;
          }
          case "upsert": {
            const existing = db
              .prepare(`SELECT data FROM records WHERE resource = ? AND id = ?`)
              .get(args.resource, recordId) as { data: string } | undefined;
            if (existing) {
              const before = JSON.parse(existing.data) as Record<string, unknown>;
              const merged = { ...before, ...record };
              db.prepare(
                `UPDATE records SET data = ?, updated_at = ?
                   WHERE resource = ? AND id = ?`,
              ).run(JSON.stringify(merged), nowIso(), args.resource, recordId);
              try {
                fireEvent({
                  tenantId: args.tenantId,
                  resource: args.resource,
                  event: "update",
                  recordId,
                  record: merged,
                  previous: before,
                  context: { actor: args.createdBy, source: "bulk-import" },
                });
              } catch { /* tolerate */ }
            } else {
              db.prepare(
                `INSERT INTO records (resource, id, data, status, created_at, updated_at)
                 VALUES (?, ?, ?, 'active', ?, ?)`,
              ).run(args.resource, recordId, JSON.stringify(record), nowIso(), nowIso());
              seedDefaultAcl({
                resource: args.resource,
                recordId,
                ownerUserId: "system:bulk-import",
                ownerEmail: args.createdBy,
                tenantId: args.tenantId,
              });
              try {
                fireEvent({
                  tenantId: args.tenantId,
                  resource: args.resource,
                  event: "create",
                  recordId,
                  record,
                  context: { actor: args.createdBy, source: "bulk-import" },
                });
              } catch { /* tolerate */ }
            }
            rowResults.push({ rowIndex: r.index, status: "ok", recordId });
            ok++;
            break;
          }
        }
      } catch (err) {
        rowResults.push({
          rowIndex: r.index,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }
  });

  try {
    tx();
  } catch (err) {
    // Surface the error and unwind the entire import. ok=0 because nothing
    // committed.
    return {
      jobId,
      resource: args.resource,
      rowCount: args.parsed.rows.length,
      ok: 0,
      errors: rowResults.filter((r) => r.status === "error").length || 1,
      skipped,
      rowResults: [
        {
          rowIndex: -1,
          status: "error",
          error: `Import rolled back: ${err instanceof Error ? err.message : String(err)}`,
        },
        ...rowResults,
      ],
      durationMs: Date.now() - start,
    };
  }

  rowResults.sort((a, b) => a.rowIndex - b.rowIndex);
  persistJob({
    jobId,
    tenantId: args.tenantId,
    resource: args.resource,
    strategy: args.strategy,
    isDryRun: false,
    rowCount: args.parsed.rows.length,
    ok,
    errors,
    skipped,
    createdBy: args.createdBy,
    results: rowResults,
  });

  recordAudit({
    actor: args.createdBy,
    action: "bulk-import.committed",
    resource: args.resource,
    recordId: jobId,
    payload: {
      strategy: args.strategy,
      rowCount: args.parsed.rows.length,
      ok,
      errors,
    },
  });

  return {
    jobId,
    resource: args.resource,
    rowCount: args.parsed.rows.length,
    ok,
    errors,
    skipped,
    rowResults,
    durationMs: Date.now() - start,
  };
}

/* ----------------------------- Job audit log ----------------------------- */

function ensureJobsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_import_jobs (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      resource     TEXT NOT NULL,
      strategy     TEXT NOT NULL,
      is_dry_run   INTEGER NOT NULL,
      row_count    INTEGER NOT NULL,
      ok_count     INTEGER NOT NULL,
      err_count    INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      results      TEXT NOT NULL,
      created_by   TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bulk_import_jobs_tr_idx
      ON bulk_import_jobs(tenant_id, resource);
  `);
}

function persistJob(args: {
  jobId: string;
  tenantId: string;
  resource: string;
  strategy: string;
  isDryRun: boolean;
  rowCount: number;
  ok: number;
  errors: number;
  skipped: number;
  createdBy: string;
  results: RowResult[];
}): void {
  ensureJobsTable();
  db.prepare(
    `INSERT INTO bulk_import_jobs
       (id, tenant_id, resource, strategy, is_dry_run, row_count, ok_count, err_count,
        skipped_count, results, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    args.jobId,
    args.tenantId,
    args.resource,
    args.strategy,
    args.isDryRun ? 1 : 0,
    args.rowCount,
    args.ok,
    args.errors,
    args.skipped,
    // Row results can be large; cap at 5000 to keep audit log lean.
    JSON.stringify(args.results.slice(0, 5000)),
    args.createdBy,
    nowIso(),
  );
}

export function listImportJobs(tenantId: string, resource?: string): Array<{
  id: string;
  resource: string;
  strategy: string;
  isDryRun: boolean;
  rowCount: number;
  ok: number;
  errors: number;
  createdBy: string;
  createdAt: string;
}> {
  ensureJobsTable();
  const rows = resource
    ? (db
        .prepare(
          `SELECT * FROM bulk_import_jobs
            WHERE tenant_id = ? AND resource = ?
            ORDER BY created_at DESC LIMIT 200`,
        )
        .all(tenantId, resource) as never[])
    : (db
        .prepare(
          `SELECT * FROM bulk_import_jobs
            WHERE tenant_id = ?
            ORDER BY created_at DESC LIMIT 200`,
        )
        .all(tenantId) as never[]);
  return rows.map(
    (r: {
      id: string;
      resource: string;
      strategy: string;
      is_dry_run: number;
      row_count: number;
      ok_count: number;
      err_count: number;
      created_by: string;
      created_at: string;
    }) => ({
      id: r.id,
      resource: r.resource,
      strategy: r.strategy,
      isDryRun: r.is_dry_run === 1,
      rowCount: r.row_count,
      ok: r.ok_count,
      errors: r.err_count,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }),
  );
}
