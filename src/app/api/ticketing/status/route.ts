import { applyExternalStatus } from "@/lib/ticket-sync";
import { verifyTicketingWebhook } from "@/lib/security";
import { mutateDatabase } from "@/lib/store";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyTicketingWebhook(raw, request.headers.get("x-support-signature"))) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let body: Record<string, unknown>; try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const tenantId = String(body.tenantId ?? "").trim(); const externalTicketId = String(body.externalTicketId ?? "").trim(); const status = String(body.status ?? "").trim();
  if (!tenantId || !externalTicketId || !status || tenantId.length > 100 || externalTicketId.length > 200 || status.length > 100) return Response.json({ error: "tenantId, externalTicketId and status are required." }, { status: 400 });
  try { let changed = false; await mutateDatabase((database) => { changed = applyExternalStatus(database, tenantId, { externalTicketId, status, raw: body }, "STATUS_WEBHOOK").changed; }); return Response.json({ accepted: true, changed }); }
  catch { return Response.json({ error: "Matching ticket was not found." }, { status: 404 }); }
}
