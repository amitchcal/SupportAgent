import { randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { Database, NormalizedTicketPayload, Ticket, TicketingIntegration } from "./domain";
import { decryptSecret } from "./security";
import { mutateDatabase, readDatabase } from "./store";

export type TicketCreationResult = { externalTicketId: string; externalTicketUrl: string | null; raw: unknown };
export interface TicketingAdapter { test(): Promise<TicketCreationResult>; createTicket(payload: NormalizedTicketPayload): Promise<TicketCreationResult>; }
export function deliverTicket(adapter: TicketingAdapter, payload: NormalizedTicketPayload) { return adapter.createTicket(payload); }
type WebhookAuth = { token?: string; username?: string; password?: string };

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function validateOutboundEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:") throw new Error("Ticketing endpoint must use HTTPS.");
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal") || (isIP(hostname) > 0 && isPrivateNetworkAddress(hostname))) throw new Error("Ticketing endpoint cannot target a private or local network.");
  return url;
}

export class ServiceNowAdapter implements TicketingAdapter {
  constructor(private integration: TicketingIntegration, private fetcher: typeof fetch = fetch) { validateOutboundEndpoint(integration.endpointUrl); }
  private async send(payload: NormalizedTicketPayload | { short_description: string }) { const auth = decryptSecret<WebhookAuth>(this.integration.authConfigEncrypted); const mapped = "schemaVersion" in payload ? mapTicketPayload(payload, this.integration.fieldMapping) : payload; const response = await this.fetcher(this.integration.endpointUrl, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", ...this.integration.headers, ...(auth.username ? { authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64")}` } : {}) }, body: JSON.stringify(mapped), signal: AbortSignal.timeout(10_000) }); const raw = await response.json() as { result?: { sys_id?: string; number?: string; link?: string } }; if (!response.ok) throw new Error(`ServiceNow returned HTTP ${response.status}.`); const result = raw.result ?? {}; return { externalTicketId: result.number ?? result.sys_id ?? "UNKNOWN", externalTicketUrl: result.link ?? null, raw }; }
  test() { return this.send({ short_description: "ResolveOps connection test" }); }
  createTicket(payload: NormalizedTicketPayload) { return this.send(payload); }
}
export function adapterFor(integration: TicketingIntegration, fetcher: typeof fetch = fetch): TicketingAdapter { return integration.type === "SERVICENOW" ? new ServiceNowAdapter(integration, fetcher) : new CustomWebhookAdapter(integration, fetcher); }

function valueAtPath(value: unknown, path: string): unknown { return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value); }
export function mapTicketPayload(payload: NormalizedTicketPayload, mapping: Record<string, string>) { return Object.keys(mapping).length ? Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, valueAtPath(payload, source)])) : payload; }

export class CustomWebhookAdapter implements TicketingAdapter {
  constructor(private integration: TicketingIntegration, private fetcher: typeof fetch = fetch) { validateOutboundEndpoint(integration.endpointUrl); }
  private headers() { const headers: Record<string, string> = { "content-type": "application/json", ...this.integration.headers }; const auth = this.integration.authConfigEncrypted ? decryptSecret<WebhookAuth>(this.integration.authConfigEncrypted) : {}; if (this.integration.authType === "BEARER" && auth.token) headers.authorization = `Bearer ${auth.token}`; if (this.integration.authType === "BASIC" && auth.username) headers.authorization = `Basic ${Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64")}`; return headers; }
  private async send(payload: unknown) { const response = await this.fetcher(this.integration.endpointUrl, { method: "POST", headers: this.headers(), body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) }); const text = await response.text(); let raw: unknown = text; try { raw = text ? JSON.parse(text) : {}; } catch { /* keep text response */ } if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`); const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; return { externalTicketId: String(record.id ?? record.ticketId ?? record.reference ?? `WEB-${Date.now()}`), externalTicketUrl: typeof record.url === "string" ? record.url : null, raw }; }
  test() { return this.send({ event: "ticketing.test", sentAt: new Date().toISOString() }); }
  createTicket(payload: NormalizedTicketPayload) { return this.send(mapTicketPayload(payload, this.integration.fieldMapping)); }
}

export function buildNormalizedTicket(database: Database, tenantId: string, conversationId: string): NormalizedTicketPayload {
  const conversation = database.conversations.find((item) => item.id === conversationId && item.tenantId === tenantId); if (!conversation) throw new Error("Conversation not found."); const messages=database.conversationMessages.filter((item) => item.conversationId === conversationId && item.tenantId === tenantId); const transcript = messages.map((item) => ({ role: item.role, content: item.content, originalContent:item.originalContent, translatedContent:item.translatedContent, timestamp: item.createdAt })); const execution = database.sopExecutions.find((item) => item.conversationId === conversationId && item.tenantId === tenantId); const sop = execution ? database.sopDefinitions.find((item) => item.id === execution.sopId && item.tenantId === tenantId) : null; const troubleshooting = execution?.logs.filter((log) => log.stepId).map((log) => ({ step: sop?.steps.find((step) => step.id === log.stepId)?.content ?? log.stepId ?? "", response: log.response, outcome: log.event, timestamp: log.createdAt })) ?? [];
  const firstUserMessage=messages.find(item=>item.role==="USER");const summaryOriginal=firstUserMessage?.originalContent??conversation.issue.summary;const summaryEnglish=firstUserMessage?.translatedContent??conversation.issue.summary;
  return { schemaVersion: "1.0", tenantId, conversationId, requester: conversation.contact, asset: { id: conversation.issue.asset, model: conversation.issue.model, serialNumber: conversation.issue.serialNumber, site: conversation.issue.site }, issue: { summary: summaryEnglish, summaryEnglish, summaryOriginal, originalLanguage:conversation.language, category: conversation.classification.category, severity: conversation.classification.severity, urgency: conversation.classification.urgency, errorCode: conversation.issue.errorCode, safetyReasons: conversation.safetyReasons }, troubleshooting, attachments: [], transcript };
}

function reference() { const date = new Date().toISOString().slice(0, 10).replaceAll("-", ""); return `SUP-${date}-${randomBytes(3).toString("hex").toUpperCase()}`; }
export function retryState(attempts:number){return attempts>=3?"DEAD_LETTER" as const:"CREATION_FAILED" as const;}

export async function retryFailedTicket(tenantId: string, ticketId: string) { const snapshot = await readDatabase(); const ticket = snapshot.tickets.find((item)=>item.id===ticketId&&item.tenantId===tenantId); if (!ticket) throw new Error("Ticket not found."); if (ticket.status!=="CREATION_FAILED") throw new Error("Only failed tickets can be retried."); if (ticket.creationAttempts>=3) { await mutateDatabase(database=>{ const stored=database.tickets.find(item=>item.id===ticketId&&item.tenantId===tenantId); if(stored) stored.status="DEAD_LETTER"; }); return { ...ticket, status:"DEAD_LETTER" as const }; } const integration=snapshot.ticketingIntegrations.find(item=>item.id===ticket.integrationId&&item.tenantId===tenantId&&item.isActive); if(!integration) { await recordFailure(ticket.id,tenantId,ticket.integrationId,ticket.normalizedPayload,"Active integration is unavailable."); return ticket; } try { const result=await deliverTicket(adapterFor(integration),ticket.normalizedPayload); await mutateDatabase(database=>{ const stored=database.tickets.find(item=>item.id===ticketId&&item.tenantId===tenantId); if(!stored)return; stored.status="CREATED"; stored.externalTicketId=result.externalTicketId; stored.externalTicketUrl=result.externalTicketUrl; stored.creationAttempts+=1; stored.lastError=null; stored.updatedAt=new Date().toISOString(); }); return { ...ticket,status:"CREATED" as const,externalTicketId:result.externalTicketId }; } catch(reason) { await recordFailure(ticket.id,tenantId,integration.id,ticket.normalizedPayload,reason instanceof Error?reason.message:"Retry failed."); const latest=(await readDatabase()).tickets.find(item=>item.id===ticketId&&item.tenantId===tenantId)!; if(latest.creationAttempts>=3) await mutateDatabase(database=>{ const stored=database.tickets.find(item=>item.id===ticketId&&item.tenantId===tenantId); if(stored) stored.status="DEAD_LETTER"; }); return latest; } }

export async function createTicketFromConversation(tenantId: string, conversationId: string) {
  const snapshot = await readDatabase(); const payload = buildNormalizedTicket(snapshot, tenantId, conversationId); const integration = snapshot.ticketingIntegrations.find((item) => item.tenantId === tenantId && item.isActive) ?? null; const now = new Date().toISOString(); let ticket!: Ticket; let created = false;
  await mutateDatabase((database) => { const existing = database.tickets.find((item) => item.tenantId === tenantId && item.conversationId === conversationId); if (existing) { ticket = existing; return; } ticket = { id: randomUUID(), reference: reference(), tenantId, conversationId, integrationId: integration?.id ?? null, status: "PENDING_CREATION", externalTicketId: null, externalTicketUrl: null, normalizedPayload: payload, creationAttempts: 0, lastError: null, createdAt: now, updatedAt: now }; database.tickets.push(ticket); created = true; });
  if (!created) return ticket;
  if (!integration) { const error = "No active ticketing integration is configured."; await recordFailure(ticket.id, tenantId, null, payload, error); return { ...ticket, status: "CREATION_FAILED" as const, lastError: error }; }
  try { const result = await deliverTicket(adapterFor(integration), payload); await mutateDatabase((database) => { const now = new Date().toISOString(); const stored = database.tickets.find((item) => item.id === ticket.id); if (!stored) return; stored.status = "CREATED"; stored.externalTicketId = result.externalTicketId; stored.externalTicketUrl = result.externalTicketUrl; stored.creationAttempts += 1; stored.updatedAt = now; const conversation = database.conversations.find((item) => item.id === conversationId && item.tenantId === tenantId); if (conversation) { conversation.status = "TICKET_CREATED"; conversation.closedAt = now; conversation.updatedAt = now; } database.ticketSyncLogs.push({ id: randomUUID(), tenantId, ticketId: ticket.id, integrationId: integration.id, action: "CREATE", requestPayload: mapTicketPayload(payload, integration.fieldMapping), responsePayload: result.raw, status: "SUCCESS", errorMessage: null, createdAt: now }); }); return { ...ticket, status: "CREATED" as const, externalTicketId: result.externalTicketId, externalTicketUrl: result.externalTicketUrl }; }
  catch (reason) { const error = reason instanceof Error ? reason.message : "Ticket creation failed."; await recordFailure(ticket.id, tenantId, integration.id, payload, error); return { ...ticket, status: "CREATION_FAILED" as const, lastError: error }; }
}

async function recordFailure(ticketId: string, tenantId: string, integrationId: string | null, requestPayload: unknown, error: string) { await mutateDatabase((database) => { const now = new Date().toISOString(); const ticket = database.tickets.find((item) => item.id === ticketId && item.tenantId === tenantId); if (ticket) { ticket.status = "CREATION_FAILED"; ticket.creationAttempts += 1; ticket.lastError = error; ticket.updatedAt = now; } const conversation = database.conversations.find((item) => item.id === ticket?.conversationId && item.tenantId === tenantId); if (conversation) { conversation.status = "ESCALATED_WITHOUT_TICKET"; conversation.closedAt = now; conversation.updatedAt = now; } database.ticketSyncLogs.push({ id: randomUUID(), tenantId, ticketId, integrationId, action: "CREATE", requestPayload, responsePayload: null, status: "FAILED", errorMessage: error, createdAt: now }); }); }
