import { defineUiSurface } from "@platform/ui-shell";

import { IntegrationAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/integrations",
      component: IntegrationAdminPage,
      permission: "integrations.connectors.read"
    }
  ],
  widgets: []
});
