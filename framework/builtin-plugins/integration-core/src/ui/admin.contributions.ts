import {
  defineAdminNav,
  defineBuilder,
  defineCommand,
  definePage,
  defineWorkspace,
  type AdminContributionRegistry
} from "@platform/admin-contracts";

import { IntegrationBuilderPage } from "./admin/integration-builder.page";
import { IntegrationAdminPage } from "./admin/main.page";

export const adminContributions: Pick<AdminContributionRegistry, "workspaces" | "nav" | "pages" | "builders" | "commands"> = {
  workspaces: [
    defineWorkspace({
      id: "integrations",
      label: "Integrations",
      icon: "plug-zap",
      description: "Connector definitions, authorized connections, webhook ingress, and MCP-aware runtime posture.",
      permission: "integrations.connectors.read",
      homePath: "/admin/integrations",
      quickActions: ["integrations.open.control-plane", "integrations.open.builder"]
    })
  ],
  nav: [
    defineAdminNav({
      workspace: "integrations",
      group: "control-plane",
      items: [
        {
          id: "integrations.overview",
          label: "Control Plane",
          icon: "plug",
          to: "/admin/integrations",
          permission: "integrations.connectors.read"
        }
      ]
    }),
    defineAdminNav({
      workspace: "tools",
      group: "builders",
      items: [
        {
          id: "tools.integration-builder",
          label: "Integration Builder",
          icon: "network",
          to: "/admin/tools/integration-builder",
          permission: "integrations.builders.use"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "integrations.page",
      kind: "dashboard",
      route: "/admin/integrations",
      label: "Integration Control Plane",
      workspace: "integrations",
      group: "control-plane",
      permission: "integrations.connectors.read",
      component: IntegrationAdminPage
    }),
    definePage({
      id: "integrations.builder.page",
      kind: "builder",
      route: "/admin/tools/integration-builder",
      label: "Integration Builder",
      workspace: "tools",
      group: "builders",
      permission: "integrations.builders.use",
      component: IntegrationBuilderPage,
      builderId: "integration-builder"
    })
  ],
  builders: [
    defineBuilder({
      id: "integration-builder",
      label: "Integration Builder",
      host: "admin",
      route: "/admin/tools/integration-builder",
      permission: "integrations.builders.use",
      mode: "embedded"
    })
  ],
  commands: [
    defineCommand({
      id: "integrations.open.control-plane",
      label: "Open Integration Control Plane",
      permission: "integrations.connectors.read",
      href: "/admin/integrations",
      keywords: ["integrations", "connectors", "webhooks"]
    }),
    defineCommand({
      id: "integrations.open.builder",
      label: "Open Integration Builder",
      permission: "integrations.builders.use",
      href: "/admin/tools/integration-builder",
      keywords: ["integrations", "builder", "mcp"]
    })
  ]
};
