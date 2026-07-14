import { randomUUID } from "node:crypto";
import type { ConversationFeedback, Database } from "./domain";

export const finalConversationStatuses = ["RESOLVED", "TICKET_CREATED", "ABANDONED", "FAILED", "ESCALATED_WITHOUT_TICKET"] as const;

export function confirmResolution(database: Database, tenantId: string, conversationId: string, resolved: boolean, now = new Date().toISOString()) {
  const conversation = database.conversations.find((item) => item.id === conversationId && item.tenantId === tenantId);
  if (!conversation) throw new Error("Conversation not found.");
  if (conversation.status !== "AWAITING_RESOLUTION_CONFIRMATION") throw new Error("Conversation is not awaiting resolution confirmation.");
  if (resolved) { conversation.status = "RESOLVED"; conversation.closedAt = now; conversation.updatedAt = now; }
  return conversation;
}

export function recordFeedback(database: Database, input: { tenantId: string; conversationId: string; rating: number; comment?: string }, now = new Date().toISOString()): ConversationFeedback {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("CSAT rating must be between 1 and 5.");
  const conversation = database.conversations.find((item) => item.id === input.conversationId && item.tenantId === input.tenantId);
  if (!conversation) throw new Error("Conversation not found.");
  if (!(finalConversationStatuses as readonly string[]).includes(conversation.status)) throw new Error("Feedback is only accepted after a session is closed.");
  if (database.conversationFeedback.some((item) => item.tenantId === input.tenantId && item.conversationId === input.conversationId)) throw new Error("Feedback has already been submitted.");
  const ticket = database.tickets.find((item) => item.tenantId === input.tenantId && item.conversationId === input.conversationId);
  const feedback: ConversationFeedback = { id: randomUUID(), tenantId: input.tenantId, conversationId: input.conversationId, ticketId: ticket?.id ?? null, rating: input.rating as ConversationFeedback["rating"], comment: (input.comment ?? "").trim().slice(0, 2000), negativeFlag: input.rating <= 2, createdAt: now };
  database.conversationFeedback.push(feedback);
  return feedback;
}

export function performanceReport(database: Database, tenantId: string) {
  const conversations = database.conversations.filter((item) => item.tenantId === tenantId);
  const feedback = database.conversationFeedback.filter((item) => item.tenantId === tenantId);
  const totalSessions = conversations.length;
  const resolvedSessions = conversations.filter((item) => item.status === "RESOLVED").length;
  const escalatedSessions = conversations.filter((item) => ["ESCALATED", "TICKET_CREATED", "ESCALATED_WITHOUT_TICKET"].includes(item.status)).length;
  const ticketsCreated = database.tickets.filter((item) => item.tenantId === tenantId && item.status === "CREATED").length;
  const categories = new Map<string, number>();
  for (const conversation of conversations) categories.set(conversation.classification.category, (categories.get(conversation.classification.category) ?? 0) + 1);
  return { totalSessions, resolvedSessions, escalatedSessions, ticketsCreated, resolutionRate: totalSessions ? resolvedSessions / totalSessions : 0, escalationRate: totalSessions ? escalatedSessions / totalSessions : 0, averageCsat: feedback.length ? feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length : null, negativeFeedback: feedback.filter((item) => item.negativeFlag).length, topCategories: [...categories].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)).slice(0, 5) };
}
