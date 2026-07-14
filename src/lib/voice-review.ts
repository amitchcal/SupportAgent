import type { Conversation, ConversationMessage, Database } from "./domain";

export type VoiceReviewFilters = { query?: string; status?: string; from?: string; to?: string };
export type VoiceTranscript = { conversation: Conversation; messages: ConversationMessage[] };

export function maskBasicPii(value: string) {
  return value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL REDACTED]").replace(/(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)/g, "[PHONE REDACTED]");
}

export function listVoiceTranscripts(database: Database, tenantId: string, filters: VoiceReviewFilters = {}): VoiceTranscript[] {
  const query = filters.query?.trim().toLowerCase() ?? ""; const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`).getTime() : null; const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : null; const masking = database.tenants.find((item) => item.id === tenantId)?.settings.voiceTranscriptMasking ?? "BASIC";
  return database.conversations.filter((conversation) => conversation.tenantId === tenantId && conversation.channel === "VOICE").filter((conversation) => !filters.status || conversation.status === filters.status).filter((conversation) => { const time = new Date(conversation.createdAt).getTime(); return (from === null || time >= from) && (to === null || time <= to); }).filter((conversation) => !query || [conversation.issue.summary, conversation.contact.name, conversation.contact.email, conversation.issue.asset, conversation.issue.errorCode].some((value) => String(value ?? "").toLowerCase().includes(query))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((conversation) => ({ conversation: masking === "BASIC" ? { ...conversation, contact: Object.fromEntries(Object.entries(conversation.contact).map(([key, value]) => [key, maskBasicPii(value)])), issue: { ...conversation.issue, summary: maskBasicPii(conversation.issue.summary) } } : conversation, messages: database.conversationMessages.filter((message) => message.tenantId === tenantId && message.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((message) => masking === "BASIC" ? { ...message, content: maskBasicPii(message.content) } : message) }));
}

export function getVoiceTranscript(database: Database, tenantId: string, conversationId: string) { return listVoiceTranscripts(database, tenantId).find((item) => item.conversation.id === conversationId) ?? null; }

export function validateVoicePolicy(audioPolicy: string, masking: string) {
  if (!["NEVER", "WITH_EXPLICIT_CONSENT"].includes(audioPolicy)) throw new Error("Unsupported audio recording policy.");
  if (!["NONE", "BASIC"].includes(masking)) throw new Error("Unsupported transcript masking policy.");
  return true;
}
