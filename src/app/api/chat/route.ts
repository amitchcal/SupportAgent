import { randomUUID } from "node:crypto";
import { classifyIssue, detectSafetyRisk, extractIssueDetails, responseFor } from "@/lib/classification";
import type { Conversation, SupportedLanguage } from "@/lib/domain";
import { findTenantBySlug, getTenantConversation, mutateDatabase } from "@/lib/store";

const languages = new Set<SupportedLanguage>(["en", "hi", "hinglish"]);
const cleanRecord = (value: unknown) => Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {}).map(([key, item]) => [key, String(item ?? "").trim().slice(0, 300)]));

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const tenantSlug = String(body.tenantSlug ?? "").trim(); const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) return Response.json({ error: "Support portal not found." }, { status: 404 });
  const language = String(body.language ?? tenant.settings.defaultLanguage) as SupportedLanguage;
  if (!languages.has(language) || !tenant.settings.enabledLanguages.includes(language)) return Response.json({ error: "Language is not enabled for this tenant." }, { status: 400 });
  const contact = cleanRecord(body.contact); const message = String(body.message ?? "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Please describe the issue." }, { status: 400 });

  if (body.action === "start") {
    const missing = tenant.settings.requiredSupportFields.filter((field) => !contact[field]);
    if (missing.length) return Response.json({ error: `Required details missing: ${missing.join(", ")}.` }, { status: 400 });
    const classification = classifyIssue(message); const safetyReasons = detectSafetyRisk(message); const issue = extractIssueDetails(message, contact);
    const result = responseFor(language, { safetyReasons, confidence: classification.confidence, threshold: tenant.settings.confidenceThreshold, clarificationCount: 0, summary: issue.summary });
    const now = new Date().toISOString(); const conversationId = randomUUID();
    const conversation: Conversation = { id: conversationId, tenantId: tenant.id, language, contact, issue, classification, safetyReasons, lowConfidenceReason: result.lowConfidenceReason, clarificationCount: result.status === "AWAITING_CLARIFICATION" ? 1 : 0, status: result.status, createdAt: now, updatedAt: now };
    await mutateDatabase((database) => { database.conversations.push(conversation); database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: result.content, createdAt: now }); });
    return Response.json({ conversationId, reply: result.content, status: result.status, classification, issue });
  }

  if (body.action === "reply") {
    const conversationId = String(body.conversationId ?? ""); const current = await getTenantConversation(tenant.id, conversationId);
    if (!current) return Response.json({ error: "Conversation not found." }, { status: 404 });
    if (current.status === "ESCALATED") return Response.json({ error: "This conversation is already escalated." }, { status: 409 });
    const combined = `${current.issue.summary} ${message}`; const classification = classifyIssue(combined); const safetyReasons = detectSafetyRisk(combined); const issue = extractIssueDetails(combined, { ...current.contact, ...contact });
    const result = responseFor(current.language, { safetyReasons, confidence: classification.confidence, threshold: tenant.settings.confidenceThreshold, clarificationCount: current.clarificationCount, summary: issue.summary });
    const now = new Date().toISOString();
    await mutateDatabase((database) => { const conversation = database.conversations.find((item) => item.id === conversationId && item.tenantId === tenant.id); if (!conversation) throw new Error("Conversation not found."); Object.assign(conversation, { contact: { ...conversation.contact, ...contact }, issue, classification, safetyReasons, lowConfidenceReason: result.lowConfidenceReason, clarificationCount: conversation.clarificationCount + (result.status === "AWAITING_CLARIFICATION" ? 1 : 0), status: result.status, updatedAt: now }); database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: result.content, createdAt: now }); });
    return Response.json({ conversationId, reply: result.content, status: result.status, classification, issue });
  }
  return Response.json({ error: "Unsupported chat action." }, { status: 400 });
}
