"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan, scopeTenant } from "@/lib/rbac";
import { audit, mutateDatabase, readDatabase } from "@/lib/store";
import { syncExternalTicketStatus } from "@/lib/ticket-sync";
import { validateOutboundEndpoint } from "@/lib/ticketing";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function configureTicketStatusSync(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "integrations:manage"); const integrationId = text(form, "integrationId"); const statusEndpointUrl = text(form, "statusEndpointUrl"); const statusFieldPath = text(form, "statusFieldPath") || "status";
  validateOutboundEndpoint(statusEndpointUrl.replaceAll("{externalId}", "example"));
  await mutateDatabase((database) => { const integration = database.ticketingIntegrations.find((item) => item.id === integrationId); if (!integration) throw new Error("Integration not found."); const tenantId = scopeTenant(actor.role, actor.tenantId, integration.tenantId); const oldValue = { statusEndpointUrl: integration.statusEndpointUrl, statusFieldPath: integration.statusFieldPath }; integration.statusEndpointUrl = statusEndpointUrl; integration.statusFieldPath = statusFieldPath; integration.updatedAt = new Date().toISOString(); audit(database, { tenantId, actorUserId: actor.id, action: "ticket.status_sync.configured", entityType: "ticketing_integration", entityId: integration.id, oldValue, newValue: { statusEndpointUrl, statusFieldPath } }); });
  revalidatePath("/admin/ticket-sync");
}

export async function pullTicketStatus(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "integrations:manage"); const ticketId = text(form, "ticketId"); const database = await readDatabase(); const ticket = database.tickets.find((item) => item.id === ticketId); if (!ticket) throw new Error("Ticket not found."); const tenantId = scopeTenant(actor.role, actor.tenantId, ticket.tenantId); const previousStatus = ticket.externalStatus ?? null; const result = await syncExternalTicketStatus(tenantId, ticketId); await mutateDatabase((current) => audit(current, { tenantId, actorUserId: actor.id, action: "ticket.status_sync.requested", entityType: "ticket", entityId: ticketId, oldValue: { externalStatus: previousStatus }, newValue: { externalStatus: result.ticket.externalStatus } })); revalidatePath("/admin/ticket-sync");
}
