import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Database, KnowledgeVersion } from "./domain";

const allowedTypes = new Set<KnowledgeVersion["fileType"]>(["pdf", "docx", "txt", "md", "html"]);

export function fileType(fileName: string) {
  const extension = path.extname(fileName).slice(1).toLowerCase() as KnowledgeVersion["fileType"];
  if (!allowedTypes.has(extension)) throw new Error("Only PDF, DOCX, TXT, MD, and HTML files are supported.");
  return extension;
}

export function chunkText(text: string, maximum = 900) {
  const paragraphs = text.replace(/<[^>]+>/g, " ").split(/\n{2,}/).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean); const chunks: string[] = [];
  for (const paragraph of paragraphs) { if (paragraph.length <= maximum) chunks.push(paragraph); else for (let index = 0; index < paragraph.length; index += maximum) chunks.push(paragraph.slice(index, index + maximum)); }
  return chunks;
}

export async function persistKnowledgeFile(tenantId: string, documentId: string, file: File) {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error("File must be between 1 byte and 5 MB.");
  const type = fileType(file.name); const bytes = Buffer.from(await file.arrayBuffer()); const checksum = createHash("sha256").update(bytes).digest("hex");
  const directory = path.join(process.env.SUPPORT_AGENT_DATA_DIR ?? path.join(process.cwd(), "data"), "uploads", tenantId, documentId); await mkdir(directory, { recursive: true });
  const storedName = `${randomUUID()}.${type}`; const storagePath = path.join(directory, storedName); await writeFile(storagePath, bytes);
  const chunks = type === "txt" || type === "md" || type === "html" ? chunkText(bytes.toString("utf8")) : [];
  return { type, checksum, storagePath, chunks };
}

export function retrieveActiveChunks(database: Database, tenantId: string, query: string, limit = 5) {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return database.knowledgeDocuments.filter((document) => document.tenantId === tenantId && document.status === "ACTIVE" && document.currentVersionId).flatMap((document) => {
    const version = database.knowledgeVersions.find((item) => item.id === document.currentVersionId && item.tenantId === tenantId && item.documentId === document.id && item.status === "ACTIVE");
    return version ? version.chunks.map((content, chunkIndex) => ({ documentId: document.id, versionId: version.id, title: document.title, chunkIndex, content, score: terms.reduce((score, term) => score + (content.toLowerCase().includes(term) ? 1 : 0), 0) })) : [];
  }).filter((chunk) => !terms.length || chunk.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
