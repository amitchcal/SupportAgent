"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertCan, scopeTenant } from "@/lib/rbac";
import { audit, mutateDatabase } from "@/lib/store";
import { validateVoicePolicy } from "@/lib/voice-review";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export async function updateVoiceReviewPolicy(form: FormData) {
  const actor = await requireUser(); assertCan(actor.role, "settings:manage"); const tenantId = scopeTenant(actor.role, actor.tenantId, text(form, "tenantId") || undefined); const audioPolicy = text(form, "audioPolicy"); const masking = text(form, "masking"); validateVoicePolicy(audioPolicy, masking);
  await mutateDatabase((database) => { const tenant = database.tenants.find((item) => item.id === tenantId); if (!tenant) throw new Error("Tenant not found."); const oldValue = { voiceAudioRecordingPolicy: tenant.settings.voiceAudioRecordingPolicy, voiceTranscriptMasking: tenant.settings.voiceTranscriptMasking }; tenant.settings = { ...tenant.settings, voiceAudioRecordingPolicy: audioPolicy as "NEVER" | "WITH_EXPLICIT_CONSENT", voiceTranscriptMasking: masking as "NONE" | "BASIC" }; tenant.updatedAt = new Date().toISOString(); audit(database, { tenantId, actorUserId: actor.id, action: "voice.review_policy.updated", entityType: "tenant", entityId: tenantId, oldValue, newValue: { voiceAudioRecordingPolicy: audioPolicy, voiceTranscriptMasking: masking } }); }); revalidatePath("/admin/voice-transcripts");
}
