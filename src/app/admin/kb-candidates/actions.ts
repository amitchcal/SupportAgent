"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan, scopeTenant } from "@/lib/rbac";
import { convertCandidateToDraft, dismissKnowledgeCandidate } from "@/lib/knowledge-improvement";
import { audit, mutateDatabase, readDatabase } from "@/lib/store";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function candidateScope(actor: Awaited<ReturnType<typeof requireUser>>, candidateId: string) { const database = await readDatabase(); const candidate = (database.knowledgeCandidates ?? []).find((item) => item.id === candidateId); if (!candidate) throw new Error("Knowledge candidate not found."); return scopeTenant(actor.role, actor.tenantId, candidate.tenantId); }

export async function convertCandidate(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "knowledge:manage"); const candidateId = text(form, "candidateId"); const tenantId = await candidateScope(actor, candidateId);
  await mutateDatabase((database) => { const result = convertCandidateToDraft(database, tenantId, candidateId, actor.id); audit(database, { tenantId, actorUserId: actor.id, action: "knowledge_candidate.converted", entityType: "knowledge_candidate", entityId: candidateId, oldValue: { status: "PENDING" }, newValue: { status: result.candidate.status, documentId: result.documentId, sourceTicketId: result.candidate.sourceTicketId } }); }); revalidatePath("/admin/kb-candidates"); revalidatePath("/admin");
}

export async function dismissCandidate(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "knowledge:manage"); const candidateId = text(form, "candidateId"); const tenantId = await candidateScope(actor, candidateId);
  await mutateDatabase((database) => { const candidate = dismissKnowledgeCandidate(database, tenantId, candidateId, actor.id); audit(database, { tenantId, actorUserId: actor.id, action: "knowledge_candidate.dismissed", entityType: "knowledge_candidate", entityId: candidateId, oldValue: { status: "PENDING" }, newValue: { status: candidate.status, sourceTicketId: candidate.sourceTicketId } }); }); revalidatePath("/admin/kb-candidates");
}
