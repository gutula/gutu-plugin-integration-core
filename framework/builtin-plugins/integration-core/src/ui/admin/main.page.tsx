import React from "react";

import { getIntegrationOverview, listConnectors, listConnections, listWebhooks } from "../../services/main.service";

export function IntegrationAdminPage() {
  const overview = getIntegrationOverview();
  const connectors = listConnectors().slice(0, 4);
  const connections = listConnections().slice(0, 3);
  const webhooks = listWebhooks().slice(0, 3);

  return React.createElement(
    "section",
    null,
    React.createElement("h1", null, "Integration Control Plane"),
    React.createElement(
      "p",
      null,
      `${overview.totals.connectors} connectors, ${overview.totals.connections} live connections, ${overview.totals.webhooks} webhook routes.`
    ),
    React.createElement(
      "ul",
      null,
      ...connectors.map((connector) =>
        React.createElement("li", { key: connector.id }, `${connector.label} - ${connector.transport} - ${connector.healthStatus}`)
      )
    ),
    React.createElement("h2", null, "Authorized Connections"),
    React.createElement(
      "ul",
      null,
      ...connections.map((connection) =>
        React.createElement("li", { key: connection.id }, `${connection.label} - ${connection.environmentScope}`)
      )
    ),
    React.createElement("h2", null, "Webhook Routes"),
    React.createElement(
      "ul",
      null,
      ...webhooks.map((webhook) => React.createElement("li", { key: webhook.id }, `${webhook.route} - ${webhook.status}`))
    )
  );
}
