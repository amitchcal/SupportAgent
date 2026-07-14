import { randomUUID } from "node:crypto";
import { classifyIssue, detectSafetyRisk, extractIssueDetails, responseFor } from "@/lib/classification";
import type { Conversation, SopStep, SupportedLanguage } from "@/lib/domain";
import { findTenantBySlug, getTenantConversation, mutateDatabase, readDatabase } from "@/lib/store";
import { advanceSopExecution, currentSopStep, findActiveSop, startSopExecution } from "@/lib/sop";
import { createTicketFromConversation } from "@/lib/ticketing";
import { confirmResolution, recordFeedback } from "@/lib/closure";
import { refreshKnowledgeGaps } from "@/lib/enterprise";
import { anonymizedRateLimitKey, consumeRateLimit } from "@/lib/rate-limit";

const languages = new Set<SupportedLanguage>(["en", "hi", "hinglish"]);
const cleanRecord = (value: unknown) => Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {}).map(([key, item]) => [key, String(item ?? "").trim().slice(0, 300)]));
const ticketStatus = (ticket: { status: string } | null) => ticket?.status === "CREATED" ? "TICKET_CREATED" : "ESCALATED_WITHOUT_TICKET";
const captureGaps = (tenantId: string) => mutateDatabase((database)=>refreshKnowledgeGaps(database,tenantId));

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const tenantSlug = String(body.tenantSlug ?? "").trim(); const tenant = await findTenantBySlug(tenantSlug);
  if (!tenant) return Response.json({ error: "Support portal not found." }, { status: 404 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const limit = await consumeRateLimit(anonymizedRateLimitKey("chat", `${address}:${tenant.id}`), 60, 5 * 60);
  if (!limit.allowed) return Response.json({ error: "Too many support requests. Please wait and try again." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const language = String(body.language ?? tenant.settings.defaultLanguage) as SupportedLanguage;
  if (!languages.has(language) || !tenant.settings.enabledLanguages.includes(language)) return Response.json({ error: "Language is not enabled for this tenant." }, { status: 400 });
  const action = String(body.action ?? ""); const contact = cleanRecord(body.contact); const message = String(body.message ?? "").trim().slice(0, 4000);
  if (!message && !["resolution_confirmation", "feedback"].includes(action)) return Response.json({ error: "Please describe the issue." }, { status: 400 });

  if (body.action === "start") {
    const missing = tenant.settings.requiredSupportFields.filter((field) => !contact[field]);
    if (missing.length) return Response.json({ error: `Required details missing: ${missing.join(", ")}.` }, { status: 400 });
    const classification = classifyIssue(message); const safetyReasons = detectSafetyRisk(message); const issue = extractIssueDetails(message, contact);
    const result = responseFor(language, { safetyReasons, confidence: classification.confidence, threshold: tenant.settings.confidenceThreshold, clarificationCount: 0, summary: issue.summary });
    const now = new Date().toISOString(); const conversationId = randomUUID();
    const conversation: Conversation = { id: conversationId, tenantId: tenant.id, language, channel: body.channel === "VOICE" ? "VOICE" : "CHAT", contact, issue, classification, safetyReasons, lowConfidenceReason: result.lowConfidenceReason, clarificationCount: result.status === "AWAITING_CLARIFICATION" ? 1 : 0, status: result.status, createdAt: now, updatedAt: now };
    await mutateDatabase((database) => { database.conversations.push(conversation); database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: result.content, createdAt: now }); });
    const ticket = result.status === "ESCALATED" ? await createTicketFromConversation(tenant.id, conversationId) : null; if(result.lowConfidenceReason||ticket) await captureGaps(tenant.id);
    return Response.json({ conversationId, reply: result.content, status: ticket ? ticketStatus(ticket) : result.status, classification, issue, ticketReference: ticket?.reference, requestFeedback: Boolean(ticket) });
  }

  if (body.action === "start_sop") {
    const conversationId = String(body.conversationId ?? ""); const conversation = await getTenantConversation(tenant.id, conversationId); if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
    if (conversation.status !== "AWAITING_CONFIRMATION") return Response.json({ error: "Issue summary is not awaiting confirmation." }, { status: 409 });
    const database = await readDatabase(); const sop = findActiveSop(database, tenant.id, conversation.classification.category, conversation.language, conversation.issue.model || conversation.issue.asset); const emergencyReasons = detectSafetyRisk(message); const now = new Date().toISOString();
    if (!sop) { const reply = "I cannot provide troubleshooting instructions because no approved active SOP matches this issue. The session has been escalated for human support."; await mutateDatabase((db) => { const item = db.conversations.find((entry) => entry.id === conversationId && entry.tenantId === tenant.id); if (item) { item.status = "ESCALATED"; item.updatedAt = now; } db.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: reply, createdAt: now }); }); const ticket = await createTicketFromConversation(tenant.id, conversationId); return Response.json({ conversationId, reply, status: ticketStatus(ticket), ticketReference: ticket.reference, requestFeedback: true }); }
    const execution = startSopExecution(sop, tenant.id, conversationId, emergencyReasons, now); const step = currentSopStep(execution, sop); const reply = execution.status === "ESCALATED" ? "A new emergency risk was detected. Stop troubleshooting and follow the site emergency procedure now. Human support has been alerted." : `Approved SOP: ${sop.title}\n\nStep 1 of ${sop.steps.length}: ${step?.content}`;
    await mutateDatabase((db) => { db.sopExecutions.push(execution); const item = db.conversations.find((entry) => entry.id === conversationId && entry.tenantId === tenant.id); if (item) { item.status = execution.status === "ESCALATED" ? "ESCALATED" : "SOP_IN_PROGRESS"; item.updatedAt = now; } db.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: reply, createdAt: now }); });
    const ticket = execution.status === "ESCALATED" ? await createTicketFromConversation(tenant.id, conversationId) : null;
    return Response.json({ conversationId, reply, status: ticket ? ticketStatus(ticket) : "SOP_IN_PROGRESS", sop: { id: sop.id, title: sop.title, version: sop.version }, step, ticketReference: ticket?.reference, requestFeedback: Boolean(ticket) });
  }

  if (body.action === "sop_step") {
    const conversationId = String(body.conversationId ?? ""); const database = await readDatabase(); const execution = database.sopExecutions.find((item) => item.tenantId === tenant.id && item.conversationId === conversationId && item.status === "IN_PROGRESS"); if (!execution) return Response.json({ error: "Active SOP execution not found." }, { status: 404 }); const sop = database.sopDefinitions.find((item) => item.id === execution.sopId && item.tenantId === tenant.id && item.status === "ACTIVE"); if (!sop) return Response.json({ error: "Approved SOP is no longer active; troubleshooting has stopped." }, { status: 409 });
    const emergencyReasons = detectSafetyRisk(message); const now = new Date().toISOString(); let reply = ""; let status = "SOP_IN_PROGRESS"; let nextStep: SopStep | null = null;
    try { advanceSopExecution(execution, sop, message, body.confirmed === true, emergencyReasons, now); nextStep = currentSopStep(execution, sop); if (execution.status === "ESCALATED") { status = "ESCALATED"; reply = emergencyReasons.length ? "Emergency override activated. Stop troubleshooting immediately and follow your site emergency procedure." : "The approved SOP requires escalation to human support."; } else if (execution.status === "RESOLVED") { status = "AWAITING_RESOLUTION_CONFIRMATION"; reply = "The approved SOP has reached its resolution step. Is the issue now fully resolved?"; } else { const position = sop.steps.findIndex((item) => item.id === nextStep?.id) + 1; reply = `Step ${position} of ${sop.steps.length}: ${nextStep?.content}`; } } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to advance SOP." }, { status: 400 }); }
    await mutateDatabase((db) => { const stored = db.sopExecutions.find((item) => item.id === execution.id && item.tenantId === tenant.id); if (stored) Object.assign(stored, execution); const conversation = db.conversations.find((item) => item.id === conversationId && item.tenantId === tenant.id); if (conversation) { conversation.status = status as typeof conversation.status; conversation.updatedAt = now; } db.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: reply, createdAt: now }); });
    const ticket = status === "ESCALATED" ? await createTicketFromConversation(tenant.id, conversationId) : null;
    return Response.json({ conversationId, reply, status: ticket ? ticketStatus(ticket) : status, step: nextStep, ticketReference: ticket?.reference, requestFeedback: Boolean(ticket) });
  }

  if (action === "resolution_confirmation") {
    const conversationId = String(body.conversationId ?? ""); const resolved = body.resolved === true; const now = new Date().toISOString();
    try { await mutateDatabase((database) => { confirmResolution(database, tenant.id, conversationId, resolved, now); database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: resolved ? "Yes, the issue is resolved." : "No, the issue is not resolved.", createdAt: now }); }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to confirm resolution." }, { status: 409 }); }
    if (resolved) { const reply = "Thank you for confirming. This session is resolved. Please rate your support experience."; await mutateDatabase((database) => database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: reply, createdAt: now })); return Response.json({ conversationId, reply, status: "RESOLVED", requestFeedback: true }); }
    const ticket = await createTicketFromConversation(tenant.id, conversationId); const reply = "Thank you for confirming. I have escalated the unresolved issue for human support."; await mutateDatabase((database) => database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: reply, createdAt: now })); return Response.json({ conversationId, reply, status: ticketStatus(ticket), ticketReference: ticket.reference, requestFeedback: true });
  }

  if (action === "feedback") {
    const conversationId = String(body.conversationId ?? ""); const rating = Number(body.rating); try { await mutateDatabase((database) => recordFeedback(database, { tenantId: tenant.id, conversationId, rating, comment: message })); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to save feedback." }, { status: 400 }); }
    return Response.json({ conversationId, reply: "Thank you. Your feedback has been recorded.", status: (await getTenantConversation(tenant.id, conversationId))?.status, feedbackSubmitted: true });
  }

  if (body.action === "reply") {
    const conversationId = String(body.conversationId ?? ""); const current = await getTenantConversation(tenant.id, conversationId);
    if (!current) return Response.json({ error: "Conversation not found." }, { status: 404 });
    if (current.status === "ESCALATED") return Response.json({ error: "This conversation is already escalated." }, { status: 409 });
    const combined = `${current.issue.summary} ${message}`; const classification = classifyIssue(combined); const safetyReasons = detectSafetyRisk(combined); const issue = extractIssueDetails(combined, { ...current.contact, ...contact });
    const result = responseFor(current.language, { safetyReasons, confidence: classification.confidence, threshold: tenant.settings.confidenceThreshold, clarificationCount: current.clarificationCount, summary: issue.summary });
    const now = new Date().toISOString();
    await mutateDatabase((database) => { const conversation = database.conversations.find((item) => item.id === conversationId && item.tenantId === tenant.id); if (!conversation) throw new Error("Conversation not found."); Object.assign(conversation, { contact: { ...conversation.contact, ...contact }, issue, classification, safetyReasons, lowConfidenceReason: result.lowConfidenceReason, clarificationCount: conversation.clarificationCount + (result.status === "AWAITING_CLARIFICATION" ? 1 : 0), status: result.status, updatedAt: now }); database.conversationMessages.push({ id: randomUUID(), tenantId: tenant.id, conversationId, role: "USER", content: message, createdAt: now }, { id: randomUUID(), tenantId: tenant.id, conversationId, role: "ASSISTANT", content: result.content, createdAt: now }); });
    const ticket = result.status === "ESCALATED" ? await createTicketFromConversation(tenant.id, conversationId) : null; if(result.lowConfidenceReason||ticket) await captureGaps(tenant.id);
    return Response.json({ conversationId, reply: result.content, status: ticket ? ticketStatus(ticket) : result.status, classification, issue, ticketReference: ticket?.reference, requestFeedback: Boolean(ticket) });
  }
  return Response.json({ error: "Unsupported chat action." }, { status: 400 });
}
