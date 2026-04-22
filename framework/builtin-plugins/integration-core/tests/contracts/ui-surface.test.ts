import { describe, expect, it } from "bun:test";

import { uiSurface } from "../../src/ui/surfaces";

describe("integration ui surface", () => {
  it("mounts the integration control plane", () => {
    expect(uiSurface.embeddedPages[0]?.route).toBe("/admin/integrations");
  });
});
