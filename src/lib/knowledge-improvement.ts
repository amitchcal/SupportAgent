import { createHash, randomUUID } from "node:crypto";
import type { Database, KnowledgeCandidate } from "./domain";
import { chunkText } from "./knowledge";

const resolvedStatuses = new Set(["resolved", "closed", "completed", "complete", "done", "fixed"]);
export function isResolvedExternalStatus(status: string) { return resolvedStatuses.has(status.trim().toLowerCase()); }

function proposedContent(database: Database, ticketId: string) {
  const ticket = database.tickets.find((item) => item.id === ticketId); if (!ticket) throw new Error("Ticket not found."); const issue = ticket.normalizedPayload.issue; const troubleshooting = ticket.normalizedPayload.troubleshooting;
  return [`# ${issue.summary}`, `Category: ${issue.category}`, issue.errorCode ? `Error code: ${issue.errorCode}` : "", "## Human-validated resolution candidate", ...troubleshooting.map((item, index) => `${index + 1}. ${item.step}\n   Response: ${item.response}\n   Outcome: ${item.outcome}`)].filter(Boolean).join("\n\n");
}

export function createCandidateFromResolvedTicket(database: Database, tenantId: string, ticketId: string, now = new Date().toISOString()): KnowledgeCandidate | null {
  database.knowledgeCandidates ??= []; const ticket = database.tickets.find((item) => item.id === ticketId && item.tenantId === tenantId); if (!ticket) throw new Error("Ticket not found."); if (!ticket.externalStatus || !isResolvedExternalStatus(ticket.externalStatus)) return null;
  const existing = database.knowledgeCandidates.find((item) => item.tenantId === tenantId && item.sourceTicketId === ticket.id); if (existing) return existing;
  const candidate: KnowledgeCandidate = { id: randomUUID(), tenantId, sourceTicketId: ticket.id, sourceTicketReference: ticket.reference, title: ticket.normalizedPayload.issue.summary.slice(0, 160), proposedContent: proposedContent(database, ticket.id), category: ticket.normalizedPayload.issue.category, status: "PENDING", reviewedBy: null, linkedDocumentId: null, createdAt: now, updatedAt: now }; database.knowledgeCandidates.push(candidate); return candidate;
}

export function convertCandidateToDraft(database: Database, tenantId: string, candidateId: string, actorUserId: string, now = new Date().toISOString()) {
  const candidate = (database.knowledgeCandidates ?? []).find((item) => item.id === candidateId && item.tenantId === tenantId); if (!candidate) throw new Error("Knowledge candidate not found."); if (candidate.status !== "PENDING") throw new Error("Only pending candidates can be converted.");
  const documentId = randomUUID(); const versionId = randomUUID(); database.knowledgeDocuments.push({ id: documentId, tenantId, title: candidate.title, description: `Draft generated from resolved ticket ${candidate.sourceTicketReference}.`, tags: [candidate.category, "resolved-ticket-candidate"], status: "DRAFT", currentVersionId: null, sourceTicketId: candidate.sourceTicketId, createdBy: actorUserId, createdAt: now, updatedAt: now }); database.knowledgeVersions.push({ id: versionId, tenantId, documentId, version: 1, fileName: `${candidate.sourceTicketReference}.md`, fileType: "md", storagePath: `generated://resolved-ticket/${candidate.sourceTicketId}`, checksum: createHash("sha256").update(candidate.proposedContent).digest("hex"), status: "DRAFT", chunks: chunkText(candidate.proposedContent), createdBy: actorUserId, approvedBy: null, createdAt: now, approvedAt: null }); candidate.status = "CONVERTED"; candidate.reviewedBy = actorUserId; candidate.linkedDocumentId = documentId; candidate.updatedAt = now; return { candidate, documentId, versionId };
}

export function dismissKnowledgeCandidate(database: Database, tenantId: string, candidateId: string, actorUserId: string, now = new Date().toISOString()) { const candidate = (database.knowledgeCandidates ?? []).find((item) => item.id === candidateId && item.tenantId === tenantId); if (!candidate) throw new Error("Knowledge candidate not found."); if (candidate.status !== "PENDING") throw new Error("Only pending candidates can be dismissed."); candidate.status = "DISMISSED"; candidate.reviewedBy = actorUserId; candidate.updatedAt = now; return candidate; }
