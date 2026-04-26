/** Admin-shell UI contributions for integration-core.
 *
 *  - /settings/bulk-import — CSV/JSON bulk import wizard
 */

import { defineAdminUi } from "@gutu-host/plugin-ui-contract";
import { BulkImportPage } from "./pages/BulkImportPage";

export const adminUi = defineAdminUi({
  id: "integration-core",
  pages: [
    {
      id: "integration-core.bulk-import",
      path: "/settings/bulk-import",
      title: "Bulk import",
      description: "CSV / JSON ingest with column mapper, dry-run, transactional commit.",
      Component: BulkImportPage,
      icon: "Upload",
    },
  ],
  navEntries: [
    {
      id: "integration-core.nav.bulk-import",
      label: "Bulk import",
      icon: "Upload",
      path: "/settings/bulk-import",
      section: "settings",
      order: 15,
    },
  ],
  commands: [
    {
      id: "integration-core.cmd.bulk-import",
      label: "Open Bulk import",
      icon: "Upload",
      keywords: ["bulk", "import", "csv", "json", "upload"],
      run: () => { window.location.hash = "/settings/bulk-import"; },
    },
  ],
});

export { BulkImportPage } from "./pages/BulkImportPage";
