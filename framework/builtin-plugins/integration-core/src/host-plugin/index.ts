/** Host-plugin contribution for integration-core.
 *
 *  Mounts at /api/<routes> via the shell's plugin loader. */
import type { HostPlugin } from "@gutu-host/plugin-contract";

import { bulkImportRoutes } from "./routes/bulk-import";


export const hostPlugin: HostPlugin = {
  id: "integration-core",
  version: "1.0.0",
  dependsOn: ["notifications-core", "template-core"],
  
  routes: [
    { mountPath: "/bulk-import", router: bulkImportRoutes }
  ],
};

// Re-export the lib API so other plugins can `import` from
// "@gutu-plugin/integration-core".
export * from "./lib";
