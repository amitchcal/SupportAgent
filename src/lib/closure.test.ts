import assert from "node:assert/strict";
import test from "node:test";
import type { Conversation, Database } from "./domain";
import { confirmResolution, performanceReport, recordFeedback } from "./closure";

const now = new Date(0).toISOString();
function conversation(id: string, tenantId: string, status: Conversation["status"], category: Conversation["classification"]["category"] = "Mechanical"): Conversation {
  return { id, tenantId, language: "en", contact: {}, issue: { summary: id, asset: "", model: "", serialNumber: "", errorCode: "", site: "", severityClues: [], missingQuestions: [] }, classification: { category, severity: "low", urgency: "routine", confidence: .9 }, safetyReasons: [], lowConfidenceReason: null, clarificationCount: 0, status, createdAt: now, updatedAt: now };
}
function database(conversations: Conversation[]): Database { return { tenants: [], users: [], auditLogs: [], conversations, conversationMessages: [], conversationFeedback: [], knowledgeDocuments: [], knowledgeVersions: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [], tickets: [], ticketSyncLogs: [] }; }

test("resolution requires the explicit confirmation state", () => {
  const db = database([conversation("c1", "t1", "AWAITING_RESOLUTION_CONFIRMATION"), conversation("c2", "t1", "SOP_IN_PROGRESS")]);
  confirmResolution(db, "t1", "c1", true, now);
  assert.equal(db.conversations[0].status, "RESOLVED");
  assert.equal(db.conversations[0].closedAt, now);
  assert.throws(() => confirmResolution(db, "t1", "c2", true), /not awaiting/);
  assert.throws(() => confirmResolution(db, "t2", "c1", true), /not found/);
});

test("feedback is tenant scoped, linked to a ticket, and flags low CSAT", () => {
  const db = database([conversation("c1", "t1", "TICKET_CREATED")]);
  db.tickets.push({ id: "ticket1", reference: "SUP-1", tenantId: "t1", conversationId: "c1", integrationId: null, status: "CREATED", externalTicketId: "EXT-1", externalTicketUrl: null, normalizedPayload: {} as never, creationAttempts: 1, lastError: null, createdAt: now, updatedAt: now });
  const feedback = recordFeedback(db, { tenantId: "t1", conversationId: "c1", rating: 2, comment: "Still difficult" }, now);
  assert.equal(feedback.ticketId, "ticket1"); assert.equal(feedback.negativeFlag, true);
  assert.throws(() => recordFeedback(db, { tenantId: "t1", conversationId: "c1", rating: 5 }), /already/);
  assert.throws(() => recordFeedback(db, { tenantId: "t2", conversationId: "c1", rating: 5 }), /not found/);
});

test("performance dashboard is tenant scoped and calculates core metrics", () => {
  const db = database([conversation("a", "t1", "RESOLVED"), conversation("b", "t1", "TICKET_CREATED", "Electrical"), conversation("c", "t1", "ESCALATED_WITHOUT_TICKET", "Electrical"), conversation("other", "t2", "RESOLVED")]);
  db.conversationFeedback.push({ id: "f1", tenantId: "t1", conversationId: "a", ticketId: null, rating: 4, comment: "", negativeFlag: false, createdAt: now }, { id: "f2", tenantId: "t1", conversationId: "b", ticketId: null, rating: 2, comment: "", negativeFlag: true, createdAt: now });
  db.tickets.push({ id: "ticket1", reference: "SUP-1", tenantId: "t1", conversationId: "b", integrationId: null, status: "CREATED", externalTicketId: "EXT-1", externalTicketUrl: null, normalizedPayload: {} as never, creationAttempts: 1, lastError: null, createdAt: now, updatedAt: now });
  const report = performanceReport(db, "t1");
  assert.deepEqual({ total: report.totalSessions, resolved: report.resolvedSessions, escalated: report.escalatedSessions, tickets: report.ticketsCreated }, { total: 3, resolved: 1, escalated: 2, tickets: 1 });
  assert.equal(report.resolutionRate, 1 / 3); assert.equal(report.escalationRate, 2 / 3); assert.equal(report.averageCsat, 3); assert.deepEqual(report.topCategories[0], { category: "Electrical", count: 2 });
});
