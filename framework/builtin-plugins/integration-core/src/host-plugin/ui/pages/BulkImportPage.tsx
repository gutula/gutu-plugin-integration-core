/** Bulk import page.
 *
 *  Three-step flow inside a single page:
 *
 *    1. Upload — drop a CSV / JSON / JSONL file (or paste raw text).
 *       Backend parses to `{ headers, rows, format }`.
 *
 *    2. Map — for each source column, pick a target field. Auto-suggests
 *       matches by exact name. Choose a strategy (insert/update/upsert)
 *       and optionally an id field. The user can preview the first 20
 *       rows of the mapped output.
 *
 *    3. Validate + commit — runs a dry-run that reports per-row outcomes
 *       (errors highlighted). When green, "Commit" runs the import in a
 *       single transaction (all-or-nothing).
 *
 *  Backend: admin-panel/backend/src/routes/bulk-import.ts. */

import * as React from "react";
import {
  Upload,
  AlertTriangle,
  Check,
  ChevronRight,
  Database,
  ListChecks,
  Send,
  FileUp,
  Search,
} from "lucide-react";

import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Label } from "@/primitives/Label";
import { Badge } from "@/primitives/Badge";
import { Spinner } from "@/primitives/Spinner";
import { Textarea } from "@/primitives/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/primitives/Select";
import { authStore } from "@/runtime/auth";
import { cn } from "@/lib/cn";

interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  format: "csv" | "json" | "jsonl";
  errors: string[];
}

interface RowResult {
  rowIndex: number;
  status: "ok" | "skipped" | "error";
  error?: string;
  recordId?: string;
}

interface ImportResult {
  jobId: string;
  resource: string;
  rowCount: number;
  ok: number;
  errors: number;
  skipped: number;
  rowResults: RowResult[];
  durationMs: number;
}

const RESOURCES: Array<{ id: string; label: string; group: string }> = [
  { id: "crm.contact", label: "Contacts", group: "CRM" },
  { id: "crm.lead", label: "Leads", group: "CRM" },
  { id: "sales.deal", label: "Deals", group: "Sales" },
  { id: "sales.quote", label: "Quotes", group: "Sales" },
  { id: "sales.order", label: "Sales orders", group: "Sales" },
  { id: "accounting.invoice", label: "Invoices", group: "Accounting" },
  { id: "accounting.bill", label: "Bills", group: "Accounting" },
  { id: "inventory.item", label: "Items", group: "Inventory" },
  { id: "inventory.warehouse", label: "Warehouses", group: "Inventory" },
  { id: "ops.ticket", label: "Tickets", group: "Operations" },
  { id: "hr.employee", label: "Employees", group: "People" },
];

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
      : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (authStore.token) h.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) h["x-tenant"] = authStore.activeTenant.id;
  return h;
}

