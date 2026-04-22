import React from "react";

import { BuilderCanvas, BuilderHost, BuilderInspector, BuilderPalette, createBuilderPanelLayout } from "@platform/admin-builders";

import { listConnectors } from "../../services/main.service";

export function IntegrationBuilderPage() {
  const connectors = listConnectors();
  return React.createElement(BuilderHost, {
    layout: createBuilderPanelLayout({ left: "palette", center: "canvas", right: "inspector" }),
    palette: React.createElement(BuilderPalette, {
      items: connectors.map((connector) => ({ id: connector.id, label: connector.label }))
    }),
    canvas: React.createElement(
      BuilderCanvas,
      { title: "Integration Builder" },
      React.createElement("p", null, "Configure transport, host allowlists, tool filters, schema cache, and approval policy.")
    ),
    inspector: React.createElement(
      BuilderInspector,
      { title: "Connector Policy" },
      React.createElement("p", null, "Inspect on-demand versus persistent connections, signed package requirements, and webhook ingress posture.")
    )
  });
}
