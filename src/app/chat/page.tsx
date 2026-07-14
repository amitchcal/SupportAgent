import { notFound } from "next/navigation";
import { findTenantBySlug } from "@/lib/store";
import { themeStyle } from "@/lib/theme";
import { ChatClient } from "./chat-client";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const tenant = await findTenantBySlug((await searchParams).tenant ?? "acme"); if (!tenant) notFound();
  return <main style={themeStyle(tenant.theme)}><ChatClient tenant={tenant}/></main>;
}
