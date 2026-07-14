import assert from "node:assert/strict";
import test from "node:test";
import { defaultBranding, defaultSettings, defaultTheme, type Conversation, type Database } from "./domain";
import { getVoiceTranscript, listVoiceTranscripts, maskBasicPii, validateVoicePolicy } from "./voice-review";

const now = "2026-07-14T10:00:00.000Z";
function conversation(id: string, tenantId: string, channel: "CHAT" | "VOICE", summary: string): Conversation { return { id, tenantId, channel, language: "en", contact: { name: "Amit", email: "amit@example.com", phone: "+91 98765 43210" }, issue: { summary, asset: "M-7", model: "", serialNumber: "", errorCode: "E-42", site: "", severityClues: [], missingQuestions: [] }, classification: { category: "Electrical", severity: "medium", urgency: "soon", confidence: .9 }, safetyReasons: [], lowConfidenceReason: null, clarificationCount: 0, status: "TICKET_CREATED", createdAt: now, updatedAt: now }; }
function database(): Database { return { tenants: [{ id: "tenant-a", name: "A", slug: "a", status: "ACTIVE", settings: { ...defaultSettings, voiceTranscriptMasking: "BASIC" }, branding: { ...defaultBranding }, theme: { ...defaultTheme }, createdAt: now, updatedAt: now }, { id: "tenant-b", name: "B", slug: "b", status: "ACTIVE", settings: { ...defaultSettings }, branding: { ...defaultBranding }, theme: { ...defaultTheme }, createdAt: now, updatedAt: now }], users: [], auditLogs: [], conversations: [conversation("voice-a", "tenant-a", "VOICE", "Motor alarm"), conversation("chat-a", "tenant-a", "CHAT", "Chat issue"), conversation("voice-b", "tenant-b", "VOICE", "Other tenant")], conversationMessages: [{ id: "m2", tenantId: "tenant-a", conversationId: "voice-a", role: "ASSISTANT", content: "We will contact amit@example.com", createdAt: "2026-07-14T10:01:00.000Z" }, { id: "m1", tenantId: "tenant-a", conversationId: "voice-a", role: "USER", content: "Call +91 98765 43210 about E-42", createdAt: now }, { id: "other", tenantId: "tenant-b", conversationId: "voice-b", role: "USER", content: "private other tenant", createdAt: now }], conversationFeedback: [], knowledgeDocuments: [], knowledgeVersions: [], sopDefinitions: [], sopExecutions: [], ticketingIntegrations: [], tickets: [], ticketSyncLogs: [] }; }

test("voice transcript review excludes chat and other tenants while linking ordered messages", () => {
  const results = listVoiceTranscripts(database(), "tenant-a"); assert.equal(results.length, 1); assert.equal(results[0].conversation.id, "voice-a"); assert.deepEqual(results[0].messages.map((item) => item.id), ["m1", "m2"]); assert.equal(getVoiceTranscript(database(), "tenant-a", "voice-b"), null);
});

test("voice review supports search, status and date filters", () => {
  const db = database(); assert.equal(listVoiceTranscripts(db, "tenant-a", { query: "E-42", status: "TICKET_CREATED", from: "2026-07-14", to: "2026-07-14" }).length, 1); assert.equal(listVoiceTranscripts(db, "tenant-a", { query: "not found" }).length, 0); assert.equal(listVoiceTranscripts(db, "tenant-a", { from: "2026-07-15" }).length, 0);
});

test("basic transcript masking conceals email and phone values", () => {
  const result = listVoiceTranscripts(database(), "tenant-a")[0]; assert.equal(result.conversation.contact.email, "[EMAIL REDACTED]"); assert.equal(result.conversation.contact.phone, "[PHONE REDACTED]"); assert.match(result.messages[0].content, /PHONE REDACTED/); assert.match(result.messages[1].content, /EMAIL REDACTED/); assert.equal(maskBasicPii("No PII"), "No PII");
});

test("voice recording and masking policies reject unsupported values", () => {
  assert.equal(validateVoicePolicy("NEVER", "BASIC"), true); assert.equal(validateVoicePolicy("WITH_EXPLICIT_CONSENT", "NONE"), true); assert.throws(() => validateVoicePolicy("ALWAYS", "BASIC"), /audio/); assert.throws(() => validateVoicePolicy("NEVER", "UNKNOWN"), /masking/);
});
