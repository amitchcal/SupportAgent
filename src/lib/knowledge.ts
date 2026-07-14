import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Database, KnowledgeVersion } from "./domain";

const allowedTypes = new Set<KnowledgeVersion["fileType"]>(["pdf", "docx", "txt", "md", "html"]);
const contentTypes: Record<KnowledgeVersion["fileType"], string> = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", md: "text/markdown", html: "text/html" };

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

export async function extractDocumentText(type: KnowledgeVersion["fileType"], bytes: Buffer) {
  if (type === "txt" || type === "md" || type === "html") return bytes.toString("utf8");
  if (type === "docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  }
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try { return (await parser.getText()).text; } finally { await parser.destroy(); }
}

function storageConfiguration() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "support-documents";
  if (url && serviceKey) return { url: url.replace(/\/$/, ""), serviceKey, bucket };
  if (process.env.NODE_ENV === "production") throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for document storage in production.");
  return null;
}

async function storeBytes(objectPath: string, type: KnowledgeVersion["fileType"], bytes: Buffer) {
  const configuration = storageConfiguration();
  if (configuration) {
    const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
    const body = new Uint8Array(bytes.byteLength); body.set(bytes);
    const response = await fetch(`${configuration.url}/storage/v1/object/${encodeURIComponent(configuration.bucket)}/${encodedPath}`, { method: "POST", headers: { apikey: configuration.serviceKey, authorization: `Bearer ${configuration.serviceKey}`, "content-type": contentTypes[type], "x-upsert": "false" }, body });
    if (!response.ok) throw new Error(`Supabase Storage upload failed with HTTP ${response.status}.`);
    return `${configuration.bucket}/${objectPath}`;
  }
  const storagePath = path.join(process.env.SUPPORT_AGENT_DATA_DIR ?? path.join(process.cwd(), "data"), "uploads", objectPath);
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, bytes);
  return storagePath;
}

export async function persistKnowledgeFile(tenantId: string, documentId: string, file: File) {
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error("File must be between 1 byte and 5 MB.");
  const type = fileType(file.name); const bytes = Buffer.from(await file.arrayBuffer()); const checksum = createHash("sha256").update(bytes).digest("hex");
  const objectPath = `${tenantId}/${documentId}/${randomUUID()}.${type}`;
  const text = await extractDocumentText(type, bytes);
  const storagePath = await storeBytes(objectPath, type, bytes);
  const chunks = chunkText(text);
  return { type, checksum, storagePath, chunks };
}

export function retrieveActiveChunks(database: Database, tenantId: string, query: string, limit = 5) {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  return database.knowledgeDocuments.filter((document) => document.tenantId === tenantId && document.status === "ACTIVE" && document.currentVersionId).flatMap((document) => {
    const version = database.knowledgeVersions.find((item) => item.id === document.currentVersionId && item.tenantId === tenantId && item.documentId === document.id && item.status === "ACTIVE");
    return version ? version.chunks.map((content, chunkIndex) => ({ documentId: document.id, versionId: version.id, title: document.title, chunkIndex, content, score: terms.reduce((score, term) => score + (content.toLowerCase().includes(term) ? 1 : 0), 0) })) : [];
  }).filter((chunk) => !terms.length || chunk.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
