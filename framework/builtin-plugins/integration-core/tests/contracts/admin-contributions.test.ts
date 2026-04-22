import { describe, expect, it } from "bun:test";

import { adminContributions } from "../../src/ui/admin.contributions";

describe("integration admin contributions", () => {
  it("registers control plane and builder routes", () => {
    expect(adminContributions.workspaces[0]?.id).toBe("integrations");
    expect(adminContributions.pages[0]?.route).toBe("/admin/integrations");
    expect(adminContributions.builders[0]?.route).toBe("/admin/tools/integration-builder");
  });
});
