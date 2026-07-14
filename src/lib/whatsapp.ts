import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Database, SupportedLanguage, Tenant } from "./domain";

export type WhatsAppInbound = { messageId: string; phoneNumberId: string; senderId: string; senderName: string; text: string };

export function verifyWhatsAppSignature(rawBody: string, signature: string | null, appSecret = process.env.WHATSAPP_APP_SECRET ?? "") {
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"), "utf8");
  const actual = Buffer.from(signature.slice(7), "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseTenantMap(raw = process.env.WHATSAPP_TENANT_MAP ?? "") {
  try { const parsed=JSON.parse(raw) as unknown; if(!parsed||Array.isArray(parsed)||typeof parsed!=="object")return {}; return Object.fromEntries(Object.entries(parsed).filter(([key,value])=>/^\d+$/.test(key)&&typeof value==="string"&&/^[a-z0-9-]+$/.test(value))) as Record<string,string>; } catch { return {}; }
}

export function parseWhatsAppMessages(payload: unknown): WhatsAppInbound[] {
  if (!payload || typeof payload !== "object") return [];
  const entries=(payload as {entry?:unknown[]}).entry??[]; const output:WhatsAppInbound[]=[];
  for(const entry of entries){const changes=(entry as {changes?:unknown[]})?.changes??[];for(const change of changes){const value=(change as {value?:{metadata?:{phone_number_id?:string};contacts?:Array<{wa_id?:string;profile?:{name?:string}}> ;messages?:Array<{id?:string;from?:string;type?:string;text?:{body?:string}}>}})?.value;const phoneNumberId=String(value?.metadata?.phone_number_id??"");for(const message of value?.messages??[]){if(message.type!=="text"||!message.id||!message.from||!message.text?.body)continue;const contact=value?.contacts?.find(item=>item.wa_id===message.from);output.push({messageId:message.id,phoneNumberId,senderId:message.from,senderName:String(contact?.profile?.name??"WhatsApp user").slice(0,120),text:message.text.body.trim().slice(0,4000)})}}}
  return output;
}

export function claimMessage(database: Database, tenantId: string, inbound: WhatsAppInbound) {
  database.messagingReceipts??=[]; if(database.messagingReceipts.some(item=>item.provider==="WHATSAPP"&&item.externalMessageId===inbound.messageId))return null;
  const now=new Date().toISOString();const receipt={id:randomUUID(),tenantId,provider:"WHATSAPP" as const,externalMessageId:inbound.messageId,senderId:inbound.senderId,conversationId:null,status:"PROCESSING" as const,error:null,createdAt:now,updatedAt:now};database.messagingReceipts.push(receipt);return receipt;
}

export function activeWhatsAppConversation(database: Database, tenantId: string, senderId: string) {
  const terminal=new Set(["RESOLVED","TICKET_CREATED","ESCALATED_WITHOUT_TICKET","ABANDONED","FAILED"]);return database.conversations.filter(item=>item.tenantId===tenantId&&item.channel==="WHATSAPP"&&item.contact.whatsappNumber===senderId&&!terminal.has(item.status)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]??null;
}

export function languageForMessage(tenant: Tenant, text: string): SupportedLanguage {
  if(tenant.settings.enabledLanguages.includes("hi")&&/[\u0900-\u097f]/.test(text))return "hi";return tenant.settings.defaultLanguage;
}

export interface MessagingAdapter { sendText(phoneNumberId:string,to:string,text:string):Promise<unknown> }
export class MetaWhatsAppAdapter implements MessagingAdapter {
  constructor(private token=process.env.WHATSAPP_ACCESS_TOKEN??"",private version=process.env.WHATSAPP_GRAPH_VERSION??"v23.0",private fetcher:typeof fetch=fetch){}
  async sendText(phoneNumberId:string,to:string,text:string){if(!this.token)throw new Error("WhatsApp access token is not configured.");if(!/^\d+$/.test(phoneNumberId)||!/^\d{7,20}$/.test(to))throw new Error("Invalid WhatsApp destination.");const response=await this.fetcher(`https://graph.facebook.com/${this.version}/${phoneNumberId}/messages`,{method:"POST",headers:{authorization:`Bearer ${this.token}`,"content-type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",recipient_type:"individual",to,type:"text",text:{preview_url:false,body:text.slice(0,4096)}}),signal:AbortSignal.timeout(10_000)});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`WhatsApp API returned HTTP ${response.status}.`);return payload}
}
