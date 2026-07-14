import assert from "node:assert/strict";
import test from "node:test";
import type { Conversation, Database, TicketingIntegration } from "./domain";
import { decryptSecret, encryptSecret } from "./security";
import { buildNormalizedTicket, CustomWebhookAdapter, deliverTicket, mapTicketPayload, type TicketingAdapter } from "./ticketing";

const now = new Date(0).toISOString();
const conversation: Conversation = { id: "c1", tenantId: "t1", language: "en", contact: { name: "Amit", email: "amit@example.com" }, issue: { summary: "Motor alarm E-42", asset: "M-7", model: "AX", serialNumber: "SN9", errorCode: "E-42", site: "Pune", severityClues: [], missingQuestions: [] }, classification: { category: "Electrical", severity: "medium", urgency: "soon", confidence: .9 }, safetyReasons: [], lowConfidenceReason: null, clarificationCount: 0, status: "ESCALATED", createdAt: now, updatedAt: now };
const database = { tenants: [], users: [], auditLogs: [], conversations: [conversation], conversationMessages: [{ id: "m1", tenantId: "t1", conversationId: "c1", role: "USER" as const, content: "Motor alarm E-42", createdAt: now }], knowledgeDocuments: [], knowledgeVersions: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [], tickets: [], ticketSyncLogs: [] } satisfies Database;

test("normalized ticket contains requester, asset, issue, troubleshooting, attachments, and transcript", () => {
  const payload = buildNormalizedTicket(database, "t1", "c1");
  assert.equal(payload.requester.email, "amit@example.com"); assert.equal(payload.asset.id, "M-7"); assert.equal(payload.issue.category, "Electrical"); assert.deepEqual(payload.troubleshooting, []); assert.deepEqual(payload.attachments, []); assert.equal(payload.transcript.length, 1);
  assert.throws(() => buildNormalizedTicket(database, "another-tenant", "c1"), /not found/);
});

test("core delivery depends only on TicketingAdapter", async () => {
  const fake: TicketingAdapter = { test: async () => ({ externalTicketId: "test", externalTicketUrl: null, raw: {} }), createTicket: async (payload) => ({ externalTicketId: `FAKE-${payload.conversationId}`, externalTicketUrl: null, raw: {} }) };
  const result = await deliverTicket(fake, buildNormalizedTicket(database, "t1", "c1")); assert.equal(result.externalTicketId, "FAKE-c1");
});

test("webhook adapter maps fields and keeps credentials encrypted", async () => {
  const encrypted = encryptSecret({ token: "secret-token" }); assert.notEqual(encrypted, "secret-token"); assert.deepEqual(decryptSecret(encrypted), { token: "secret-token" });
  let request: RequestInit | undefined; const fetcher: typeof fetch = async (_input, init) => { request = init; return new Response(JSON.stringify({ id: "EXT-9", url: "https://tickets.example/EXT-9" }), { status: 201 }); };
  const integration: TicketingIntegration = { id: "i1", tenantId: "t1", type: "CUSTOM_WEBHOOK", name: "Test", endpointUrl: "https://tickets.example/hooks", headers: { "x-tenant": "t1" }, authType: "BEARER", authConfigEncrypted: encrypted, fieldMapping: { summary: "issue.summary", priority: "issue.severity" }, isActive: true, lastTestedAt: null, lastTestStatus: null, createdBy: "u1", createdAt: now, updatedAt: now };
  const payload = buildNormalizedTicket(database, "t1", "c1"); const result = await new CustomWebhookAdapter(integration, fetcher).createTicket(payload); assert.equal(result.externalTicketId, "EXT-9"); assert.match(String((request?.headers as Record<string,string>).authorization), /Bearer secret-token/); assert.deepEqual(JSON.parse(String(request?.body)), { summary: "Motor alarm E-42", priority: "medium" });
  assert.deepEqual(mapTicketPayload(payload, integration.fieldMapping), { summary: "Motor alarm E-42", priority: "medium" });
});

test("webhook endpoints must use HTTPS", () => {
  const integration = { id: "i1", tenantId: "t1", type: "CUSTOM_WEBHOOK", name: "Bad", endpointUrl: "http://internal.local", headers: {}, authType: "NONE", authConfigEncrypted: encryptSecret({}), fieldMapping: {}, isActive: true, lastTestedAt: null, lastTestStatus: null, createdBy: "u1", createdAt: now, updatedAt: now } satisfies TicketingIntegration;
  assert.throws(() => new CustomWebhookAdapter(integration), /HTTPS/);
});
