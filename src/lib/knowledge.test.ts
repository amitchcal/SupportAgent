import assert from "node:assert/strict";
import test from "node:test";
import type { Database, KnowledgeDocument, KnowledgeVersion } from "./domain";
import { chunkText, fileType, retrieveActiveChunks } from "./knowledge";

const now = new Date(0).toISOString();
const document = (id: string, tenantId: string, status: KnowledgeDocument["status"], currentVersionId: string | null): KnowledgeDocument => ({ id, tenantId, title: id, description: "", tags: [], status, currentVersionId, createdBy: "u1", createdAt: now, updatedAt: now });
const version = (id: string, documentId: string, tenantId: string, status: KnowledgeVersion["status"], content: string): KnowledgeVersion => ({ id, documentId, tenantId, version: 1, fileName: `${id}.txt`, fileType: "txt", storagePath: "ignored", checksum: id, status, chunks: [content], createdBy: "u1", approvedBy: status === "ACTIVE" ? "u2" : null, createdAt: now, approvedAt: status === "ACTIVE" ? now : null });

test("retrieval returns only the active current version for the requested tenant", () => {
  const database = { tenants: [], users: [], auditLogs: [], conversations: [], conversationMessages: [], knowledgeDocuments: [document("active", "tenant-a", "ACTIVE", "v-active"), document("draft", "tenant-a", "DRAFT", null), document("archived", "tenant-a", "ARCHIVED", "v-archived"), document("other-tenant", "tenant-b", "ACTIVE", "v-other")], knowledgeVersions: [version("v-active", "active", "tenant-a", "ACTIVE", "Reset the hydraulic pressure alarm safely."), version("v-old", "active", "tenant-a", "ARCHIVED", "Obsolete hydraulic instructions."), version("v-draft", "draft", "tenant-a", "DRAFT", "Unapproved hydraulic instructions."), version("v-archived", "archived", "tenant-a", "ARCHIVED", "Archived hydraulic instructions."), version("v-other", "other-tenant", "tenant-b", "ACTIVE", "Another tenant hydraulic instructions.")] } satisfies Database;
  const results = retrieveActiveChunks(database, "tenant-a", "hydraulic pressure");
  assert.equal(results.length, 1);
  assert.equal(results[0].versionId, "v-active");
  assert.equal(results[0].content, "Reset the hydraulic pressure alarm safely.");
});

test("chunking normalizes text and supported file types are enforced", () => {
  assert.deepEqual(chunkText("First paragraph.\n\nSecond   paragraph."), ["First paragraph.", "Second paragraph."]);
  assert.equal(fileType("manual.PDF"), "pdf");
  assert.throws(() => fileType("malware.exe"), /Only PDF/);
});
