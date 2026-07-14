import assert from "node:assert/strict";
import test from "node:test";
import type { Database, NormalizedTicketPayload, Ticket } from "./domain";
import { convertCandidateToDraft, createCandidateFromResolvedTicket, dismissKnowledgeCandidate, isResolvedExternalStatus } from "./knowledge-improvement";
import { retrieveActiveChunks } from "./knowledge";

const now = new Date(0).toISOString();
const payload: NormalizedTicketPayload = { schemaVersion: "1.0", tenantId: "tenant-a", conversationId: "conversation-1", requester: { name: "Private User", email: "private@example.com" }, asset: { id: "M-7", model: "AX", serialNumber: "SN9", site: "Pune" }, issue: { summary: "Motor overload alarm E-42", category: "Electrical", severity: "high", urgency: "urgent", errorCode: "E-42", safetyReasons: [] }, troubleshooting: [{ step: "Inspect overload relay", response: "Relay was tripped", outcome: "Reset and verified current", timestamp: now }], attachments: [], transcript: [{ role: "USER", content: "Private transcript content", timestamp: now }] };
const ticket: Ticket = { id: "ticket-1", reference: "SUP-1", tenantId: "tenant-a", conversationId: "conversation-1", integrationId: "integration-1", status: "CREATED", externalTicketId: "INC001", externalTicketUrl: null, externalStatus: "Resolved", normalizedPayload: payload, creationAttempts: 1, lastError: null, createdAt: now, updatedAt: now };
function database(): Database { return { tenants: [], users: [], auditLogs: [], conversations: [], conversationMessages: [], conversationFeedback: [], knowledgeDocuments: [], knowledgeVersions: [], knowledgeCandidates: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [], tickets: [{ ...ticket }], ticketSyncLogs: [] }; }

test("only resolved external statuses create one privacy-safe KB candidate", () => {
  assert.equal(isResolvedExternalStatus("Closed"), true); assert.equal(isResolvedExternalStatus("In Progress"), false); const db = database();
  const candidate = createCandidateFromResolvedTicket(db, "tenant-a", ticket.id, now)!; assert.equal(candidate.sourceTicketId, ticket.id); assert.match(candidate.proposedContent, /Inspect overload relay/); assert.doesNotMatch(candidate.proposedContent, /Private User|private@example.com|Private transcript/);
  assert.equal(createCandidateFromResolvedTicket(db, "tenant-a", ticket.id, now)?.id, candidate.id); assert.equal(db.knowledgeCandidates?.length, 1); assert.throws(() => createCandidateFromResolvedTicket(db, "tenant-b", ticket.id, now), /not found/);
});

test("accepted candidates become source-linked drafts and remain excluded from live retrieval", () => {
  const db = database(); const candidate = createCandidateFromResolvedTicket(db, "tenant-a", ticket.id, now)!; const result = convertCandidateToDraft(db, "tenant-a", candidate.id, "knowledge-manager", now); const document = db.knowledgeDocuments.find((item) => item.id === result.documentId)!;
  assert.equal(document.status, "DRAFT"); assert.equal(document.sourceTicketId, ticket.id); assert.equal(candidate.status, "CONVERTED"); assert.equal(db.knowledgeVersions[0].status, "DRAFT"); assert.equal(retrieveActiveChunks(db, "tenant-a", "overload relay").length, 0); assert.throws(() => convertCandidateToDraft(db, "tenant-a", candidate.id, "knowledge-manager", now), /pending/);
});

test("Knowledge Manager can dismiss a pending candidate without creating knowledge", () => {
  const db = database(); const candidate = createCandidateFromResolvedTicket(db, "tenant-a", ticket.id, now)!; dismissKnowledgeCandidate(db, "tenant-a", candidate.id, "knowledge-manager", now); assert.equal(candidate.status, "DISMISSED"); assert.equal(db.knowledgeDocuments.length, 0);
});
