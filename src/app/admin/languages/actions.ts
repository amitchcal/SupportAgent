"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { supportedLanguages, type SupportedLanguage } from "@/lib/domain";
import { audit, mutateDatabase } from "@/lib/store";
import { assertCan, scopeTenant } from "@/lib/rbac";
export async function saveLanguages(form: FormData) {
  const actor=await requireUser(); assertCan(actor.role,"settings:manage"); const tenantId=scopeTenant(actor.role,actor.tenantId,String(form.get("tenantId")??"")||undefined);
  const enabled=form.getAll("enabledLanguages").map(String).filter((value):value is SupportedLanguage=>(supportedLanguages as readonly string[]).includes(value)); const defaultLanguage=String(form.get("defaultLanguage")??"") as SupportedLanguage;
  if(!enabled.includes("en"))throw new Error("English must remain enabled as the ticket-summary fallback."); if(!enabled.includes(defaultLanguage))throw new Error("The default language must also be enabled.");
  await mutateDatabase(database=>{const tenant=database.tenants.find(item=>item.id===tenantId);if(!tenant)throw new Error("Tenant not found.");const oldValue={defaultLanguage:tenant.settings.defaultLanguage,enabledLanguages:tenant.settings.enabledLanguages};tenant.settings={...tenant.settings,defaultLanguage,enabledLanguages:[...new Set(enabled)]};tenant.updatedAt=new Date().toISOString();audit(database,{tenantId,actorUserId:actor.id,action:"tenant.languages.updated",entityType:"tenant",entityId:tenantId,oldValue,newValue:{defaultLanguage,enabledLanguages:enabled}});}); revalidatePath("/admin/languages");revalidatePath("/chat");
}
