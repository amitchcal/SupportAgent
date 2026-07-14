import assert from "node:assert/strict";
import test from "node:test";
import type { Database, Ticket, TicketingIntegration } from "./domain";
import { encryptSecret, signTicketingWebhook, verifyTicketingWebhook } from "./security";
import { applyExternalStatus, fetchExternalStatus } from "./ticket-sync";

const now = new Date(0).toISOString();
const ticket: Ticket = { id: "ticket-1", reference: "SUP-1", tenantId: "tenant-a", conversationId: "conversation-1", integrationId: "integration-1", status: "CREATED", externalTicketId: "INC001", externalTicketUrl: null, normalizedPayload: {} as never, creationAttempts: 1, lastError: null, createdAt: now, updatedAt: now };
const integration: TicketingIntegration = { id: "integration-1", tenantId: "tenant-a", type: "SERVICENOW", name: "ServiceNow", endpointUrl: "https://service.example/incidents", statusEndpointUrl: "https://service.example/incidents/{externalId}", statusFieldPath: "result.state", headers: {}, authType: "BASIC", authConfigEncrypted: encryptSecret({ username: "api-user", password: "api-pass" }), fieldMapping: {}, isActive: true, lastTestedAt: null, lastTestStatus: null, createdBy: "admin", createdAt: now, updatedAt: now };
function database(): Database { return { tenants: [], users: [], auditLogs: [], conversations: [], conversationMessages: [], conversationFeedback: [], knowledgeDocuments: [], knowledgeVersions: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [integration], tickets: [{ ...ticket }], ticketSyncLogs: [] }; }

test("signed status webhooks reject tampering", () => {
  const payload = JSON.stringify({ tenantId: "tenant-a", externalTicketId: "INC001", status: "Resolved" }); const signature = signTicketingWebhook(payload);
  assert.equal(verifyTicketingWebhook(payload, signature), true); assert.equal(verifyTicketingWebhook(`${payload}x`, signature), false); assert.equal(verifyTicketingWebhook(payload, null), false);
});

test("inbound status updates are tenant scoped, idempotent and logged", () => {
  const db = database(); const first = applyExternalStatus(db, "tenant-a", { externalTicketId: "INC001", status: "In Progress", raw: { state: "In Progress" } }, "STATUS_WEBHOOK", now); assert.equal(first.changed, true); assert.equal(first.ticket.externalStatus, "In Progress"); assert.equal(db.ticketSyncLogs[0].action, "STATUS_WEBHOOK");
  const second = applyExternalStatus(db, "tenant-a", { externalTicketId: "INC001", status: "In Progress", raw: {} }, "STATUS_WEBHOOK", now); assert.equal(second.changed, false);
  assert.throws(() => applyExternalStatus(db, "tenant-b", { externalTicketId: "INC001", status: "Resolved", raw: {} }, "STATUS_WEBHOOK"), /not found/);
});

test("status polling uses configured endpoint, authentication and field mapping", async () => {
  let requestedUrl = ""; let authorization = ""; const fetcher: typeof fetch = async (input, init) => { requestedUrl = String(input); authorization = String((init?.headers as Record<string, string>).authorization); return Response.json({ result: { state: "Resolved" } }); };
  const result = await fetchExternalStatus(integration, ticket, fetcher); assert.equal(requestedUrl, "https://service.example/incidents/INC001"); assert.match(authorization, /^Basic /); assert.equal(result.status, "Resolved"); assert.equal(result.externalTicketId, "INC001");
  await assert.rejects(() => fetchExternalStatus({ ...integration, statusFieldPath: "result.missing" }, ticket, fetcher), /did not contain/);
});
