import { randomUUID } from "node:crypto";
import type { Database, Ticket, TicketingIntegration } from "./domain";
import { decryptSecret } from "./security";
import { mutateDatabase, readDatabase } from "./store";
import { validateOutboundEndpoint } from "./ticketing";

type WebhookAuth = { token?: string; username?: string; password?: string };
export type ExternalStatusUpdate = { externalTicketId: string; status: string; raw: unknown };
function valueAtPath(value: unknown, path: string): unknown { return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value); }

export function applyExternalStatus(database: Database, tenantId: string, update: ExternalStatusUpdate, source: "STATUS_PULL" | "STATUS_WEBHOOK", now = new Date().toISOString()) {
  const ticket = database.tickets.find((item) => item.tenantId === tenantId && item.externalTicketId === update.externalTicketId); if (!ticket) throw new Error("Ticket not found.");
  const previous = ticket.externalStatus ?? null; ticket.externalStatus = update.status; ticket.lastStatusSyncedAt = now; ticket.updatedAt = now;
  database.ticketSyncLogs.push({ id: randomUUID(), tenantId, ticketId: ticket.id, integrationId: ticket.integrationId, action: source, requestPayload: { externalTicketId: update.externalTicketId }, responsePayload: update.raw, status: "SUCCESS", errorMessage: null, createdAt: now });
  return { ticket, changed: previous !== update.status, previousStatus: previous };
}

function statusUrl(integration: TicketingIntegration, ticket: Ticket) {
  if (!integration.statusEndpointUrl) throw new Error("Status polling endpoint is not configured."); if (!ticket.externalTicketId) throw new Error("Ticket has no external identifier.");
  const encoded = encodeURIComponent(ticket.externalTicketId); const endpoint = integration.statusEndpointUrl.includes("{externalId}") ? integration.statusEndpointUrl.replaceAll("{externalId}", encoded) : `${integration.statusEndpointUrl}${integration.statusEndpointUrl.includes("?") ? "&" : "?"}externalId=${encoded}`;
  validateOutboundEndpoint(endpoint); return endpoint;
}

function requestHeaders(integration: TicketingIntegration) { const headers: Record<string, string> = { accept: "application/json", ...integration.headers }; const auth = decryptSecret<WebhookAuth>(integration.authConfigEncrypted); if (integration.authType === "BEARER" && auth.token) headers.authorization = `Bearer ${auth.token}`; if (integration.authType === "BASIC" && auth.username) headers.authorization = `Basic ${Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64")}`; return headers; }

export async function fetchExternalStatus(integration: TicketingIntegration, ticket: Ticket, fetcher: typeof fetch = fetch): Promise<ExternalStatusUpdate> {
  const response = await fetcher(statusUrl(integration, ticket), { method: "GET", headers: requestHeaders(integration), signal: AbortSignal.timeout(10_000) }); const raw = await response.json() as unknown; if (!response.ok) throw new Error(`Ticket status endpoint returned HTTP ${response.status}.`);
  const status = String(valueAtPath(raw, integration.statusFieldPath || "status") ?? "").trim(); if (!status) throw new Error("Ticket status response did not contain the configured status field."); return { externalTicketId: ticket.externalTicketId!, status, raw };
}

export async function syncExternalTicketStatus(tenantId: string, ticketId: string, fetcher: typeof fetch = fetch) {
  const snapshot = await readDatabase(); const ticket = snapshot.tickets.find((item) => item.id === ticketId && item.tenantId === tenantId); if (!ticket) throw new Error("Ticket not found."); const integration = snapshot.ticketingIntegrations.find((item) => item.id === ticket.integrationId && item.tenantId === tenantId && item.isActive); if (!integration) throw new Error("Active ticketing integration not found.");
  try { const update = await fetchExternalStatus(integration, ticket, fetcher); let result!: ReturnType<typeof applyExternalStatus>; await mutateDatabase((database) => { result = applyExternalStatus(database, tenantId, update, "STATUS_PULL"); }); return result; }
  catch (reason) { const error = reason instanceof Error ? reason.message : "Ticket status sync failed."; await mutateDatabase((database) => database.ticketSyncLogs.push({ id: randomUUID(), tenantId, ticketId, integrationId: integration.id, action: "STATUS_PULL", requestPayload: { externalTicketId: ticket.externalTicketId }, responsePayload: null, status: "FAILED", errorMessage: error, createdAt: new Date().toISOString() })); throw new Error(error); }
}