async function httpJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include" });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* tolerate */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function BulkImportPage(): React.JSX.Element {
  const [resource, setResource] = React.useState<string>(RESOURCES[0]!.id);
  const [step, setStep] = React.useState<"upload" | "map" | "verify">("upload");
  const [parsing, setParsing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [strategy, setStrategy] = React.useState<"insert" | "update" | "upsert">("insert");
  const [idField, setIdField] = React.useState<string>("id");
  const [pasteText, setPasteText] = React.useState("");
  const [dryRunResult, setDryRunResult] = React.useState<ImportResult | null>(null);
  const [committing, setCommitting] = React.useState(false);
  const [committed, setCommitted] = React.useState<ImportResult | null>(null);

  const reset = () => {
    setStep("upload");
    setParsed(null);
    setMapping({});
    setDryRunResult(null);
    setCommitted(null);
    setPasteText("");
    setError(null);
  };

  /* ----- step 1: upload ----- */

  const onFile = async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${apiBase()}/bulk-import/${encodeURIComponent(resource)}/parse`, {
        method: "POST",
        body: fd,
        headers: authHeaders(false),
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = (await res.json()) as { error?: string }; if (j.error) msg = j.error; } catch { /* tolerate */ }
        throw new Error(msg);
      }
      const result = (await res.json()) as ParseResult;
      setParsed(result);
      autoMap(result);
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  };

  const onPaste = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const result = await httpJson<ParseResult>(
        `${apiBase()}/bulk-import/${encodeURIComponent(resource)}/parse`,
        { method: "POST", headers: authHeaders(), body: JSON.stringify({ text: pasteText }) },
      );
      setParsed(result);
      autoMap(result);
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  };

  const autoMap = (p: ParseResult) => {
    const out: Record<string, string> = {};
    for (const h of p.headers) {
      // Default to identity mapping (column name → field name); user
      // can override per row.
      out[h] = h;
    }
    setMapping(out);
  };

  /* ----- step 2: dry-run ----- */

  const runDryRun = async () => {
    if (!parsed) return;
    setError(null);
    setDryRunResult(null);
    try {
      const result = await httpJson<ImportResult>(
        `${apiBase()}/bulk-import/${encodeURIComponent(resource)}/dry-run`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ parsed, mapping, strategy, idField }),
        },
      );
      setDryRunResult(result);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /* ----- step 3: commit ----- */

  const commit = async () => {
    if (!parsed) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await httpJson<ImportResult>(
        `${apiBase()}/bulk-import/${encodeURIComponent(resource)}/commit`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ parsed, mapping, strategy, idField }),
        },
      );
      setCommitted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <PageHeader
        title="Bulk import"
        description="Upload CSV / JSON / JSONL, map columns, validate row-by-row, then commit transactionally."
        actions={
          step !== "upload" ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              Start over
            </Button>
          ) : null
        }
      />

      <ResourcePicker
        active={resource}
        onPick={(id) => {
          setResource(id);
          reset();
        }}
      />

      <Stepper step={step} />

      {error ? (
        <div className="rounded-md border border-intent-danger/40 bg-intent-danger-bg/30 px-3 py-2 text-sm text-intent-danger flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button className="text-xs underline opacity-80 hover:opacity-100" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      {step === "upload" ? (
        <UploadPanel
          parsing={parsing}
          onFile={onFile}
          pasteText={pasteText}
          onChangeText={setPasteText}
          onPaste={onPaste}
        />
      ) : null}

      {step === "map" && parsed ? (
        <MappingPanel
          parsed={parsed}
          mapping={mapping}
          onChangeMapping={setMapping}
          strategy={strategy}
          onChangeStrategy={setStrategy}
          idField={idField}
          onChangeIdField={setIdField}
          onRunDryRun={runDryRun}
        />
      ) : null}

      {step === "verify" && parsed && dryRunResult ? (
        <VerifyPanel
          parsed={parsed}
          mapping={mapping}
          dryRunResult={dryRunResult}
          committing={committing}
          committed={committed}
          onCommit={commit}
          onBack={() => setStep("map")}
        />
      ) : null}
    </div>
  );
}

function ResourcePicker({
  active,
  onPick,
}: {
  active: string;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RESOURCES;
    return RESOURCES.filter((r) => r.id.includes(q) || r.label.toLowerCase().includes(q));
  }, [search]);
  const byGroup = new Map<string, typeof RESOURCES>();
  for (const r of filtered) {
    const list = (byGroup.get(r.group) ?? []) as typeof RESOURCES;
    byGroup.set(r.group, [...list, r] as typeof RESOURCES);
  }
  return (
    <Card>
      <CardContent className="py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-sm font-medium">Resource:</span>
            <code className="font-mono text-xs text-text-muted">{active}</code>
          </div>
          <Input
            prefix={<Search className="h-3 w-3" />}
            placeholder="Filter…"
            className="h-7 w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {[...byGroup.entries()].map(([g, items]) => (
            <div key={g} className="flex flex-wrap gap-1">
              <span className="text-[11px] uppercase text-text-muted py-0.5 px-1">{g}</span>
              {items.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPick(r.id)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs border transition-colors",
                    r.id === active
                      ? "bg-accent text-white border-accent"
                      : "bg-surface-1 hover:bg-surface-2 border-border",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Stepper({ step }: { step: "upload" | "map" | "verify" }) {
  const steps: Array<{ id: typeof step; label: string; icon: React.ReactNode }> = [
    { id: "upload", label: "Upload", icon: <FileUp className="h-3.5 w-3.5" /> },
    { id: "map", label: "Map", icon: <ListChecks className="h-3.5 w-3.5" /> },
    { id: "verify", label: "Verify & commit", icon: <Send className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs",
              s.id === step
                ? "bg-accent text-white"
                : i < steps.findIndex((x) => x.id === step)
                  ? "bg-intent-success-bg text-intent-success"
                  : "bg-surface-1 text-text-muted",
            )}
          >
            {s.icon}
            {s.label}
          </div>
          {i < steps.length - 1 ? <ChevronRight className="h-3 w-3 text-text-muted" /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function UploadPanel({
  parsing,
  onFile,
  pasteText,
  onChangeText,
  onPaste,
}: {
  parsing: boolean;
  onFile: (f: File) => Promise<void>;
  pasteText: string;
  onChangeText: (s: string) => void;
  onPaste: () => Promise<void>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  return (
    <Card>
      <CardContent className="py-6 flex flex-col gap-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void onFile(f);
          }}
          className={cn(
            "rounded-md border-2 border-dashed p-10 flex flex-col items-center gap-3 text-center transition-colors",
            dragOver ? "border-accent bg-accent-subtle" : "border-border-subtle bg-surface-1/40",
          )}
        >
          <Upload className="h-8 w-8 text-text-muted" />
          <div>
            <p className="text-sm font-medium">Drop a CSV, JSON or JSONL file here</p>
            <p className="text-xs text-text-muted">Up to ~50 MB. Headers expected on the first line for CSV.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={parsing}
            loading={parsing}
            onClick={() => inputRef.current?.click()}
          >
            {parsing ? "Parsing…" : "Choose file"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,.jsonl,application/json,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-text-muted">…or paste raw text</summary>
          <Textarea
            className="font-mono text-xs mt-2"
            rows={10}
            placeholder="name,email&#10;Acme Corp,billing@acme.com"
            value={pasteText}
            onChange={(e) => onChangeText(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={() => void onPaste()} disabled={parsing || !pasteText.trim()}>
              Parse
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function MappingPanel({
  parsed,
  mapping,
  onChangeMapping,
  strategy,
  onChangeStrategy,
  idField,
  onChangeIdField,
  onRunDryRun,
}: {
  parsed: ParseResult;
  mapping: Record<string, string>;
  onChangeMapping: (m: Record<string, string>) => void;
  strategy: "insert" | "update" | "upsert";
  onChangeStrategy: (s: "insert" | "update" | "upsert") => void;
  idField: string;
  onChangeIdField: (s: string) => void;
  onRunDryRun: () => Promise<void>;
}) {
  const [running, setRunning] = React.useState(false);
  return (
    <Card>
      <CardContent className="py-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Strategy</Label>
            <Select value={strategy} onValueChange={(v) => onChangeStrategy(v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insert">Insert (skip existing)</SelectItem>
                <SelectItem value="update">Update (must exist)</SelectItem>
                <SelectItem value="upsert">Upsert (create or update)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Identity field</Label>
            <Input
              value={idField}
              onChange={(e) => onChangeIdField(e.target.value)}
              placeholder="id"
              className="font-mono"
              disabled={strategy === "insert"}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Detected format</Label>
            <Badge intent="neutral" className="font-normal w-fit text-[11px]">
              {parsed.format} · {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        <div>
          <Label>Column mapping</Label>
          <div className="rounded-md border border-border-subtle mt-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">→</th>
                  <th className="px-3 py-2 text-left font-medium">Target field</th>
                  <th className="px-3 py-2 text-left font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {parsed.headers.map((h) => (
                  <tr key={h} className="border-t border-border-subtle">
                    <td className="px-3 py-1.5">
                      <code className="font-mono text-xs">{h}</code>
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">→</td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={mapping[h] ?? ""}
                        onChange={(e) =>
                          onChangeMapping({ ...mapping, [h]: e.target.value })
                        }
                        placeholder="(skip)"
                        className="font-mono text-xs h-7"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-xs text-text-muted truncate max-w-xs">
                      {parsed.rows[0]?.[h] ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={async () => {
              setRunning(true);
              try {
                await onRunDryRun();
              } finally {
                setRunning(false);
              }
            }}
            loading={running}
          >
            Validate (dry run)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VerifyPanel({
  parsed,
  dryRunResult,
  committing,
  committed,
  onCommit,
  onBack,
}: {
  parsed: ParseResult;
  mapping: Record<string, string>;
  dryRunResult: ImportResult;
  committing: boolean;
  committed: ImportResult | null;
  onCommit: () => Promise<void>;
  onBack: () => void;
}) {
  const totals = committed ?? dryRunResult;
  return (
    <Card>
      <CardContent className="py-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Stat label="Rows" value={totals.rowCount} intent="neutral" />
          <Stat label="OK" value={totals.ok} intent="success" />
          <Stat label="Errors" value={totals.errors} intent={totals.errors > 0 ? "danger" : "neutral"} />
          <Stat label="Skipped" value={totals.skipped} intent="neutral" />
        </div>

        {committed ? (
          <div className="rounded-md border border-intent-success/40 bg-intent-success-bg/20 px-3 py-2 text-sm text-intent-success flex items-center gap-2">
            <Check className="h-4 w-4" />
            Imported in {committed.durationMs}ms — job <code className="font-mono">{committed.jobId.slice(0, 8)}</code>
          </div>
        ) : null}

        {totals.rowResults.length > 0 ? (
          <div className="rounded-md border border-border-subtle overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-1 text-text-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-16">#</th>
                  <th className="px-3 py-2 text-left font-medium w-24">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {totals.rowResults.slice(0, 500).map((r) => (
                  <tr key={r.rowIndex} className="border-t border-border-subtle">
                    <td className="px-3 py-1.5 text-text-muted">{r.rowIndex + 1}</td>
                    <td className="px-3 py-1.5">
                      <Badge
                        intent={
                          r.status === "ok"
                            ? "success"
                            : r.status === "error"
                              ? "danger"
                              : "neutral"
                        }
                        className="font-normal text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-text-secondary">
                      {r.error ? (
                        <span className="text-intent-danger">{r.error}</span>
                      ) : r.recordId ? (
                        <code className="font-mono">{r.recordId}</code>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {totals.rowResults.length > 500 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-text-muted text-center">
                      …and {totals.rowResults.length - 500} more rows
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} disabled={committing}>
            Back to mapping
          </Button>
          {committed ? null : (
            <Button
              variant="primary"
              onClick={() => void onCommit()}
              loading={committing}
              disabled={committing || dryRunResult.errors > 0}
            >
              {dryRunResult.errors > 0 ? "Fix errors first" : "Commit import"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  intent,
}: {
  label: string;
  value: number;
  intent: "neutral" | "success" | "danger";
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-text-muted font-medium">
        {label}
      </div>
      <div
        className={cn(
          "text-xl font-semibold tabular-nums mt-0.5",
          intent === "success" && "text-intent-success",
          intent === "danger" && "text-intent-danger",
          intent === "neutral" && "text-text-primary",
        )}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
