import { findTenantBySlug } from "@/lib/store";
import { VoiceClient } from "./voice-client";
export default async function VoicePage({searchParams}:{searchParams:Promise<{tenant?:string}>}){ const tenant=await findTenantBySlug((await searchParams).tenant??"acme"); if(!tenant)return <main className="center"><h1>Voice support portal not found.</h1></main>; return <VoiceClient tenant={tenant}/>; }
